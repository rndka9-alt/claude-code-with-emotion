import type {
  VisualMcpSetupOverview,
  VisualMcpSetupTargetId,
  VisualMcpSetupTargetStatus,
} from "../../shared/mcp-setup-bridge";
import {
  getVisualMcpSetupStatus as getClaudeVisualMcpSetupStatus,
  installVisualMcpUserSetup as installClaudeVisualMcpUserSetup,
  removeVisualMcpUserSetup as removeClaudeVisualMcpUserSetup,
} from "./assistant-provider";
import {
  getCodexVisualMcpSetupStatus,
  installCodexVisualMcpUserSetup,
  removeCodexVisualMcpUserSetup,
} from "./codex-mcp";

function toClaudeTargetStatus(
  status: ReturnType<typeof getClaudeVisualMcpSetupStatus>,
): VisualMcpSetupTargetStatus {
  return {
    displayName: "Claude Code",
    installed: status.installed,
    stateFilePath: status.stateFilePath,
    targetId: "claude",
  };
}

function createVisualMcpSetupStatus(
  claude: VisualMcpSetupTargetStatus,
  codex: VisualMcpSetupTargetStatus,
): VisualMcpSetupOverview {
  return {
    installed: claude.installed,
    stateFilePath: claude.stateFilePath,
    targets: {
      claude,
      codex,
    },
  };
}

export function getVisualMcpSetupStatus(
  stateFilePath: string,
): VisualMcpSetupOverview {
  return createVisualMcpSetupStatus(
    toClaudeTargetStatus(getClaudeVisualMcpSetupStatus(stateFilePath)),
    getCodexVisualMcpSetupStatus(stateFilePath),
  );
}

export function installVisualMcpUserSetup(
  helperBinDir: string,
  stateFilePath: string,
  targetId: VisualMcpSetupTargetId = "claude",
): VisualMcpSetupOverview {
  if (targetId === "codex") {
    installCodexVisualMcpUserSetup(helperBinDir, stateFilePath);
  } else {
    installClaudeVisualMcpUserSetup(helperBinDir, stateFilePath);
  }

  return getVisualMcpSetupStatus(stateFilePath);
}

export function removeVisualMcpUserSetup(
  stateFilePath: string,
  targetId: VisualMcpSetupTargetId = "claude",
): VisualMcpSetupOverview {
  if (targetId === "codex") {
    removeCodexVisualMcpUserSetup(stateFilePath);
  } else {
    removeClaudeVisualMcpUserSetup(stateFilePath);
  }

  return getVisualMcpSetupStatus(stateFilePath);
}
