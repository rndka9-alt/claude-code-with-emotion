import { ENV_KEYS } from "../../../../shared/env-keys";
import {
  getVisualMcpSetupStatus,
  installVisualMcpUserSetup,
  removeVisualMcpUserSetup,
} from "../../claude-mcp";
import { ensureClaudeHooksSettingsFile } from "../../claude-hooks";
import type { AssistantProvider } from "../provider";

export const claudeAssistantProvider: AssistantProvider = {
  displayName: "Claude Code",
  id: "claude",
  launchCommand: "claude",
  createSessionEnvironment: ({ helperBinDir, userDataPath }) => {
    return {
      [ENV_KEYS.HOOKS_SETTINGS_FILE]: ensureClaudeHooksSettingsFile(
        helperBinDir,
        userDataPath,
      ),
    };
  },
  mcpSetup: {
    getStatus: getVisualMcpSetupStatus,
    install: installVisualMcpUserSetup,
    remove: removeVisualMcpUserSetup,
  },
};
