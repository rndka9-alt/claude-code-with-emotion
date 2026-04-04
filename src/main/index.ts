import {
  Menu,
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  screen,
  shell,
  type IpcMainEvent,
} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { createApplicationMenuTemplate } from './application-menu';
import {
  createRuntimeLog,
  resolveRuntimeLogPath,
  type RuntimeLog,
} from './diagnostics/runtime-log';
import { AssistantVisualOverlayFileBridge } from './status/assistant-visual-overlay-file-bridge';
import { AssistantStatusFileBridge } from './status/assistant-status-file-bridge';
import { AssistantStatusStore } from './status/assistant-status-store';
import { ensureNodePtySpawnHelpersExecutable } from './terminal/node-pty-runtime';
import { createTerminalSessionManager } from './terminal/session-manager';
import { VisualAssetStore } from './visual-assets/visual-asset-store';
import {
  WindowBoundsStore,
  type WindowBounds,
} from './window/window-bounds-store';
import {
  APP_THEME_CHANNELS,
} from '../shared/app-theme-bridge';
import {
  ASSISTANT_STATUS_CHANNELS,
  createDefaultAssistantStatusSnapshot,
  type AssistantStatusSnapshot,
  type AssistantStatusSnapshotEvent,
  type AssistantStatusSnapshotRequest,
} from '../shared/assistant-status';
import {
  DIAGNOSTICS_CHANNELS,
  RUNTIME_DIAGNOSTIC_CONSOLE_PREFIX,
  type RendererDiagnosticPayload,
  type RuntimeDiagnosticPayload,
} from '../shared/diagnostics';
import { LINKS_CHANNELS } from '../shared/links-bridge';
import { MCP_SETUP_CHANNELS } from '../shared/mcp-setup-bridge';
import {
  TERMINAL_CHANNELS,
  type TerminalBootstrapRequest,
  type TerminalCloseRequest,
  type TerminalInputRequest,
  type TerminalResizeRequest,
} from '../shared/terminal-bridge';
import {
  VISUAL_ASSET_CHANNELS,
} from '../shared/visual-assets-bridge';
import type { VisualAssetCatalog } from '../shared/visual-assets';
import {
  getAppThemeDefinition,
  type AppThemeSelection,
} from '../shared/theme';
import { ThemeStore } from './theme/theme-store';
import {
  getVisualMcpSetupStatus,
  installVisualMcpUserSetup,
  removeVisualMcpUserSetup,
} from './terminal/claude-mcp-user-setup';

const WINDOW_SIZE = {
  width: 920,
  height: 680,
  minWidth: 640,
  minHeight: 520,
};
const EXTERNAL_BROWSER_PROTOCOLS = new Set(['http:', 'https:', 'vscode:']);

function isExternalBrowserUrl(url: string): boolean {
  try {
    const protocol = new URL(url).protocol;

    return EXTERNAL_BROWSER_PROTOCOLS.has(protocol);
  } catch {
    return false;
  }
}

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

function resolveInitialWindowBounds(
  savedBounds: WindowBounds | null,
): {
  width: number;
  height: number;
  x?: number;
  y?: number;
} {
  if (!savedBounds) {
    return { width: WINDOW_SIZE.width, height: WINDOW_SIZE.height };
  }

  const width = Math.max(WINDOW_SIZE.minWidth, Math.round(savedBounds.width));
  const height = Math.max(WINDOW_SIZE.minHeight, Math.round(savedBounds.height));

  // 저장된 좌표가 음수 sentinel(최초 저장 전 상태)이면 OS 가 중앙 배치하도록 맡긴다
  if (savedBounds.x < 0 || savedBounds.y < 0) {
    return { width, height };
  }

  // 외장 모니터가 사라진 경우 오프스크린으로 복원되는 것을 막기 위해 디스플레이 범위와 교차 검증
  const displays = screen.getAllDisplays();
  const visible = displays.some((display) => {
    const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
    const right = savedBounds.x + width;
    const bottom = savedBounds.y + height;

    return (
      savedBounds.x < dx + dw &&
      right > dx &&
      savedBounds.y < dy + dh &&
      bottom > dy
    );
  });

  if (!visible) {
    return { width, height };
  }

  return {
    width,
    height,
    x: Math.round(savedBounds.x),
    y: Math.round(savedBounds.y),
  };
}

function createMainWindow(
  themeSelection: AppThemeSelection,
  boundsStore: WindowBoundsStore,
): BrowserWindow {
  const preloadPath = path.join(__dirname, '../preload/index.js');
  const themeDefinition = getAppThemeDefinition(themeSelection.themeId);
  const initialBounds = resolveInitialWindowBounds(boundsStore.getBounds());
  const mainWindow = new BrowserWindow({
    ...initialBounds,
    minWidth: WINDOW_SIZE.minWidth,
    minHeight: WINDOW_SIZE.minHeight,
    show: false,
    backgroundColor: themeDefinition.windowBackground,
    title: 'Claude Code With Emotion',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const persistBounds = (): void => {
    // 최대화/최소화/풀스크린 상태의 bounds 는 저장하지 않아야 다음 실행에서 원래 크기로 복귀 가능
    if (
      mainWindow.isMaximized() ||
      mainWindow.isMinimized() ||
      mainWindow.isFullScreen()
    ) {
      return;
    }

    const { x, y, width, height } = mainWindow.getBounds();

    boundsStore.save({ x, y, width, height });
  };

  mainWindow.on('resized', persistBounds);
  mainWindow.on('moved', persistBounds);
  mainWindow.on('close', persistBounds);

  const rendererEntry = getRendererEntry();

  if (rendererEntry.kind === 'url') {
    void mainWindow.loadURL(rendererEntry.value);
  } else {
    void mainWindow.loadFile(rendererEntry.value);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalBrowserUrl(url)) {
      void shell.openExternal(url);
    }

    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isExternalBrowserUrl(url)) {
      return;
    }

    event.preventDefault();
    void shell.openExternal(url);
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
      if (message.startsWith(RUNTIME_DIAGNOSTIC_CONSOLE_PREFIX)) {
        return;
      }

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
  themeStore: ThemeStore,
): void {
  const assistantStatusTraceFilePath = runtimeLog.filePath;
  const assistantStatusHelperBinDir = path.join(app.getAppPath(), 'bin');
  const visualAssetCatalogFilePath = path.join(
    app.getPath('userData'),
    'visual-assets.json',
  );
  const visualMcpStateFilePath = path.join(
    app.getPath('userData'),
    'assistant-visual-mcp.json',
  );
  const appThemeFilePath = path.join(app.getPath('userData'), 'app-theme.json');
  const visualAssetLibraryDirPath = path.join(
    app.getPath('userData'),
    'visual-assets',
  );
  const terminalOutputRootDir = path.join(
    app.getPath('userData'),
    'terminal-output',
  );
  const sessionStatusStores = new Map<string, AssistantStatusStore>();
  const sessionStatusFileBridges = new Map<string, AssistantStatusFileBridge>();
  const sessionOverlayFileBridges = new Map<string, AssistantVisualOverlayFileBridge>();
  const sessionStatusUnsubscribes = new Map<string, () => void>();
  const sessionStatusRootDir = path.join(app.getPath('userData'), 'assistant-status');
  const sessionOverlayRootDir = path.join(
    app.getPath('userData'),
    'assistant-visual-overlay',
  );
  const resolveStatusFilePath = (sessionId: string): string =>
    path.join(sessionStatusRootDir, `${sessionId}.json`);
  const resolveOverlayFilePath = (sessionId: string): string =>
    path.join(sessionOverlayRootDir, `${sessionId}.json`);
  const writeVisualMcpState = (visualOverlayFilePath: string): void => {
    const nextState = {
      traceFilePath: assistantStatusTraceFilePath,
      visualAssetCatalogFilePath,
      visualOverlayFilePath,
    };

    fs.mkdirSync(path.dirname(visualMcpStateFilePath), {
      recursive: true,
    });
    fs.writeFileSync(
      visualMcpStateFilePath,
      JSON.stringify(nextState, null, 2),
      'utf8',
    );
  };
  const ensureSessionStatusBridges = (sessionId: string): void => {
    if (sessionStatusStores.has(sessionId)) {
      return;
    }

    const statusStore = new AssistantStatusStore();
    const statusFilePath = resolveStatusFilePath(sessionId);
    const statusFileBridge = new AssistantStatusFileBridge(
      statusFilePath,
      statusStore,
      (message) => {
        runtimeLog.write('assistant-status-file', `session=${sessionId} ${message}`);
      },
    );
    const overlayFileBridge = new AssistantVisualOverlayFileBridge(
      resolveOverlayFilePath(sessionId),
      statusStore,
      (message) => {
        runtimeLog.write(
          'assistant-visual-overlay',
          `session=${sessionId} ${message}`,
        );
      },
    );
    const unsubscribe = statusStore.subscribe((snapshot: AssistantStatusSnapshot) => {
      const payload: AssistantStatusSnapshotEvent = { sessionId, snapshot };
      mainWindow.webContents.send(ASSISTANT_STATUS_CHANNELS.snapshot, payload);
    });

    sessionStatusStores.set(sessionId, statusStore);
    sessionStatusFileBridges.set(sessionId, statusFileBridge);
    sessionOverlayFileBridges.set(sessionId, overlayFileBridge);
    sessionStatusUnsubscribes.set(sessionId, unsubscribe);
    statusFileBridge.start();
    overlayFileBridge.start();
  };
  const disposeSessionStatusBridges = (sessionId: string): void => {
    sessionStatusFileBridges.get(sessionId)?.stop();
    sessionOverlayFileBridges.get(sessionId)?.stop();
    sessionStatusUnsubscribes.get(sessionId)?.();
    sessionStatusStores.get(sessionId)?.dispose();
    sessionStatusFileBridges.delete(sessionId);
    sessionOverlayFileBridges.delete(sessionId);
    sessionStatusUnsubscribes.delete(sessionId);
    sessionStatusStores.delete(sessionId);
  };
  const terminalSessionManager = createTerminalSessionManager(
    (sessionId, event) => {
      mainWindow.webContents.send(TERMINAL_CHANNELS.output, {
        sessionId,
        data: event.data,
        outputVersion: event.outputVersion,
      });
    },
    (sessionId, event) => {
      runtimeLog.write(
        'terminal',
        `exit session=${sessionId} code=${event.exitCode} signal=${event.signal}`,
      );
      // 터미널 종료 시 MCP가 설정한 오버레이 한마디를 즉시 클리어
      sessionStatusStores.get(sessionId)?.applyVisualOverlay(
        { line: null },
        'session-exit',
      );
      mainWindow.webContents.send(TERMINAL_CHANNELS.exit, {
        sessionId,
        exitCode: event.exitCode,
        signal: event.signal,
      });
    },
    assistantStatusHelperBinDir,
    assistantStatusTraceFilePath,
    visualAssetCatalogFilePath,
    terminalOutputRootDir,
  );
  const visualAssetStore = new VisualAssetStore(
    visualAssetCatalogFilePath,
    visualAssetLibraryDirPath,
    (message) => {
      runtimeLog.write('visual-assets', message);
    },
  );
  const unsubscribeVisualAssets = visualAssetStore.subscribe((catalog) => {
    runtimeLog.write(
      'visual-assets',
      `snapshot assets=${catalog.assets.length} mappings=${catalog.mappings.length}`,
    );
    mainWindow.webContents.send(VISUAL_ASSET_CHANNELS.catalog, catalog);
  });

  runtimeLog.write(
    'visual-assets',
    `watching catalog file ${visualAssetCatalogFilePath}`,
  );
  runtimeLog.write('app-theme', `watching theme file ${appThemeFilePath}`);

  const unsubscribeTheme = themeStore.subscribe((selection) => {
    const nextTheme = getAppThemeDefinition(selection.themeId);

    runtimeLog.write('app-theme', `snapshot theme=${selection.themeId}`);
    mainWindow.setBackgroundColor(nextTheme.windowBackground);
    mainWindow.webContents.send(APP_THEME_CHANNELS.selection, selection);
  });

  ipcMain.handle(
    ASSISTANT_STATUS_CHANNELS.getSnapshot,
    async (_event, request: AssistantStatusSnapshotRequest) => {
      ensureSessionStatusBridges(request.sessionId);
      return (
        sessionStatusStores.get(request.sessionId)?.getSnapshot() ??
        createDefaultAssistantStatusSnapshot(Date.now())
      );
    },
  );
  ipcMain.handle(MCP_SETUP_CHANNELS.getStatus, () => {
    return getVisualMcpSetupStatus(visualMcpStateFilePath);
  });
  ipcMain.handle(MCP_SETUP_CHANNELS.install, () => {
    return installVisualMcpUserSetup(
      assistantStatusHelperBinDir,
      visualMcpStateFilePath,
    );
  });
  ipcMain.handle(MCP_SETUP_CHANNELS.remove, () => {
    return removeVisualMcpUserSetup(visualMcpStateFilePath);
  });
  ipcMain.handle(VISUAL_ASSET_CHANNELS.getCatalog, () => {
    return visualAssetStore.getCatalog();
  });
  ipcMain.handle(VISUAL_ASSET_CHANNELS.getAvailableOptions, () => {
    return visualAssetStore.getAvailableOptions();
  });
  ipcMain.handle(VISUAL_ASSET_CHANNELS.printAvailableOptions, () => {
    return visualAssetStore.getAvailableOptions();
  });
  ipcMain.handle(
    VISUAL_ASSET_CHANNELS.importFiles,
    (_event, filePaths: ReadonlyArray<string>) => {
      const nextFilePaths = filePaths.filter((filePath) => {
        return typeof filePath === 'string' && filePath.length > 0;
      });

      runtimeLog.write(
        'visual-assets',
        `import requested files=${nextFilePaths.length}`,
      );

      return visualAssetStore.importFiles(nextFilePaths);
    },
  );
  ipcMain.handle(APP_THEME_CHANNELS.getSelection, () => {
    return themeStore.getSelection();
  });
  ipcMain.handle(LINKS_CHANNELS.openExternal, (_event, url: string) => {
    if (!isExternalBrowserUrl(url)) {
      throw new Error(`Unsupported external URL: ${url}`);
    }

    return shell.openExternal(url);
  });
  ipcMain.handle(
    APP_THEME_CHANNELS.saveSelection,
    (_event, selection: AppThemeSelection) => {
      return themeStore.replaceSelection(selection);
    },
  );
  ipcMain.handle(VISUAL_ASSET_CHANNELS.pickFiles, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      buttonLabel: 'Choose Images',
      filters: [
        {
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
        },
      ],
      properties: ['openFile', 'multiSelections'],
    });

    if (result.canceled) {
      runtimeLog.write('visual-assets', 'picker canceled');
      return [];
    }

    runtimeLog.write(
      'visual-assets',
      `picker selected files=${result.filePaths.length}`,
    );

    return visualAssetStore.importFiles(result.filePaths);
  });
  ipcMain.handle(
    VISUAL_ASSET_CHANNELS.saveCatalog,
    (_event, catalog: VisualAssetCatalog) => {
      return visualAssetStore.replaceCatalog(catalog);
    },
  );

  ipcMain.handle(
    TERMINAL_CHANNELS.bootstrap,
    async (_event, request: TerminalBootstrapRequest) => {
      runtimeLog.write(
        'terminal',
        `bootstrap session=${request.sessionId} cwd=${request.cwd} command=${request.command} cols=${request.cols} rows=${request.rows}`,
      );
      ensureSessionStatusBridges(request.sessionId);
      writeVisualMcpState(resolveOverlayFilePath(request.sessionId));

      try {
        return terminalSessionManager.bootstrapSession(
          request,
          resolveStatusFilePath(request.sessionId),
          resolveOverlayFilePath(request.sessionId),
        );
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

  ipcMain.handle(
    TERMINAL_CHANNELS.close,
    (_event, request: TerminalCloseRequest) => {
      runtimeLog.write('terminal', `close session=${request.sessionId}`);
      terminalSessionManager.closeSession(request);
      disposeSessionStatusBridges(request.sessionId);
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
    unsubscribeTheme();
    unsubscribeVisualAssets();
    for (const sessionId of [...sessionStatusStores.keys()]) {
      disposeSessionStatusBridges(sessionId);
    }
    visualAssetStore.dispose();
    terminalSessionManager.dispose();
    ipcMain.removeListener(
      DIAGNOSTICS_CHANNELS.rendererEvent,
      rendererDiagnosticListener,
    );
    ipcMain.removeHandler(ASSISTANT_STATUS_CHANNELS.getSnapshot);
    ipcMain.removeHandler(MCP_SETUP_CHANNELS.getStatus);
    ipcMain.removeHandler(MCP_SETUP_CHANNELS.install);
    ipcMain.removeHandler(MCP_SETUP_CHANNELS.remove);
    ipcMain.removeHandler(VISUAL_ASSET_CHANNELS.getCatalog);
    ipcMain.removeHandler(VISUAL_ASSET_CHANNELS.getAvailableOptions);
    ipcMain.removeHandler(VISUAL_ASSET_CHANNELS.pickFiles);
    ipcMain.removeHandler(VISUAL_ASSET_CHANNELS.printAvailableOptions);
    ipcMain.removeHandler(VISUAL_ASSET_CHANNELS.saveCatalog);
    ipcMain.removeHandler(APP_THEME_CHANNELS.getSelection);
    ipcMain.removeHandler(APP_THEME_CHANNELS.saveSelection);
    ipcMain.removeHandler(TERMINAL_CHANNELS.bootstrap);
    ipcMain.removeHandler(TERMINAL_CHANNELS.input);
    ipcMain.removeHandler(TERMINAL_CHANNELS.resize);
    ipcMain.removeHandler(TERMINAL_CHANNELS.close);
  });
}

void app.whenReady().then(() => {
  const runtimeLog = createRuntimeLog(
    resolveRuntimeLogPath(
      app.getAppPath(),
      app.getPath('userData'),
      app.isPackaged,
    ),
    (payload: RuntimeDiagnosticPayload) => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(DIAGNOSTICS_CHANNELS.runtimeEvent, payload);
      }
    },
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

  const themeStore = new ThemeStore(
    path.join(app.getPath('userData'), 'app-theme.json'),
    (message) => {
      runtimeLog.write('app-theme', message);
    },
  );
  const windowBoundsStore = new WindowBoundsStore(
    path.join(app.getPath('userData'), 'window-bounds.json'),
    (message) => {
      runtimeLog.write('window-bounds', message);
    },
  );
  installApplicationMenu();
  const mainWindow = createMainWindow(themeStore.getSelection(), windowBoundsStore);

  attachWindowDiagnostics(mainWindow, runtimeLog);
  registerTerminalBridge(mainWindow, runtimeLog, themeStore);

  app.on('activate', () => {
    if (!hasOpenWindows()) {
      const nextMainWindow = createMainWindow(
        themeStore.getSelection(),
        windowBoundsStore,
      );

      attachWindowDiagnostics(nextMainWindow, runtimeLog);
      registerTerminalBridge(nextMainWindow, runtimeLog, themeStore);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
