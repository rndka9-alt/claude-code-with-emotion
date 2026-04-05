import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getPlatformShellAdapter } from "../platform/platform-shell-adapter";

type ClaudeHookEvent =
  | "SessionStart"
  | "UserPromptSubmit"
  | "PermissionRequest"
  | "PermissionDenied"
  | "PreToolUse"
  | "PostToolUse"
  | "PostToolUseFailure"
  | "Notification"
  | "Elicitation"
  | "ElicitationResult"
  | "SubagentStart"
  | "SubagentStop"
  | "TeammateIdle"
  | "TaskCompleted"
  | "Stop"
  | "StopFailure"
  | "SessionEnd";

interface ClaudeHookCommandConfig {
  type: "command";
  command: string;
}

interface ClaudeHookMatcherConfig {
  matcher: "";
  hooks: ClaudeHookCommandConfig[];
}

interface ClaudePermissionsConfig {
  allow: string[];
}

interface ClaudeHooksSettings {
  hooks: Record<ClaudeHookEvent, ClaudeHookMatcherConfig[]>;
  permissions: ClaudePermissionsConfig;
}

function getHooksSettingsDir(homeDir: string): string {
  return path.join(
    os.tmpdir(),
    "claude-code-with-emotion-hooks",
    Buffer.from(homeDir).toString("hex"),
  );
}

export function buildClaudeHookCommand(
  helperBinDir: string,
  eventName: ClaudeHookEvent,
): string {
  const hookScriptPath = path.join(helperBinDir, "claude-session-hook");
  const shellAdapter = getPlatformShellAdapter();

  return `${shellAdapter.quoteForHookCommand(hookScriptPath)} ${shellAdapter.quoteForHookCommand(eventName)}`;
}

export function createClaudeHooksSettings(
  helperBinDir: string,
): ClaudeHooksSettings {
  const events: ClaudeHookEvent[] = [
    "SessionStart",
    "UserPromptSubmit",
    "PermissionRequest",
    "PermissionDenied",
    "PreToolUse",
    "PostToolUse",
    "PostToolUseFailure",
    "Notification",
    "Elicitation",
    "ElicitationResult",
    "SubagentStart",
    "SubagentStop",
    "TeammateIdle",
    "TaskCompleted",
    "Stop",
    "StopFailure",
    "SessionEnd",
  ];
  const hooks: Partial<Record<ClaudeHookEvent, ClaudeHookMatcherConfig[]>> = {};

  for (const eventName of events) {
    hooks[eventName] = [
      {
        matcher: "",
        hooks: [
          {
            type: "command",
            command: buildClaudeHookCommand(helperBinDir, eventName),
          },
        ],
      },
    ];
  }

  const visualMcpServerName = "claude-code-with-emotion-visuals";
  const visualMcpToolNames = [
    "get_available_visual_options",
    "set_visual_overlay",
  ];

  return {
    permissions: {
      allow: visualMcpToolNames.map(
        (tool) => `mcp__${visualMcpServerName}__${tool}`,
      ),
    },
    hooks: {
      SessionStart: hooks.SessionStart ?? [],
      UserPromptSubmit: hooks.UserPromptSubmit ?? [],
      PermissionRequest: hooks.PermissionRequest ?? [],
      PermissionDenied: hooks.PermissionDenied ?? [],
      PreToolUse: hooks.PreToolUse ?? [],
      PostToolUse: hooks.PostToolUse ?? [],
      PostToolUseFailure: hooks.PostToolUseFailure ?? [],
      Notification: hooks.Notification ?? [],
      Elicitation: hooks.Elicitation ?? [],
      ElicitationResult: hooks.ElicitationResult ?? [],
      SubagentStart: hooks.SubagentStart ?? [],
      SubagentStop: hooks.SubagentStop ?? [],
      TeammateIdle: hooks.TeammateIdle ?? [],
      TaskCompleted: hooks.TaskCompleted ?? [],
      Stop: hooks.Stop ?? [],
      StopFailure: hooks.StopFailure ?? [],
      SessionEnd: hooks.SessionEnd ?? [],
    },
  };
}

export function ensureClaudeHooksSettingsFile(
  helperBinDir: string,
  homeDir: string,
): string {
  const settingsDir = getHooksSettingsDir(homeDir);
  const settingsFilePath = path.join(settingsDir, "settings.json");
  const settingsJson = JSON.stringify(
    createClaudeHooksSettings(helperBinDir),
    null,
    2,
  );

  fs.mkdirSync(settingsDir, { recursive: true });
  fs.writeFileSync(settingsFilePath, settingsJson, "utf8");

  return settingsFilePath;
}
