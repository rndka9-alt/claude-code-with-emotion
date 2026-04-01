import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { ClaudeAppApi } from '../shared/electron-api';
import {
  ASSISTANT_STATUS_CHANNELS,
  type AssistantStatusSnapshot,
} from '../shared/assistant-status';
import {
  DIAGNOSTICS_CHANNELS,
  type RendererDiagnosticPayload,
  type RuntimeDiagnosticPayload,
} from '../shared/diagnostics';
import {
  TERMINAL_CHANNELS,
  type TerminalExitEvent,
  type TerminalOutputEvent,
} from '../shared/terminal-bridge';
import {
  VISUAL_ASSET_CHANNELS,
} from '../shared/visual-assets-bridge';
import type { VisualAssetCatalog } from '../shared/visual-assets';

const claudeAppApi: ClaudeAppApi = {
  appVersion: process.versions.electron,
  assistantStatus: {
    getSnapshot: () => {
      return ipcRenderer.invoke(ASSISTANT_STATUS_CHANNELS.getSnapshot);
    },
    onSnapshot: (listener) => {
      const subscription = (
        _event: IpcRendererEvent,
        payload: AssistantStatusSnapshot,
      ) => {
        listener(payload);
      };

      ipcRenderer.on(ASSISTANT_STATUS_CHANNELS.snapshot, subscription);

      return () => {
        ipcRenderer.removeListener(ASSISTANT_STATUS_CHANNELS.snapshot, subscription);
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
        ipcRenderer.removeListener(DIAGNOSTICS_CHANNELS.runtimeEvent, subscription);
      };
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
  type: RendererDiagnosticPayload['type'],
  message: string,
  stack?: string,
): void {
  const payload: RendererDiagnosticPayload = {
    type,
    message,
  };

  if (typeof stack === 'string' && stack.length > 0) {
    payload.stack = stack;
  }

  emitRendererDiagnostic(payload);
}

window.addEventListener('error', (event: ErrorEvent) => {
  emitUnhandledRendererDiagnostic(
    'window-error',
    event.message,
    event.error instanceof Error ? event.error.stack : undefined,
  );
});

window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  const reason = event.reason;
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : JSON.stringify(reason);

  emitUnhandledRendererDiagnostic(
    'unhandled-rejection',
    message,
    reason instanceof Error ? reason.stack : undefined,
  );
});

contextBridge.exposeInMainWorld('claudeApp', claudeAppApi);
