import { createDefaultAssistantStatusSnapshot } from '../../shared/assistant-status';

export function installDisconnectedClaudeApp(sendInput = vi.fn()): void {
  Object.defineProperty(window, 'claudeApp', {
    configurable: true,
    value: {
      appVersion: 'test',
      assistantStatus: {
        getSnapshot: vi
          .fn()
          .mockResolvedValue(createDefaultAssistantStatusSnapshot(Date.now())),
        onSnapshot: vi.fn(() => () => {}),
      },
      diagnostics: {
        onRuntimeEvent: vi.fn(() => () => {}),
      },
      terminals: {
        bootstrapSession: vi.fn().mockResolvedValue({ initialOutput: '' }),
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
        }),
        getCatalog: vi.fn().mockResolvedValue({ version: 1, assets: [], mappings: [] }),
        onCatalog: vi.fn(() => () => {}),
        pickFiles: vi.fn().mockResolvedValue([]),
        saveCatalog: vi.fn(),
        printAvailableOptions: vi.fn(),
      },
    },
  });
}
