import type { Mock } from "vitest";
import { createDefaultAssistantStatusSnapshot } from "../../shared/assistant-status";
import {
  createDefaultAppThemeSelection,
  type AppThemeSelection,
} from "../../shared/theme";

export function installDisconnectedClaudeApp(sendInput: Mock = vi.fn()): {
  saveThemeSelection: Mock;
} {
  const saveThemeSelection = vi.fn(
    async (selection: AppThemeSelection) => selection,
  );

  Object.defineProperty(window, "claudeApp", {
    configurable: true,
    value: {
      appVersion: "test",
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
        getStatus: vi.fn().mockResolvedValue({
          installed: false,
          stateFilePath: "/tmp/assistant-visual-mcp.json",
        }),
        install: vi.fn().mockResolvedValue({
          installed: true,
          stateFilePath: "/tmp/assistant-visual-mcp.json",
        }),
        remove: vi.fn().mockResolvedValue({
          installed: false,
          stateFilePath: "/tmp/assistant-visual-mcp.json",
        }),
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
    },
  });

  return {
    saveThemeSelection,
  };
}
