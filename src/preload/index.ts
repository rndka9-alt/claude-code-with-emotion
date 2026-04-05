import {
  contextBridge,
  ipcRenderer,
  webUtils,
  type IpcRendererEvent,
} from "electron";
import os from "node:os";
import type { ClaudeAppApi } from "../shared/electron-api";
import { APP_THEME_CHANNELS } from "../shared/app-theme-bridge";
import type { AppThemeSelection } from "../shared/theme";
import {
  ASSISTANT_STATUS_CHANNELS,
  type AssistantStatusSnapshotEvent,
  type AssistantStatusSnapshot,
} from "../shared/assistant-status";
import {
  DIAGNOSTICS_CHANNELS,
  type RendererDiagnosticPayload,
  type RuntimeDiagnosticPayload,
} from "../shared/diagnostics";
import { LINKS_CHANNELS } from "../shared/links-bridge";
import { MCP_SETUP_CHANNELS } from "../shared/mcp-setup-bridge";
import {
  TERMINAL_CHANNELS,
  type TerminalExitEvent,
  type TerminalOutputEvent,
} from "../shared/terminal-bridge";
import { VISUAL_ASSET_CHANNELS } from "../shared/visual-assets-bridge";
import type { VisualAssetCatalog } from "../shared/visual-assets";

// Finder 에서 실행한 패키지 앱은 process.cwd() 가 `/` 로 설정돼서 터미널이 루트에서 열린다.
// 유저 홈 디렉터리를 기본 cwd 로 고정해, 개발(npm run dev) 환경과 패키징 환경 모두 홈에서 시작하도록 맞춘다.
const claudeAppApi: ClaudeAppApi = {
  appVersion: process.versions.electron,
  workspaceCwd: os.homedir(),
  appTheme: {
    getSelection: () => {
      return ipcRenderer.invoke(APP_THEME_CHANNELS.getSelection);
    },
    onSelection: (listener) => {
      const subscription = (
        _event: IpcRendererEvent,
        payload: AppThemeSelection,
      ) => {
        listener(payload);
      };

      ipcRenderer.on(APP_THEME_CHANNELS.selection, subscription);

      return () => {
        ipcRenderer.removeListener(APP_THEME_CHANNELS.selection, subscription);
      };
    },
    saveSelection: (selection) => {
      return ipcRenderer.invoke(APP_THEME_CHANNELS.saveSelection, selection);
    },
  },
  assistantStatus: {
    getSnapshot: (request) => {
      return ipcRenderer.invoke(ASSISTANT_STATUS_CHANNELS.getSnapshot, request);
    },
    onSnapshot: (request, listener) => {
      const subscription = (
        _event: IpcRendererEvent,
        payload: AssistantStatusSnapshotEvent,
      ) => {
        if (payload.sessionId === request.sessionId) {
          listener(payload.snapshot);
        }
      };

      ipcRenderer.on(ASSISTANT_STATUS_CHANNELS.snapshot, subscription);

      return () => {
        ipcRenderer.removeListener(
          ASSISTANT_STATUS_CHANNELS.snapshot,
          subscription,
        );
      };
    },
  },
  diagnostics: {
    onRuntimeEvent: (listener) => {
      const subscription = (
        _event: IpcRendererEvent,
        payload: RuntimeDiagnosticPayload,
      ) => {
        listener(payload);
      };

      ipcRenderer.on(DIAGNOSTICS_CHANNELS.runtimeEvent, subscription);

      return () => {
        ipcRenderer.removeListener(
          DIAGNOSTICS_CHANNELS.runtimeEvent,
          subscription,
        );
      };
    },
  },
  links: {
    openExternal: (url) => {
      return ipcRenderer.invoke(LINKS_CHANNELS.openExternal, url);
    },
  },
  mcpSetup: {
    getStatus: () => {
      return ipcRenderer.invoke(MCP_SETUP_CHANNELS.getStatus);
    },
    install: () => {
      return ipcRenderer.invoke(MCP_SETUP_CHANNELS.install);
    },
    remove: () => {
      return ipcRenderer.invoke(MCP_SETUP_CHANNELS.remove);
    },
  },
  terminals: {
    bootstrapSession: (request) => {
      return ipcRenderer.invoke(TERMINAL_CHANNELS.bootstrap, request);
    },
    sendInput: async (request) => {
      await ipcRenderer.invoke(TERMINAL_CHANNELS.input, request);
    },
    resizeSession: async (request) => {
      await ipcRenderer.invoke(TERMINAL_CHANNELS.resize, request);
    },
    closeSession: async (request) => {
      await ipcRenderer.invoke(TERMINAL_CHANNELS.close, request);
    },
    onOutput: (listener) => {
      const subscription = (
        _event: IpcRendererEvent,
        payload: TerminalOutputEvent,
      ) => {
        listener(payload);
      };

      ipcRenderer.on(TERMINAL_CHANNELS.output, subscription);

      return () => {
        ipcRenderer.removeListener(TERMINAL_CHANNELS.output, subscription);
      };
    },
    onExit: (listener) => {
      const subscription = (
        _event: IpcRendererEvent,
        payload: TerminalExitEvent,
      ) => {
        listener(payload);
      };

      ipcRenderer.on(TERMINAL_CHANNELS.exit, subscription);

      return () => {
        ipcRenderer.removeListener(TERMINAL_CHANNELS.exit, subscription);
      };
    },
  },
  visualAssets: {
    getAvailableOptions: () => {
      return ipcRenderer.invoke(VISUAL_ASSET_CHANNELS.getAvailableOptions);
    },
    getCatalog: () => {
      return ipcRenderer.invoke(VISUAL_ASSET_CHANNELS.getCatalog);
    },
    getPathForFile: (file) => {
      return webUtils.getPathForFile(file);
    },
    importFiles: (filePaths) => {
      return ipcRenderer.invoke(VISUAL_ASSET_CHANNELS.importFiles, filePaths);
    },
    onCatalog: (listener) => {
      const subscription = (
        _event: IpcRendererEvent,
        payload: VisualAssetCatalog,
      ) => {
        listener(payload);
      };

      ipcRenderer.on(VISUAL_ASSET_CHANNELS.catalog, subscription);

      return () => {
        ipcRenderer.removeListener(VISUAL_ASSET_CHANNELS.catalog, subscription);
      };
    },
    pickFiles: () => {
      return ipcRenderer.invoke(VISUAL_ASSET_CHANNELS.pickFiles);
    },
    printAvailableOptions: () => {
      return ipcRenderer.invoke(VISUAL_ASSET_CHANNELS.printAvailableOptions);
    },
    saveCatalog: (catalog) => {
      return ipcRenderer.invoke(VISUAL_ASSET_CHANNELS.saveCatalog, catalog);
    },
  },
};

function emitRendererDiagnostic(payload: RendererDiagnosticPayload): void {
  ipcRenderer.send(DIAGNOSTICS_CHANNELS.rendererEvent, payload);
}

function emitUnhandledRendererDiagnostic(
  type: RendererDiagnosticPayload["type"],
  message: string,
  stack?: string,
): void {
  const payload: RendererDiagnosticPayload = {
    type,
    message,
  };

  if (typeof stack === "string" && stack.length > 0) {
    payload.stack = stack;
  }

  emitRendererDiagnostic(payload);
}

window.addEventListener("error", (event: ErrorEvent) => {
  const locationSuffix =
    typeof event.filename === "string" && event.filename.length > 0
      ? ` @ ${event.filename}:${event.lineno}:${event.colno}`
      : "";

  emitUnhandledRendererDiagnostic(
    "window-error",
    `${event.message}${locationSuffix}`,
    event.error instanceof Error ? event.error.stack : undefined,
  );
});

window.addEventListener(
  "unhandledrejection",
  (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : JSON.stringify(reason);

    emitUnhandledRendererDiagnostic(
      "unhandled-rejection",
      message,
      reason instanceof Error ? reason.stack : undefined,
    );
  },
);

contextBridge.exposeInMainWorld("claudeApp", claudeAppApi);
