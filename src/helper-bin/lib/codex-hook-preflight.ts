import path from "node:path";
import { spawnSync } from "node:child_process";
import { ENV_KEYS } from "../../shared/env-keys";

interface CodexHookEvent {
  event: string;
  matcher?: string;
}

const HOOK_EVENTS: ReadonlyArray<CodexHookEvent> = [
  { event: "SessionStart", matcher: "startup|resume|clear" },
  { event: "UserPromptSubmit" },
  { event: "PermissionRequest" },
  { event: "PreToolUse", matcher: "Bash|apply_patch|mcp__.*" },
  { event: "PostToolUse", matcher: "Bash|apply_patch|mcp__.*" },
  { event: "PreCompact" },
  { event: "PostCompact" },
  { event: "Stop" },
];

const RUNTIME_FLAG_BY_ENV_KEY: ReadonlyArray<[string, string]> = [
  [ENV_KEYS.EVENT_QUEUE_DIR, "--event-queue-dir"],
  [ENV_KEYS.HELPER_BIN_DIR, "--helper-bin-dir"],
  [ENV_KEYS.HOOK_STATE_FILE, "--hook-state-file"],
  [ENV_KEYS.TRACE_FILE, "--trace-file"],
  [ENV_KEYS.VISUAL_ASSET_CATALOG_FILE, "--visual-asset-catalog-file"],
];

interface CodexHookRuntime {
  description: string;
  runtimeArgs: string[];
}

function readOutput(value: string | Buffer): string {
  if (typeof value === "string") {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }

  return "";
}

function createCodexEnv(originalPath: string | undefined): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: originalPath ?? process.env.PATH ?? "",
  };
}

function quoteTomlString(value: string): string {
  return JSON.stringify(value);
}

function quoteShellPath(value: string): string {
  // win32 분기는 best-effort·미유지보수다(CLAUDE.md Platform Support).
  if (process.platform === "win32") {
    return `"${value.replaceAll('"', '\\"')}"`;
  }

  return `'${value.replaceAll("'", "'\\''")}'`;
}

function appendRuntimeFlag(
  commandParts: string[],
  flag: string,
  value: string | undefined,
): void {
  if (typeof value !== "string" || value.length === 0) {
    return;
  }

  commandParts.push(flag, quoteShellPath(value));
}

function createHookCommand(env: NodeJS.ProcessEnv = process.env): string {
  // 번들 후 이 코드는 entry(bin/codex)에 인라인되어 __dirname 이 bin/ 이 된다.
  // codex-hook 헬퍼도 같은 bin/ 에 놓이므로 형제 경로로 참조한다.
  const hookPath = path.join(__dirname, "codex-hook");
  const commandParts = [
    quoteShellPath(process.execPath),
    quoteShellPath(hookPath),
    "--source",
    "claude-code-with-emotion",
  ];

  for (const [envKey, flag] of RUNTIME_FLAG_BY_ENV_KEY) {
    appendRuntimeFlag(commandParts, flag, env[envKey]);
  }

  appendRuntimeFlag(
    commandParts,
    "--assistant-provider-id",
    env[ENV_KEYS.ASSISTANT_PROVIDER_ID] || "codex",
  );

  return commandParts.join(" ");
}

function createHookConfigValue(
  eventConfig: CodexHookEvent,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const fields: string[] = [];
  const hookCommand = createHookCommand(env);

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

function createHookRuntimeArgs(env: NodeJS.ProcessEnv = process.env): string[] {
  const args: string[] = [];

  for (const eventConfig of HOOK_EVENTS) {
    args.push(
      "-c",
      `hooks.${eventConfig.event}=${createHookConfigValue(eventConfig, env)}`,
    );
  }

  return args;
}

function parseHooksFeatureState(stdout: string): boolean {
  for (const line of stdout.split(/\r?\n/)) {
    const columns = line.trim().split(/\s+/);

    if (columns[0] === "hooks") {
      return columns.at(-1) === "true";
    }
  }

  return false;
}

export function createCodexHookRuntime(
  realBinary: string,
  originalPath: string | undefined,
): CodexHookRuntime {
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
    description: "hooks=runtime-injected-session-command",
    runtimeArgs: createHookRuntimeArgs(process.env),
  };
}
