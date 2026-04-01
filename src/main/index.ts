import {
  Menu,
  app,
  BrowserWindow,
  ipcMain,
  type IpcMainEvent,
} from 'electron';
import path from 'node:path';
import { createApplicationMenuTemplate } from './application-menu';
import {
  createRuntimeLog,
  resolveRuntimeLogPath,
  type RuntimeLog,
} from './diagnostics/runtime-log';
import { AssistantStatusFileBridge } from './status/assistant-status-file-bridge';
import { AssistantStatusStore } from './status/assistant-status-store';
import { ensureNodePtySpawnHelpersExecutable } from './terminal/node-pty-runtime';
import { createTerminalSessionManager } from './terminal/session-manager';
import {
  ASSISTANT_STATUS_CHANNELS,
  type AssistantStatusSnapshot,
} from '../shared/assistant-status';
import {
  DIAGNOSTICS_CHANNELS,
  type RendererDiagnosticPayload,
} from '../shared/diagnostics';
import {
  TERMINAL_CHANNELS,
  type TerminalBootstrapRequest,
  type TerminalInputRequest,
  type TerminalResizeRequest,
} from '../shared/terminal-bridge';

const WINDOW_SIZE = {
  width: 1040,
  height: 720,
  minWidth: 860,
  minHeight: 620,
};

function getRendererEntry():
  | { kind: 'url'; value: string }
  | { kind: 'file'; value: string } {
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
      sandbox: false,
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

function installApplicationMenu(): void {
  const template = createApplicationMenuTemplate(app.name);

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function attachWindowDiagnostics(
  mainWindow: BrowserWindow,
  runtimeLog: RuntimeLog,
): void {
  mainWindow.webContents.on(
    'console-message',
    (_event, level, message, line, sourceId) => {
      runtimeLog.write(
        'renderer-console',
        `level=${level} source=${sourceId}:${line} message=${message}`,
      );
    },
  );
  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
      runtimeLog.write(
        'window-load',
        `did-fail-load code=${errorCode} description=${errorDescription} url=${validatedUrl} mainFrame=${isMainFrame}`,
      );
    },
  );
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    runtimeLog.write(
      'window-process',
      `render-process-gone reason=${details.reason} exitCode=${details.exitCode}`,
    );
  });
  mainWindow.webContents.on('did-finish-load', () => {
    runtimeLog.write('window-load', 'did-finish-load');

    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
      runtimeLog.write('window-load', 'opened devtools automatically');
    }
  });
}

function registerTerminalBridge(
  mainWindow: BrowserWindow,
  runtimeLog: RuntimeLog,
): void {
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
  runtimeLog.write(
    'assistant-status',
    `watching helper file ${assistantStatusFilePath}`,
  );

  ipcMain.handle(ASSISTANT_STATUS_CHANNELS.getSnapshot, () => {
    return assistantStatusStore.getSnapshot();
  });

  ipcMain.handle(
    TERMINAL_CHANNELS.bootstrap,
    (_event, request: TerminalBootstrapRequest) => {
      runtimeLog.write(
        'terminal',
        `bootstrap session=${request.sessionId} cwd=${request.cwd} command=${request.command} cols=${request.cols} rows=${request.rows}`,
      );
      try {
        return terminalSessionManager.bootstrapSession(request);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown terminal error';

        runtimeLog.write(
          'terminal-error',
          `bootstrap failed for ${request.sessionId}: ${message}`,
        );
        throw error;
      }
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

  const rendererDiagnosticListener = (
    _event: IpcMainEvent,
    payload: RendererDiagnosticPayload,
  ) => {
    const stackSuffix =
      typeof payload.stack === 'string' && payload.stack.length > 0
        ? `\n${payload.stack}`
        : '';

    runtimeLog.write(
      'renderer-event',
      `${payload.type}: ${payload.message}${stackSuffix}`,
    );
  };

  ipcMain.on(DIAGNOSTICS_CHANNELS.rendererEvent, rendererDiagnosticListener);

  mainWindow.on('closed', () => {
    unsubscribeAssistantStatus();
    assistantStatusFileBridge.stop();
    assistantStatusStore.dispose();
    terminalSessionManager.dispose();
    ipcMain.removeListener(
      DIAGNOSTICS_CHANNELS.rendererEvent,
      rendererDiagnosticListener,
    );
    ipcMain.removeHandler(ASSISTANT_STATUS_CHANNELS.getSnapshot);
    ipcMain.removeHandler(TERMINAL_CHANNELS.bootstrap);
    ipcMain.removeHandler(TERMINAL_CHANNELS.input);
    ipcMain.removeHandler(TERMINAL_CHANNELS.resize);
  });
}

void app.whenReady().then(() => {
  const runtimeLog = createRuntimeLog(
    resolveRuntimeLogPath(
      app.getAppPath(),
      app.getPath('userData'),
      app.isPackaged,
    ),
  );

  runtimeLog.write('app', `runtime log ready at ${runtimeLog.filePath}`);
  process.on('uncaughtException', (error) => {
    runtimeLog.writeError('process', error);
  });
  process.on('unhandledRejection', (reason) => {
    runtimeLog.writeError('process', reason);
  });
  app.on('child-process-gone', (_event, details) => {
    runtimeLog.write(
      'app-child-process',
      `type=${details.type} reason=${details.reason} exitCode=${details.exitCode}`,
    );
  });
  const nodePtyPackageRoot = path.dirname(require.resolve('node-pty/package.json'));
  const helperPreflight = ensureNodePtySpawnHelpersExecutable(
    nodePtyPackageRoot,
    process.platform,
    process.arch,
  );

  if (helperPreflight.foundHelperPaths.length === 0) {
    runtimeLog.write(
      'terminal-helper',
      `no node-pty spawn-helper found under ${nodePtyPackageRoot}`,
    );
  } else {
    runtimeLog.write(
      'terminal-helper',
      `spawn-helper paths=${helperPreflight.foundHelperPaths.join(', ')} updated=${helperPreflight.updatedHelperPaths.length}`,
    );
  }

  installApplicationMenu();
  const mainWindow = createMainWindow();

  attachWindowDiagnostics(mainWindow, runtimeLog);
  registerTerminalBridge(mainWindow, runtimeLog);

  app.on('activate', () => {
    if (!hasOpenWindows()) {
      const nextMainWindow = createMainWindow();

      attachWindowDiagnostics(nextMainWindow, runtimeLog);
      registerTerminalBridge(nextMainWindow, runtimeLog);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
