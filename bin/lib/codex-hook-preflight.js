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

function createHookCommand() {
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
  const hookCommand = createHookCommand();

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
  // Keep the hook command stable so Codex hook trust does not churn per session.
  const args = ["-c", 'shell_environment_policy.inherit="all"'];

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
