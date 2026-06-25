import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { ENV_KEYS } from "../shared/env-keys";

interface CodexStatusUpdate {
  activity: string;
  intensity: string;
  line: string;
  state: string;
  task: string;
}

const ENV_KEY_BY_RUNTIME_FLAG: Record<string, string> = {
  "--assistant-provider-id": ENV_KEYS.ASSISTANT_PROVIDER_ID,
  "--event-queue-dir": ENV_KEYS.EVENT_QUEUE_DIR,
  "--helper-bin-dir": ENV_KEYS.HELPER_BIN_DIR,
  "--hook-state-file": ENV_KEYS.HOOK_STATE_FILE,
  "--trace-file": ENV_KEYS.TRACE_FILE,
  "--visual-asset-catalog-file": ENV_KEYS.VISUAL_ASSET_CATALOG_FILE,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStdin(): string {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function parseHookInput(): Record<string, unknown> {
  const input = readStdin().trim();

  if (input.length === 0) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(input);

    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function applyRuntimeArgs(argv: string[]): void {
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const envKey =
      typeof key === "string" ? ENV_KEY_BY_RUNTIME_FLAG[key] : undefined;

    if (envKey === undefined) {
      if (key === "--source" || key === "--hook-event") {
        index += 1;
      }

      continue;
    }

    const value = argv[index + 1];

    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`${key} requires a non-empty value.`);
    }

    process.env[envKey] = value;
    index += 1;
  }
}

function appendTrace(message: string): void {
  const traceFilePath = process.env[ENV_KEYS.TRACE_FILE];

  if (typeof traceFilePath !== "string" || traceFilePath.length === 0) {
    return;
  }

  const line = `[${new Date().toISOString()}] [codex-hook] ${message}\n`;

  try {
    fs.appendFileSync(traceFilePath, line, "utf8");
  } catch {
    // Trace failures must not block Codex hook delivery.
  }
}

function collectPayloadIdentityCandidates(
  value: unknown,
  pathParts: string[] = [],
): string[] {
  if (pathParts.length > 6 || !isRecord(value)) {
    return [];
  }

  const candidates: string[] = [];

  for (const [key, nestedValue] of Object.entries(value)) {
    const nextPathParts = [...pathParts, key];
    const pathText = nextPathParts.join(".");

    if (
      /(session|thread|conversation|turn|id)$/i.test(key) &&
      typeof nestedValue === "string" &&
      nestedValue.length > 0
    ) {
      candidates.push(`${pathText}=${nestedValue.slice(0, 120)}`);
    }

    if (isRecord(nestedValue) && candidates.length < 24) {
      candidates.push(
        ...collectPayloadIdentityCandidates(nestedValue, nextPathParts),
      );
    }

    if (candidates.length >= 24) {
      return candidates.slice(0, 24);
    }
  }

  return candidates;
}

function traceHookInput(hookInput: Record<string, unknown>): void {
  const topLevelKeys = Object.keys(hookInput);
  const eventName =
    typeof hookInput.hook_event_name === "string"
      ? hookInput.hook_event_name
      : "unknown";
  const candidates = collectPayloadIdentityCandidates(hookInput);
  const eventQueueDir = process.env[ENV_KEYS.EVENT_QUEUE_DIR];
  const helperBinDir = process.env[ENV_KEYS.HELPER_BIN_DIR];
  const traceFilePath = process.env[ENV_KEYS.TRACE_FILE];

  appendTrace(
    [
      `payload event=${eventName}`,
      `topKeys=${topLevelKeys.join(",") || "none"}`,
      `eventQueueDir=${eventQueueDir || "<missing>"}`,
      `helperBin=${helperBinDir || "<missing>"}`,
      `trace=${traceFilePath || "<missing>"}`,
      `identityCandidates=${JSON.stringify(candidates)}`,
    ].join(" "),
  );
}

function publishStatus(args: string[]): void {
  const helperBinDir = process.env[ENV_KEYS.HELPER_BIN_DIR];

  if (typeof helperBinDir === "string" && helperBinDir.length > 0) {
    spawnSync(
      process.execPath,
      [path.join(helperBinDir, "claude-status"), ...args],
      {
        stdio: "ignore",
      },
    );
    return;
  }

  spawnSync("claude-status", args, { stdio: "ignore" });
}

function resolveStatusForEvent(
  hookInput: Record<string, unknown>,
): CodexStatusUpdate | null {
  const eventName =
    typeof hookInput.hook_event_name === "string"
      ? hookInput.hook_event_name
      : "unknown";
  const toolName =
    typeof hookInput.tool_name === "string" ? hookInput.tool_name : null;

  if (eventName === "SessionStart") {
    return {
      state: "waiting",
      line: "Codex hook 연결 완료! 다음 입력을 기다리고 있어요...!",
      activity: "다음 입력 기다리는 중",
      task: "Waiting for the next prompt",
      intensity: "low",
    };
  }

  if (eventName === "UserPromptSubmit") {
    return {
      state: "thinking",
      line: "Codex CLI가 쭈인님 요청을 읽고 있어요...!",
      activity: "요청 분석 중",
      task: "Codex user prompt submitted",
      intensity: "medium",
    };
  }

  if (eventName === "PermissionRequest") {
    return {
      state: "permission_wait",
      line: "Codex CLI가 권한 확인을 기다리고 있어요...!",
      activity: "권한 확인 대기",
      task: "Codex permission request received",
      intensity: "high",
    };
  }

  if (eventName === "PreToolUse") {
    return {
      state: "working",
      line:
        toolName === null
          ? "Codex CLI가 도구 실행을 준비 중이에요...!"
          : `Codex CLI가 ${toolName} 도구를 준비 중이에요...!`,
      activity: "도구 실행 준비",
      task:
        toolName === null
          ? "Codex tool use is starting"
          : `Codex tool use is starting: ${toolName}`,
      intensity: "medium",
    };
  }

  if (eventName === "PostToolUse") {
    return {
      state: "thinking",
      line:
        toolName === null
          ? "Codex CLI가 방금 가져온 결과를 정리 중이에요...!"
          : `Codex CLI가 ${toolName} 결과를 정리 중이에요...!`,
      activity: "결과를 정리하는 중",
      task:
        toolName === null
          ? "Reviewing Codex tool output"
          : `Reviewing Codex tool output: ${toolName}`,
      intensity: "medium",
    };
  }

  if (eventName === "PreCompact") {
    return {
      state: "compacting",
      line: "Codex CLI가 대화 맥락을 압축하는 중이에요...!",
      activity: "컨텍스트 압축 중",
      task: "Codex context compaction started",
      intensity: "medium",
    };
  }

  if (eventName === "PostCompact") {
    return {
      state: "completed",
      line: "Codex CLI가 대화 맥락 압축을 마쳣어요...!",
      activity: "컨텍스트 압축 완료",
      task: "Codex context compaction completed",
      intensity: "low",
    };
  }

  if (eventName === "Stop") {
    return {
      state: "waiting",
      line: "Codex CLI 응답을 마치고 다음 입력을 기다리고 있어요...!",
      activity: "다음 입력 기다리는 중",
      task: "Waiting for the next prompt",
      intensity: "low",
    };
  }

  return null;
}

function main(): void {
  applyRuntimeArgs(process.argv.slice(2));

  const hookInput = parseHookInput();

  traceHookInput(hookInput);

  const status = resolveStatusForEvent(hookInput);

  if (status !== null) {
    publishStatus([
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
      "--provider",
      "codex",
    ]);
  }
}

main();
