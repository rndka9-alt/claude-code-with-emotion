import { app, BrowserWindow } from "electron";
import type { AssistantStatusSnapshotEvent } from "../../shared/assistant-status";
import { ASSISTANT_STATUS_CHANNELS } from "../../shared/assistant-status";
import { TERMINAL_CHANNELS } from "../../shared/terminal-bridge";
import type { RuntimeLog } from "../diagnostics";
import { TerminalSessionService } from "../terminal";
import type { ThemeStore } from "../theme";
import { VisualAssetStore } from "../visual-assets";
import { attachRendererDiagnosticListener } from "./renderer-diagnostic-listener";
import { registerWorkspaceIpcHandlers } from "./workspace-ipc-handlers";
import { resolveWorkspaceBridgePaths } from "./workspace-bridge-paths";
import { attachWorkspaceWindowSubscriptions } from "./workspace-window-subscriptions";

interface RegisterWorkspaceBridgeOptions {
  mainWindow: BrowserWindow;
  runtimeLog: RuntimeLog;
  themeStore: ThemeStore;
}

export function registerWorkspaceBridge({
  mainWindow,
  runtimeLog,
  themeStore,
}: RegisterWorkspaceBridgeOptions): void {
  const bridgePaths = {
    ...resolveWorkspaceBridgePaths({
      appPath: app.getAppPath(),
      isPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      userDataPath: app.getPath("userData"),
    }),
    assistantStatusTraceFilePath: runtimeLog.filePath,
  };
  const terminalSessionService = new TerminalSessionService({
    assistantStatusHelperBinDir: bridgePaths.assistantStatusHelperBinDir,
    assistantStatusTraceFilePath: bridgePaths.assistantStatusTraceFilePath,
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
    terminalOutputRootDir: bridgePaths.terminalOutputRootDir,
    userDataPath: bridgePaths.userDataPath,
    visualAssetCatalogFilePath: bridgePaths.visualAssetCatalogFilePath,
    visualMcpStateFilePath: bridgePaths.visualMcpStateFilePath,
  });
  const visualAssetStore = new VisualAssetStore(
    bridgePaths.visualAssetCatalogFilePath,
    bridgePaths.visualAssetLibraryDirPath,
    (message) => {
      runtimeLog.write("visual-assets", message);
    },
  );

  runtimeLog.write(
    "visual-assets",
    `watching catalog file ${bridgePaths.visualAssetCatalogFilePath}`,
  );
  runtimeLog.write("app-theme", `watching theme file ${bridgePaths.appThemeFilePath}`);

  const detachWorkspaceWindowSubscriptions = attachWorkspaceWindowSubscriptions({
    mainWindow,
    runtimeLog,
    themeStore,
    visualAssetStore,
  });
  const removeWorkspaceIpcHandlers = registerWorkspaceIpcHandlers({
    mainWindow,
    runtimeLog,
    terminalSessionService,
    themeStore,
    visualAssetStore,
  });
  const detachRendererDiagnosticListener =
    attachRendererDiagnosticListener(runtimeLog);

  mainWindow.on("closed", () => {
    runtimeLog.write(
      "window-lifecycle",
      `closed fired — removing ipc handlers (remaining windows=${BrowserWindow.getAllWindows().length})`,
    );
    detachWorkspaceWindowSubscriptions();
    visualAssetStore.dispose();
    terminalSessionService.dispose();
    detachRendererDiagnosticListener();
    removeWorkspaceIpcHandlers();
  });
}
