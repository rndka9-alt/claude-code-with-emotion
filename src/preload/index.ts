import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { ClaudeAppApi } from '../shared/electron-api';
import {
  ASSISTANT_STATUS_CHANNELS,
  type AssistantStatusSnapshot,
} from '../shared/assistant-status';
import {
  TERMINAL_CHANNELS,
  type TerminalOutputEvent,
} from '../shared/terminal-bridge';

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
  },
};

contextBridge.exposeInMainWorld('claudeApp', claudeAppApi);
