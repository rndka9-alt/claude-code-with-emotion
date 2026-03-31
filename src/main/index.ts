import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { MockTerminalService } from './terminal/mock-terminal-service';
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
  const terminalService = new MockTerminalService();

  ipcMain.handle(
    TERMINAL_CHANNELS.bootstrap,
    (_event, request: TerminalBootstrapRequest) => {
      return terminalService.bootstrapSession(request);
    },
  );

  ipcMain.handle(
    TERMINAL_CHANNELS.input,
    (event, request: TerminalInputRequest) => {
      const output = terminalService.handleInput(request);

      if (output.length > 0) {
        event.sender.send(TERMINAL_CHANNELS.output, {
          sessionId: request.sessionId,
          data: output,
        });
      }
    },
  );

  ipcMain.handle(
    TERMINAL_CHANNELS.resize,
    (_event, request: TerminalResizeRequest) => {
      terminalService.handleResize(request);
    },
  );

  mainWindow.on('closed', () => {
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
