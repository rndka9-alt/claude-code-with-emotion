import {
  Menu,
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  type IpcMainEvent,
} from "electron";
import path from "node:path";
import { createApplicationMenuTemplate } from "./application-menu";
import { createRuntimeLog, resolveRuntimeLogPath, type RuntimeLog } from "./diagnostics";
import {
  ensureNodePtySpawnHelpersExecutable,
  TerminalSessionService,
} from "./terminal";
import { ThemeStore } from "./theme";
import { VisualAssetStore } from "./visual-assets";
import {
  attachWorkspaceWindowDiagnostics,
  createWorkspaceWindow,
  hasOpenWorkspaceWindows,
  isExternalBrowserUrl,
  WindowBoundsStore,
} from "./window";
import { APP_THEME_CHANNELS } from "../shared/app-theme-bridge";
import {
  ASSISTANT_STATUS_CHANNELS,
  type AssistantStatusSnapshotEvent,
  type AssistantStatusSnapshotRequest,
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
  type TerminalBootstrapRequest,
  type TerminalCloseRequest,
  type TerminalInputRequest,
  type TerminalResizeRequest,
} from "../shared/terminal-bridge";
import { VISUAL_ASSET_CHANNELS } from "../shared/visual-assets-bridge";
import type { VisualAssetCatalog } from "../shared/visual-assets";
import { getAppThemeDefinition, type AppThemeSelection } from "../shared/theme";
import { WORKSPACE_COMMAND_CHANNELS } from "../shared/workspace-command-bridge";

function installApplicationMenu(): void {
  const template = createApplicationMenuTemplate(app.name, {
    openTerminalSearch: () => {
      const focusedWindow = BrowserWindow.getFocusedWindow();

      focusedWindow?.webContents.send(WORKSPACE_COMMAND_CHANNELS.openTerminalSearch);
    },
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function registerTerminalBridge(
  mainWindow: BrowserWindow,
  runtimeLog: RuntimeLog,
  themeStore: ThemeStore,
): void {
  const assistantStatusTraceFilePath = runtimeLog.filePath;
  // 패키징된 앱에선 bin/ 이 app.asar 밖 Contents/Resources/bin/ 에 놓인다.
  // bin 스크립트들은 Claude CLI hook 이나 child_process.spawn 으로 외부에서 직접 실행되므로
  // Electron 의 asar fs 패치가 적용되지 않는 환경에서도 접근 가능한 실제 파일 경로가 필요.
  const assistantStatusHelperBinDir = app.isPackaged
    ? path.join(process.resourcesPath, "bin")
    : path.join(app.getAppPath(), "bin");
  const visualAssetCatalogFilePath = path.join(
    app.getPath("userData"),
    "visual-assets.json",
  );
  const visualMcpStateFilePath = path.join(
    app.getPath("userData"),
    "assistant-visual-mcp.json",
  );
  const appThemeFilePath = path.join(app.getPath("userData"), "app-theme.json");
  const visualAssetLibraryDirPath = path.join(
    app.getPath("userData"),
    "visual-assets",
  );
  const terminalOutputRootDir = path.join(
    app.getPath("userData"),
    "terminal-output",
  );
  const terminalSessionService = new TerminalSessionService({
    assistantStatusHelperBinDir,
    assistantStatusTraceFilePath,
    runtimeLog,
    sendAssistantStatusSnapshot: (payload: AssistantStatusSnapshotEvent) => {
      mainWindow.webContents.send(ASSISTANT_STATUS_CHANNELS.snapshot, payload);
    },
    sendTerminalOutput: (payload) => {
      mainWindow.webContents.send(TERMINAL_CHANNELS.output, {
        sessionId: payload.sessionId,
        data: payload.data,
        outputVersion: payload.outputVersion,
      });
    },
    sendTerminalExit: (payload) => {
      mainWindow.webContents.send(TERMINAL_CHANNELS.exit, {
        sessionId: payload.sessionId,
        exitCode: payload.exitCode,
        signal: payload.signal,
      });
    },
    terminalOutputRootDir,
    userDataPath: app.getPath("userData"),
    visualAssetCatalogFilePath,
    visualMcpStateFilePath,
  });
  const visualAssetStore = new VisualAssetStore(
    visualAssetCatalogFilePath,
    visualAssetLibraryDirPath,
    (message) => {
      runtimeLog.write("visual-assets", message);
    },
  );
  const unsubscribeVisualAssets = visualAssetStore.subscribe((catalog) => {
    runtimeLog.write(
      "visual-assets",
      `snapshot assets=${catalog.assets.length} mappings=${catalog.mappings.length}`,
    );
    mainWindow.webContents.send(VISUAL_ASSET_CHANNELS.catalog, catalog);
  });

  runtimeLog.write(
    "visual-assets",
    `watching catalog file ${visualAssetCatalogFilePath}`,
  );
  runtimeLog.write("app-theme", `watching theme file ${appThemeFilePath}`);

  const unsubscribeTheme = themeStore.subscribe((selection) => {
    const nextTheme = getAppThemeDefinition(selection.themeId);

    runtimeLog.write("app-theme", `snapshot theme=${selection.themeId}`);
    mainWindow.setBackgroundColor(nextTheme.windowBackground);
    mainWindow.webContents.send(APP_THEME_CHANNELS.selection, selection);
  });

  ipcMain.handle(
    ASSISTANT_STATUS_CHANNELS.getSnapshot,
    async (_event, request: AssistantStatusSnapshotRequest) => {
      return terminalSessionService.getAssistantStatusSnapshot(request);
    },
  );
  ipcMain.handle(MCP_SETUP_CHANNELS.getStatus, () => {
    return terminalSessionService.getVisualMcpSetupStatus();
  });
  ipcMain.handle(MCP_SETUP_CHANNELS.install, () => {
    return terminalSessionService.installVisualMcpUserSetup();
  });
  ipcMain.handle(MCP_SETUP_CHANNELS.remove, () => {
    return terminalSessionService.removeVisualMcpUserSetup();
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
        return typeof filePath === "string" && filePath.length > 0;
      });

      runtimeLog.write(
        "visual-assets",
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
      buttonLabel: "Choose Images",
      filters: [
        {
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "gif", "webp"],
        },
      ],
      properties: ["openFile", "multiSelections"],
    });

    if (result.canceled) {
      runtimeLog.write("visual-assets", "picker canceled");
      return [];
    }

    runtimeLog.write(
      "visual-assets",
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
      return terminalSessionService.bootstrapSession(request);
    },
  );

  ipcMain.handle(
    TERMINAL_CHANNELS.input,
    (_event, request: TerminalInputRequest) => {
      terminalSessionService.sendInput(request);
    },
  );

  ipcMain.handle(
    TERMINAL_CHANNELS.resize,
    (_event, request: TerminalResizeRequest) => {
      terminalSessionService.resizeSession(request);
    },
  );

  ipcMain.handle(
    TERMINAL_CHANNELS.close,
    (_event, request: TerminalCloseRequest) => {
      terminalSessionService.closeSession(request);
    },
  );

  const rendererDiagnosticListener = (
    _event: IpcMainEvent,
    payload: RendererDiagnosticPayload,
  ) => {
    const stackSuffix =
      typeof payload.stack === "string" && payload.stack.length > 0
        ? `\n${payload.stack}`
        : "";

    runtimeLog.write(
      "renderer-event",
      `${payload.type}: ${payload.message}${stackSuffix}`,
    );
  };

  ipcMain.on(DIAGNOSTICS_CHANNELS.rendererEvent, rendererDiagnosticListener);

  mainWindow.on("closed", () => {
    runtimeLog.write(
      "window-lifecycle",
      `closed fired — removing ipc handlers (remaining windows=${BrowserWindow.getAllWindows().length})`,
    );
    unsubscribeTheme();
    unsubscribeVisualAssets();
    visualAssetStore.dispose();
    terminalSessionService.dispose();
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
    ipcMain.removeHandler(VISUAL_ASSET_CHANNELS.importFiles);
    ipcMain.removeHandler(VISUAL_ASSET_CHANNELS.pickFiles);
    ipcMain.removeHandler(VISUAL_ASSET_CHANNELS.printAvailableOptions);
    ipcMain.removeHandler(VISUAL_ASSET_CHANNELS.saveCatalog);
    ipcMain.removeHandler(APP_THEME_CHANNELS.getSelection);
    ipcMain.removeHandler(APP_THEME_CHANNELS.saveSelection);
    ipcMain.removeHandler(LINKS_CHANNELS.openExternal);
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
      app.getPath("userData"),
      app.isPackaged,
    ),
    (payload: RuntimeDiagnosticPayload) => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(DIAGNOSTICS_CHANNELS.runtimeEvent, payload);
      }
    },
  );

  runtimeLog.write("app", `runtime log ready at ${runtimeLog.filePath}`);
  process.on("uncaughtException", (error) => {
    runtimeLog.writeError("process", error);
  });
  process.on("unhandledRejection", (reason) => {
    runtimeLog.writeError("process", reason);
  });
  app.on("child-process-gone", (_event, details) => {
    runtimeLog.write(
      "app-child-process",
      `type=${details.type} reason=${details.reason} exitCode=${details.exitCode}`,
    );
  });
  const nodePtyPackageRoot = path.dirname(
    require.resolve("node-pty/package.json"),
  );
  const helperPreflight = ensureNodePtySpawnHelpersExecutable(
    nodePtyPackageRoot,
    process.platform,
    process.arch,
  );

  if (helperPreflight.foundHelperPaths.length === 0) {
    runtimeLog.write(
      "terminal-helper",
      `no node-pty spawn-helper found under ${nodePtyPackageRoot}`,
    );
  } else {
    runtimeLog.write(
      "terminal-helper",
      `spawn-helper paths=${helperPreflight.foundHelperPaths.join(", ")} updated=${helperPreflight.updatedHelperPaths.length}`,
    );
  }

  const themeStore = new ThemeStore(
    path.join(app.getPath("userData"), "app-theme.json"),
    (message) => {
      runtimeLog.write("app-theme", message);
    },
  );
  const windowBoundsStore = new WindowBoundsStore(
    path.join(app.getPath("userData"), "window-bounds.json"),
    (message) => {
      runtimeLog.write("window-bounds", message);
    },
  );
  installApplicationMenu();
  const mainWindow = createWorkspaceWindow(
    themeStore.getSelection(),
    windowBoundsStore,
  );

  attachWorkspaceWindowDiagnostics(mainWindow, runtimeLog);
  registerTerminalBridge(mainWindow, runtimeLog, themeStore);

  app.on("activate", () => {
    const openCount = BrowserWindow.getAllWindows().length;
    runtimeLog.write(
      "window-lifecycle",
      `activate fired — hasOpenWorkspaceWindows=${openCount > 0} count=${openCount}`,
    );
    if (!hasOpenWorkspaceWindows()) {
      const nextMainWindow = createWorkspaceWindow(
        themeStore.getSelection(),
        windowBoundsStore,
      );

      attachWorkspaceWindowDiagnostics(nextMainWindow, runtimeLog);
      registerTerminalBridge(nextMainWindow, runtimeLog, themeStore);
      runtimeLog.write(
        "window-lifecycle",
        "activate: new window created + bridge re-registered",
      );
    }
  });

  app.on("window-all-closed", () => {
    runtimeLog.write(
      "window-lifecycle",
      `window-all-closed fired — platform=${process.platform} willQuit=${process.platform !== "darwin"}`,
    );
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
});
