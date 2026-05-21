import type { Mock } from "vitest";
import type { AssistantProviderMetadata } from "../../shared/assistant-provider";
import { createDefaultAssistantStatusSnapshot } from "../../shared/assistant-status";
import {
  createDefaultAppThemeSelection,
  type AppThemeSelection,
} from "../../shared/theme";

const defaultAssistantProvider: AssistantProviderMetadata = {
  displayName: "Claude Code",
  features: {
    sessionStatus: true,
    visualMcpSetup: true,
  },
  id: "claude",
  launchCommand: "claude",
};

const mcpSetupStatus = {
  installed: false,
  stateFilePath: "/tmp/assistant-visual-mcp.json",
  targets: {
    claude: {
      displayName: "Claude Code",
      installed: false,
      stateFilePath: "/tmp/assistant-visual-mcp.json",
      targetId: "claude",
    },
    codex: {
      displayName: "Codex CLI",
      installed: false,
      stateFilePath: "/tmp/assistant-visual-mcp.json",
      targetId: "codex",
    },
  },
} as const;

export function installDisconnectedClaudeApp(
  sendInput: Mock = vi.fn(),
  assistantProvider: AssistantProviderMetadata = defaultAssistantProvider,
): {
  saveThemeSelection: Mock;
} {
  const saveThemeSelection = vi.fn(
    async (selection: AppThemeSelection) => selection,
  );

  Object.defineProperty(window, "claudeApp", {
    configurable: true,
    value: {
      appVersion: "test",
      assistantProvider,
      workspaceCwd: "/tmp/claude-code-with-emotion",
      appTheme: {
        getSelection: vi
          .fn()
          .mockResolvedValue(createDefaultAppThemeSelection()),
        onSelection: vi.fn(() => () => {}),
        saveSelection: saveThemeSelection,
      },
      assistantStatus: {
        getSnapshot: vi
          .fn()
          .mockResolvedValue(createDefaultAssistantStatusSnapshot(Date.now())),
        onSnapshot: vi.fn(() => () => {}),
      },
      diagnostics: {
        onRuntimeEvent: vi.fn(() => () => {}),
      },
      links: {
        openExternal: vi.fn().mockResolvedValue(undefined),
      },
      mcpSetup: {
        getStatus: vi.fn().mockResolvedValue(mcpSetupStatus),
        install: vi.fn().mockResolvedValue({
          ...mcpSetupStatus,
          installed: true,
          targets: {
            ...mcpSetupStatus.targets,
            claude: {
              ...mcpSetupStatus.targets.claude,
              installed: true,
            },
          },
        }),
        remove: vi.fn().mockResolvedValue(mcpSetupStatus),
      },
      terminals: {
        bootstrapSession: vi.fn().mockResolvedValue({
          outputSnapshot: "",
          outputVersion: 0,
        }),
        sendInput,
        resizeSession: vi.fn(),
        closeSession: vi.fn(),
        onOutput: vi.fn(() => () => {}),
        onExit: vi.fn(() => () => {}),
      },
      visualAssets: {
        getAvailableOptions: vi.fn().mockResolvedValue({
          states: [],
          emotions: [],
          emotionDescriptions: {},
        }),
        getCatalog: vi.fn().mockResolvedValue({
          version: 1,
          assets: [],
          mappings: [],
          stateLines: [],
          emotionDescriptions: [],
        }),
        onCatalog: vi.fn(() => () => {}),
        pickFiles: vi.fn().mockResolvedValue([]),
        saveCatalog: vi.fn(),
        printAvailableOptions: vi.fn(),
      },
      workspaceCommands: {
        onOpenTerminalSearch: vi.fn(() => () => {}),
      },
      workspaceWindows: {
        attachWorkspaceStateToWindowAtPoint: vi.fn().mockResolvedValue(false),
        closeCurrentWorkspaceWindow: vi.fn().mockResolvedValue(undefined),
        hideTabDragPreview: vi.fn(),
        moveTabDragPreview: vi.fn(),
        onAttachWorkspaceState: vi.fn(() => () => {}),
        openDetachedWorkspaceWindow: vi.fn().mockResolvedValue(undefined),
        showTabDragPreview: vi.fn(),
      },
    },
  });

  return {
    saveThemeSelection,
  };
}
