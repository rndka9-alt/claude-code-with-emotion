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
const ENV_KEYS = {
  ASSISTANT_PROVIDER_ID: "CLAUDE_WITH_EMOTION_ASSISTANT_PROVIDER_ID",
  EVENT_QUEUE_DIR: "CLAUDE_WITH_EMOTION_EVENT_QUEUE_DIR",
  HELPER_BIN_DIR: "CLAUDE_WITH_EMOTION_HELPER_BIN_DIR",
  HOOK_STATE_FILE: "CLAUDE_WITH_EMOTION_HOOK_STATE_FILE",
  TRACE_FILE: "CLAUDE_WITH_EMOTION_TRACE_FILE",
  VISUAL_ASSET_CATALOG_FILE: "CLAUDE_WITH_EMOTION_VISUAL_ASSET_CATALOG_FILE",
};
const RUNTIME_FLAG_BY_ENV_KEY = {
  [ENV_KEYS.ASSISTANT_PROVIDER_ID]: "--assistant-provider-id",
  [ENV_KEYS.EVENT_QUEUE_DIR]: "--event-queue-dir",
  [ENV_KEYS.HELPER_BIN_DIR]: "--helper-bin-dir",
  [ENV_KEYS.HOOK_STATE_FILE]: "--hook-state-file",
  [ENV_KEYS.TRACE_FILE]: "--trace-file",
  [ENV_KEYS.VISUAL_ASSET_CATALOG_FILE]: "--visual-asset-catalog-file",
};

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

function appendRuntimeFlag(parts, flag, value) {
  if (typeof value !== "string" || value.length === 0) {
    return;
  }

  parts.push(flag, quoteShellPath(value));
}

function createHookCommand(eventName, env = process.env) {
  const hookPath = path.join(__dirname, "..", "codex-hook");
  const parts = [
    quoteShellPath(process.execPath),
    quoteShellPath(hookPath),
    "--source",
    "claude-code-with-emotion",
    "--hook-event",
    eventName,
  ];

  appendRuntimeFlag(
    parts,
    RUNTIME_FLAG_BY_ENV_KEY[ENV_KEYS.ASSISTANT_PROVIDER_ID],
    "codex",
  );

  for (const envKey of [
    ENV_KEYS.EVENT_QUEUE_DIR,
    ENV_KEYS.HELPER_BIN_DIR,
    ENV_KEYS.HOOK_STATE_FILE,
    ENV_KEYS.TRACE_FILE,
    ENV_KEYS.VISUAL_ASSET_CATALOG_FILE,
  ]) {
    appendRuntimeFlag(parts, RUNTIME_FLAG_BY_ENV_KEY[envKey], env[envKey]);
  }

  return parts.join(" ");
}

function createHookConfigValue(eventConfig, env = process.env) {
  const fields = [];
  const hookCommand = createHookCommand(eventConfig.event, env);

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
      `hooks.${eventConfig.event}=${createHookConfigValue(
        eventConfig,
        process.env,
      )}`,
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

function createCodexHookRuntime(realBinary, originalPath) {
  const env = createCodexEnv(originalPath);
  const versionCheck = spawnSync(realBinary, ["--version"], {
    encoding: "utf8",
    env,
  });

  if (versionCheck.status !== 0) {
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
    return {
      description: "hooks=feature-check-failed",
      runtimeArgs: [],
    };
  }

  if (!parseHooksFeatureState(readOutput(featuresCheck.stdout))) {
    return {
      description: "hooks=disabled",
      runtimeArgs: [],
    };
  }

  return {
    description: "hooks=runtime-injected",
    runtimeArgs: createHookRuntimeArgs(),
  };
}

module.exports = {
  createCodexHookRuntime,
};
