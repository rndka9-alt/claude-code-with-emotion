import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  getPlatformHelperBinResolver,
  getPlatformShellAdapter,
} from "../platform";

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
  | "TaskCreated"
  | "TaskCompleted"
  | "PreCompact"
  | "PostCompact"
  | "Stop"
  | "StopFailure"
  | "SessionEnd";

/**
 * Claude Code 공식 훅 이벤트 중 현재 프로젝트가 아직 status 패널로 매핑하지 않은 것들.
 * 타입만 미리 박아두고 실제 등록은 하지 않으므로 런타임·UI 영향 없음.
 *
 * 필요해지면 3곳을 함께 갱신해서 promote:
 *   1. ClaudeHookEvent 유니언으로 이동
 *   2. createClaudeHooksSettings 의 events 배열과 hooks record 에 추가
 *   3. bin/claude-session-hook 의 createUpdate 에 상태 매핑 분기 추가
 */
type ClaudeUnregisteredHookEvent =
  /** CLAUDE.md / rules 파일이 로드된 순간. 세션 시작·/clear 직후 발동. */
  | "InstructionsLoaded"
  /** 설정 파일이 변경된 순간. 신호가 약해 노이즈 위험. */
  | "ConfigChange"
  /** 작업 디렉터리가 바뀐 순간. */
  | "CwdChanged"
  /** 감시 중인 파일이 변경된 순간. 빈번 발동이라 훅 폭탄 주의. */
  | "FileChanged"
  /** 워크트리 생성 시점. */
  | "WorktreeCreate"
  /** 워크트리 제거 시점. */
  | "WorktreeRemove";

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
  const helperBinResolver = getPlatformHelperBinResolver();
  const hookScriptPath = path.join(
    helperBinDir,
    helperBinResolver.getHelperBinFilename("claude-session-hook"),
  );
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
    "TaskCreated",
    "TaskCompleted",
    "PreCompact",
    "PostCompact",
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
      TaskCreated: hooks.TaskCreated ?? [],
      TaskCompleted: hooks.TaskCompleted ?? [],
      PreCompact: hooks.PreCompact ?? [],
      PostCompact: hooks.PostCompact ?? [],
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
