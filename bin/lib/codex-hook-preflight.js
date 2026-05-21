const path = require("node:path");
const { spawnSync } = require("node:child_process");

const HOOK_EVENTS = [
  { event: "SessionStart", matcher: "startup|resume|clear" },
  { event: "UserPromptSubmit" },
  { event: "PermissionRequest" },
  { event: "PreToolUse", matcher: "Bash|apply_patch|mcp__.*" },
  { event: "PostToolUse", matcher: "Bash|apply_patch|mcp__.*" },
  { event: "PreCompact" },
  { event: "PostCompact" },
  { event: "Stop" },
];

function readOutput(value) {
  if (typeof value === "string") {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }

  return "";
}

function createCodexEnv(originalPath) {
  return {
    ...process.env,
    PATH: originalPath ?? process.env.PATH ?? "",
  };
}

function quoteTomlString(value) {
  return JSON.stringify(value);
}

function quoteShellPath(value) {
  if (process.platform === "win32") {
    return `"${value.replaceAll('"', '\\"')}"`;
  }

  return `'${value.replaceAll("'", "'\\''")}'`;
}

function createHookCommand(eventName) {
  const hookPath = path.join(__dirname, "..", "codex-hook");

  return [
    quoteShellPath(process.execPath),
    quoteShellPath(hookPath),
    "--source",
    "claude-code-with-emotion",
  ].join(" ");
}

function createHookConfigValue(eventConfig) {
  const fields = [];
  const hookCommand = createHookCommand(eventConfig.event);

  if (typeof eventConfig.matcher === "string") {
    fields.push(`matcher=${quoteTomlString(eventConfig.matcher)}`);
  }

  fields.push(
    `hooks=[{type="command", command=${quoteTomlString(
      hookCommand,
    )}, timeout=5, statusMessage="Syncing claude-code-with-emotion status"}]`,
  );

  return `[{${fields.join(", ")}}]`;
}

function createHookRuntimeArgs() {
  const args = [];

  for (const eventConfig of HOOK_EVENTS) {
    args.push(
      "-c",
      `hooks.${eventConfig.event}=${createHookConfigValue(eventConfig)}`,
    );
  }

  return args;
}

function parseHooksFeatureState(stdout) {
  for (const line of stdout.split(/\r?\n/)) {
    const columns = line.trim().split(/\s+/);

    if (columns[0] === "hooks") {
      return columns.at(-1) === "true";
    }
  }

  return false;
}

function publishPreflightStatus(publishStatusUpdate, status) {
  if (typeof publishStatusUpdate !== "function") {
    return;
  }

  publishStatusUpdate({
    state: "working",
    activity: "Codex hook preflight",
    line: status.line,
    task: status.task,
    intensity: status.intensity,
  });
}

function createCodexHookRuntime(realBinary, originalPath, publishStatusUpdate) {
  const env = createCodexEnv(originalPath);
  const versionCheck = spawnSync(realBinary, ["--version"], {
    encoding: "utf8",
    env,
  });

  if (versionCheck.status !== 0) {
    const output =
      readOutput(versionCheck.stderr).trim() ||
      readOutput(versionCheck.stdout).trim();

    publishPreflightStatus(publishStatusUpdate, {
      line:
        output.length > 0
          ? `Codex hook preflight가 실패햇어요. codex --version 출력: ${output}`
          : "Codex hook preflight가 실패햇어요. codex --version을 실행하지 못햇어요.",
      task: "Codex hook preflight failed before launch",
      intensity: "medium",
    });

    return {
      description: "hooks=preflight-failed",
      runtimeArgs: [],
    };
  }

  const featuresCheck = spawnSync(realBinary, ["features", "list"], {
    encoding: "utf8",
    env,
  });

  if (featuresCheck.status !== 0) {
    publishPreflightStatus(publishStatusUpdate, {
      line: "Codex hook 상태를 확인하지 못해서 내부 이벤트 보강 없이 실행해요.",
      task: "Codex hooks feature check failed",
      intensity: "medium",
    });

    return {
      description: "hooks=feature-check-failed",
      runtimeArgs: [],
    };
  }

  if (!parseHooksFeatureState(readOutput(featuresCheck.stdout))) {
    publishPreflightStatus(publishStatusUpdate, {
      line: "Codex hook 기능이 꺼져 있어서 내부 이벤트 보강 없이 실행해요.",
      task: "Codex hooks feature is disabled",
      intensity: "medium",
    });

    return {
      description: "hooks=disabled",
      runtimeArgs: [],
    };
  }

  publishPreflightStatus(publishStatusUpdate, {
    line: "Codex hook 보강을 실행 인자에 주입햇어요. /hooks 신뢰 확인이 필요할 수 있어요.",
    task: "Codex hook runtime config injected",
    intensity: "medium",
  });

  return {
    description: "hooks=runtime-injected",
    runtimeArgs: createHookRuntimeArgs(),
  };
}

module.exports = {
  createCodexHookRuntime,
};
