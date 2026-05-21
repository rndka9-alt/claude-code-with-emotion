const { spawnSync } = require("node:child_process");
const { findExecutableInPath } = require("./helper-bin-resolver");

function appendTrace(traceLabel, message) {
  const traceFilePath = process.env.CLAUDE_WITH_EMOTION_TRACE_FILE;

  if (typeof traceFilePath !== "string" || traceFilePath.length === 0) {
    return;
  }

  const line = `[${new Date().toISOString()}] [${traceLabel}] ${message}\n`;

  try {
    require("node:fs").appendFileSync(traceFilePath, line, "utf8");
  } catch {
    // Ignore trace write failures inside the wrapper.
  }
}

function publishStatus(args) {
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

function publishStatusUpdate(status) {
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
  ]);
}

function runAssistantCliWrapper(config) {
  const originalPath = process.env.CLAUDE_WITH_EMOTION_ORIGINAL_PATH;
  const realBinary = findExecutableInPath(config.binaryName, originalPath);

  if (realBinary === null) {
    appendTrace(
      config.traceLabel,
      `failed to resolve real ${config.displayName} binary`,
    );
    process.stderr.write(
      `Unable to locate the real \`${config.binaryName}\` binary on CLAUDE_WITH_EMOTION_ORIGINAL_PATH.\n`,
    );
    process.exit(1);
  }

  appendTrace(
    config.traceLabel,
    `launching ${config.displayName} binary ${realBinary}`,
  );
  publishStatusUpdate(config.status.starting);

  const runtimeContext = {
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
    }`,
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

module.exports = {
  runAssistantCliWrapper,
};
