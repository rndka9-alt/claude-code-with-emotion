import { app, BrowserWindow } from "electron";
import type { AssistantStatusSnapshotEvent } from "../../shared/assistant-status";
import { ASSISTANT_STATUS_CHANNELS } from "../../shared/assistant-status";
import { TERMINAL_CHANNELS } from "../../shared/terminal-bridge";
import type { OpenDetachedWorkspaceWindowRequest } from "../../shared/workspace-window-bridge";
import type { RuntimeLog } from "../diagnostics";
import { TerminalSessionService } from "../terminal";
import type { ThemeStore } from "../theme";
import { VisualAssetStore } from "../visual-assets";
import { attachRendererDiagnosticListener } from "./renderer-diagnostic-listener";
import { registerWorkspaceIpcHandlers } from "./workspace-ipc-handlers";
import { resolveWorkspaceBridgePaths } from "./workspace-bridge-paths";
import { attachWorkspaceWindowSubscriptions } from "./workspace-window-subscriptions";

interface RegisterWorkspaceBridgeOptions {
  createDetachedWindow: (
    request: OpenDetachedWorkspaceWindowRequest,
  ) => BrowserWindow;
  initialWindow: BrowserWindow;
  onDispose: () => void;
  runtimeLog: RuntimeLog;
  themeStore: ThemeStore;
}

export interface WorkspaceBridge {
  attachWindow: (workspaceWindow: BrowserWindow) => void;
  dispose: () => void;
}

export function registerWorkspaceBridge({
  createDetachedWindow,
  initialWindow,
  onDispose,
  runtimeLog,
  themeStore,
}: RegisterWorkspaceBridgeOptions): WorkspaceBridge {
  const workspaceWindows = new Set<BrowserWindow>();
  const detachWorkspaceWindowSubscriptions = new Map<number, () => void>();
  let isDisposed = false;
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
      for (const workspaceWindow of workspaceWindows) {
        workspaceWindow.webContents.send(
          ASSISTANT_STATUS_CHANNELS.snapshot,
          payload,
        );
      }
    },
    sendTerminalOutput: (payload) => {
      for (const workspaceWindow of workspaceWindows) {
        workspaceWindow.webContents.send(TERMINAL_CHANNELS.output, {
          sessionId: payload.sessionId,
          data: payload.data,
          outputVersion: payload.outputVersion,
        });
      }
    },
    sendTerminalExit: (payload) => {
      for (const workspaceWindow of workspaceWindows) {
        workspaceWindow.webContents.send(TERMINAL_CHANNELS.exit, {
          sessionId: payload.sessionId,
          exitCode: payload.exitCode,
          signal: payload.signal,
        });
      }
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
  runtimeLog.write(
    "app-theme",
    `watching theme file ${bridgePaths.appThemeFilePath}`,
  );

  function dispose(): void {
    if (isDisposed) {
      return;
    }

    isDisposed = true;

    for (const detachSubscriptions of detachWorkspaceWindowSubscriptions.values()) {
      detachSubscriptions();
    }

    detachWorkspaceWindowSubscriptions.clear();
    workspaceWindows.clear();
    visualAssetStore.dispose();
    terminalSessionService.dispose();
    detachRendererDiagnosticListener();
    removeWorkspaceIpcHandlers();
    onDispose();
  }

  function attachWindow(workspaceWindow: BrowserWindow): void {
    if (isDisposed) {
      throw new Error("Cannot attach a workspace window to a disposed bridge.");
    }

    workspaceWindows.add(workspaceWindow);
    detachWorkspaceWindowSubscriptions.set(
      workspaceWindow.id,
      attachWorkspaceWindowSubscriptions({
        mainWindow: workspaceWindow,
        runtimeLog,
        themeStore,
        visualAssetStore,
      }),
    );
    workspaceWindow.on("closed", () => {
      runtimeLog.write(
        "window-lifecycle",
        `closed fired — detaching workspace window id=${workspaceWindow.id} remaining=${workspaceWindows.size - 1}`,
      );
      detachWorkspaceWindowSubscriptions.get(workspaceWindow.id)?.();
      detachWorkspaceWindowSubscriptions.delete(workspaceWindow.id);
      workspaceWindows.delete(workspaceWindow);

      if (workspaceWindows.size === 0) {
        dispose();
      }
    });
  }

  const removeWorkspaceIpcHandlers = registerWorkspaceIpcHandlers({
    getFocusedWindow: () => BrowserWindow.getFocusedWindow(),
    openDetachedWorkspaceWindow: (request) => {
      const workspaceWindow = createDetachedWindow(request);

      runtimeLog.write(
        "window-lifecycle",
        `detached workspace window created id=${workspaceWindow.id}`,
      );
    },
    runtimeLog,
    terminalSessionService,
    themeStore,
    visualAssetStore,
  });
  const detachRendererDiagnosticListener =
    attachRendererDiagnosticListener(runtimeLog);

  attachWindow(initialWindow);

  return {
    attachWindow,
    dispose,
  };
}
