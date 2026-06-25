import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { ENV_KEYS } from "../../shared/env-keys";
import { findExecutableInPath } from "./helper-bin-resolver";

// 상태 패널에 게시하는 한 번의 lifecycle 업데이트.
export interface AssistantStatusUpdate {
  activity: string;
  intensity: string;
  line: string;
  providerId?: string;
  state: string;
  task: string;
}

// createRuntimeArgs / describeRuntime 가 받는, 래퍼가 해석한 실행 컨텍스트.
export interface AssistantRuntimeContext {
  originalPath: string | undefined;
  publishStatusUpdate: (status: AssistantStatusUpdate) => void;
  realBinary: string;
}

export interface AssistantCliWrapperConfig {
  binaryName: string;
  createRuntimeArgs: (context: AssistantRuntimeContext) => string[];
  describeRuntime: (
    runtimeArgs: string[],
    context: AssistantRuntimeContext,
  ) => string;
  displayName: string;
  status: {
    disconnected: AssistantStatusUpdate;
    error: AssistantStatusUpdate;
    starting: AssistantStatusUpdate;
  };
  traceLabel: string;
}

function appendTrace(traceLabel: string, message: string): void {
  const traceFilePath = process.env[ENV_KEYS.TRACE_FILE];

  if (typeof traceFilePath !== "string" || traceFilePath.length === 0) {
    return;
  }

  const line = `[${new Date().toISOString()}] [${traceLabel}] ${message}\n`;

  try {
    fs.appendFileSync(traceFilePath, line, "utf8");
  } catch {
    // Ignore trace write failures inside the wrapper.
  }
}

function publishStatus(args: string[]): void {
  const statusResult = spawnSync("claude-status", args, {
    stdio: "ignore",
  });

  if (statusResult.status === 0) {
    return;
  }

  if (typeof statusResult.error?.message === "string") {
    process.stderr.write(`${statusResult.error.message}\n`);
  }
}

function publishStatusUpdate(status: AssistantStatusUpdate): void {
  const args = [
    "--state",
    status.state,
    "--line",
    status.line,
    "--activity",
    status.activity,
    "--task",
    status.task,
    "--intensity",
    status.intensity,
  ];

  if (typeof status.providerId === "string" && status.providerId.length > 0) {
    args.push("--provider", status.providerId);
  }

  publishStatus(args);
}

export function runAssistantCliWrapper(config: AssistantCliWrapperConfig): void {
  const originalPath = process.env[ENV_KEYS.ORIGINAL_PATH];
  const realBinary = findExecutableInPath(config.binaryName, originalPath);
  const eventQueueDir = process.env[ENV_KEYS.EVENT_QUEUE_DIR];
  const queueExists =
    typeof eventQueueDir === "string" &&
    eventQueueDir.length > 0 &&
    fs.existsSync(eventQueueDir);

  if (realBinary === null) {
    appendTrace(
      config.traceLabel,
      `failed to resolve real ${config.displayName} binary`,
    );
    process.stderr.write(
      `Unable to locate the real \`${config.binaryName}\` binary on ${ENV_KEYS.ORIGINAL_PATH}.\n`,
    );
    process.exit(1);
  }

  appendTrace(
    config.traceLabel,
    `launching ${config.displayName} binary ${realBinary}`,
  );
  appendTrace(
    config.traceLabel,
    `wrapper env eventQueueDir=${eventQueueDir || "<missing>"} queueExists=${queueExists} trace=${process.env[ENV_KEYS.TRACE_FILE] || "<missing>"} catalog=${process.env[ENV_KEYS.VISUAL_ASSET_CATALOG_FILE] || "<missing>"} hookState=${process.env[ENV_KEYS.HOOK_STATE_FILE] || "<missing>"} helperBin=${process.env[ENV_KEYS.HELPER_BIN_DIR] || "<missing>"}`,
  );
  publishStatusUpdate(config.status.starting);

  const runtimeContext: AssistantRuntimeContext = {
    originalPath,
    publishStatusUpdate,
    realBinary,
  };
  const runtimeArgs = config.createRuntimeArgs(runtimeContext);
  const cliArgs = [...runtimeArgs, ...process.argv.slice(2)];

  appendTrace(
    config.traceLabel,
    `starting ${config.displayName} with ${cliArgs.length} argv entries ${config.describeRuntime(runtimeArgs, runtimeContext)}`,
  );

  const child = spawnSync(realBinary, cliArgs, {
    stdio: "inherit",
    env: {
      ...process.env,
      PATH: originalPath ?? process.env.PATH ?? "",
    },
  });

  appendTrace(
    config.traceLabel,
    `${config.displayName} finished status=${child.status ?? "null"} signal=${child.signal ?? "null"} error=${
      child.error instanceof Error ? child.error.message : "none"
    } queueExistsAfter=${typeof eventQueueDir === "string" && eventQueueDir.length > 0 && fs.existsSync(eventQueueDir)}`,
  );

  if (child.status === 0) {
    publishStatusUpdate(config.status.disconnected);
  } else {
    publishStatusUpdate(config.status.error);
  }

  if (typeof child.status === "number") {
    process.exit(child.status);
  }

  if (typeof child.signal === "string") {
    process.kill(process.pid, child.signal);
    return;
  }

  if (child.error instanceof Error) {
    process.stderr.write(`${child.error.message}\n`);
  }

  process.exit(1);
}
