import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { AssistantStatusFileBridge } from './status/assistant-status-file-bridge';
import { AssistantStatusStore } from './status/assistant-status-store';
import { createTerminalSessionManager } from './terminal/session-manager';
import {
  ASSISTANT_STATUS_CHANNELS,
  type AssistantStatusSnapshot,
} from '../shared/assistant-status';
import {
  TERMINAL_CHANNELS,
  type TerminalBootstrapRequest,
  type TerminalInputRequest,
  type TerminalResizeRequest,
} from '../shared/terminal-bridge';

const WINDOW_SIZE = {
  width: 1440,
  height: 960,
  minWidth: 960,
  minHeight: 720,
};

function getRendererEntry(): { kind: 'url'; value: string } | { kind: 'file'; value: string } {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (typeof devServerUrl === 'string' && devServerUrl.length > 0) {
    return { kind: 'url', value: devServerUrl };
  }

  return {
    kind: 'file',
    value: path.join(__dirname, '../renderer/index.html'),
  };
}

function createMainWindow(): BrowserWindow {
  const preloadPath = path.join(__dirname, '../preload/index.js');
  const mainWindow = new BrowserWindow({
    width: WINDOW_SIZE.width,
    height: WINDOW_SIZE.height,
    minWidth: WINDOW_SIZE.minWidth,
    minHeight: WINDOW_SIZE.minHeight,
    show: false,
    backgroundColor: '#101218',
    title: 'Claude Code With Emotion',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const rendererEntry = getRendererEntry();

  if (rendererEntry.kind === 'url') {
    void mainWindow.loadURL(rendererEntry.value);
  } else {
    void mainWindow.loadFile(rendererEntry.value);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  return mainWindow;
}

function hasOpenWindows(): boolean {
  return BrowserWindow.getAllWindows().length > 0;
}

function registerTerminalBridge(mainWindow: BrowserWindow): void {
  const assistantStatusStore = new AssistantStatusStore();
  const assistantStatusFilePath = path.join(
    app.getPath('userData'),
    'assistant-status.json',
  );
  const assistantStatusHelperBinDir = path.join(app.getAppPath(), 'bin');
  const assistantStatusFileBridge = new AssistantStatusFileBridge(
    assistantStatusFilePath,
    assistantStatusStore,
  );
  const terminalSessionManager = createTerminalSessionManager(
    (sessionId, data) => {
      mainWindow.webContents.send(TERMINAL_CHANNELS.output, {
        sessionId,
        data,
      });
    },
    assistantStatusHelperBinDir,
    assistantStatusFilePath,
  );
  const unsubscribeAssistantStatus = assistantStatusStore.subscribe(
    (snapshot: AssistantStatusSnapshot) => {
      mainWindow.webContents.send(ASSISTANT_STATUS_CHANNELS.snapshot, snapshot);
    },
  );

  assistantStatusFileBridge.start();

  ipcMain.handle(ASSISTANT_STATUS_CHANNELS.getSnapshot, () => {
    return assistantStatusStore.getSnapshot();
  });

  ipcMain.handle(
    TERMINAL_CHANNELS.bootstrap,
    (_event, request: TerminalBootstrapRequest) => {
      return terminalSessionManager.bootstrapSession(request);
    },
  );

  ipcMain.handle(
    TERMINAL_CHANNELS.input,
    (_event, request: TerminalInputRequest) => {
      terminalSessionManager.sendInput(request);
    },
  );

  ipcMain.handle(
    TERMINAL_CHANNELS.resize,
    (_event, request: TerminalResizeRequest) => {
      terminalSessionManager.resizeSession(request);
    },
  );

  mainWindow.on('closed', () => {
    unsubscribeAssistantStatus();
    assistantStatusFileBridge.stop();
    assistantStatusStore.dispose();
    terminalSessionManager.dispose();
    ipcMain.removeHandler(ASSISTANT_STATUS_CHANNELS.getSnapshot);
    ipcMain.removeHandler(TERMINAL_CHANNELS.bootstrap);
    ipcMain.removeHandler(TERMINAL_CHANNELS.input);
    ipcMain.removeHandler(TERMINAL_CHANNELS.resize);
  });
}

void app.whenReady().then(() => {
  const mainWindow = createMainWindow();

  registerTerminalBridge(mainWindow);

  app.on('activate', () => {
    if (!hasOpenWindows()) {
      const nextMainWindow = createMainWindow();

      registerTerminalBridge(nextMainWindow);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
