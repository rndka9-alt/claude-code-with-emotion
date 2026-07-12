import { app, BrowserWindow, type WebContents } from "electron";
import type { AssistantStatusSnapshotEvent } from "../../shared/assistant-status";
import { ASSISTANT_STATUS_CHANNELS } from "../../shared/assistant-status";
import { TERMINAL_CHANNELS } from "../../shared/terminal-bridge";
import type {
  AttachWorkspaceStateToWindowAtPointRequest,
  OpenDetachedWorkspaceWindowRequest,
} from "../../shared/workspace-window-bridge";
import type { RuntimeLog } from "../diagnostics";
import { TerminalSessionService } from "../terminal";
import type { ThemeStore } from "../theme";
import { VisualAssetStore } from "../visual-assets";
import { TabDragPreviewWindow } from "../window";
import { attachRendererDiagnosticListener } from "./renderer-diagnostic-listener";
import { registerWorkspaceIpcHandlers } from "./workspace-ipc-handlers";
import { resolveWorkspaceBridgePaths } from "./workspace-bridge-paths";
import { SessionWindowOwnership } from "./session-window-ownership";
import { attachWorkspaceWindowSubscriptions } from "./workspace-window-subscriptions";
import { routeAttachWorkspaceStateToWindowAtPoint } from "./workspace-window-attach-routing";

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
  const sessionWindowOwnership = new SessionWindowOwnership();
  const tabDragPreviewWindow = new TabDragPreviewWindow();
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
      sessionWindowOwnership.releaseSession(payload.sessionId);

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
    tabDragPreviewWindow.dispose();
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
    // "closed" 이후 BrowserWindow 프로퍼티 접근은 안전하지 않을 수 있어 id 를 미리 잡아둔다.
    const workspaceWindowId = workspaceWindow.id;

    workspaceWindow.on("closed", () => {
      runtimeLog.write(
        "window-lifecycle",
        `closed fired — detaching workspace window id=${workspaceWindowId} remaining=${workspaceWindows.size - 1}`,
      );
      detachWorkspaceWindowSubscriptions.get(workspaceWindowId)?.();
      detachWorkspaceWindowSubscriptions.delete(workspaceWindowId);
      workspaceWindows.delete(workspaceWindow);

      if (workspaceWindows.size === 0) {
        dispose();
        return;
      }

      // 창 하나만 닫힐 때는 그 창이 소유한 세션을 함께 닫는다.
      // 안 하면 PTY 와 세션별 상태 감시 리소스가 렌더러 없이 앱 종료까지 남는다.
      for (const sessionId of sessionWindowOwnership.takeSessionsOwnedByWindow(
        workspaceWindowId,
      )) {
        runtimeLog.write(
          "window-lifecycle",
          `closing session orphaned by window close session=${sessionId} window=${workspaceWindowId}`,
        );
        terminalSessionService.closeSession({ sessionId });
      }
    });
  }

  function attachWorkspaceStateToWindowAtPoint(
    request: AttachWorkspaceStateToWindowAtPointRequest,
    sender: WebContents,
  ): boolean {
    return routeAttachWorkspaceStateToWindowAtPoint({
      attachedRequest: {
        ...(request.assistantSnapshotsBySessionId === undefined
          ? {}
          : {
              assistantSnapshotsBySessionId:
                request.assistantSnapshotsBySessionId,
            }),
        attachedWorkspaceState: request.attachedWorkspaceState,
      },
      onAttachedToWindow: (targetWindow) => {
        sessionWindowOwnership.assignSessions(
          Object.keys(request.attachedWorkspaceState.sessions),
          targetWindow.id,
        );
      },
      screenPoint: request.screenPoint,
      sourceWindow: BrowserWindow.fromWebContents(sender),
      workspaceWindows,
    });
  }

  function closeCurrentWorkspaceWindow(sender: WebContents): void {
    const sourceWindow = BrowserWindow.fromWebContents(sender);

    if (sourceWindow === null) {
      throw new Error("Cannot close workspace window for an unknown sender.");
    }

    sourceWindow.close();
  }

  const removeWorkspaceIpcHandlers = registerWorkspaceIpcHandlers({
    attachWorkspaceStateToWindowAtPoint,
    closeCurrentWorkspaceWindow,
    getFocusedWindow: () => BrowserWindow.getFocusedWindow(),
    hideTabDragPreview: () => {
      tabDragPreviewWindow.hide();
    },
    moveTabDragPreview: (request) => {
      tabDragPreviewWindow.move(request.screenPoint);
    },
    onTerminalSessionBootstrapRequested: (sessionId, sender) => {
      const ownerWindow = BrowserWindow.fromWebContents(sender);

      if (ownerWindow !== null) {
        sessionWindowOwnership.assignSessions([sessionId], ownerWindow.id);
      }
    },
    openDetachedWorkspaceWindow: (request) => {
      const workspaceWindow = createDetachedWindow(request);

      // 새 창 렌더러가 세션을 다시 bootstrap 하기 전에 원본 창이 닫혀도
      // 세션이 원본 창 소유로 정리되지 않도록, 창 생성 시점에 소유권을 옮긴다.
      sessionWindowOwnership.assignSessions(
        Object.keys(request.initialWorkspaceState.sessions),
        workspaceWindow.id,
      );
      runtimeLog.write(
        "window-lifecycle",
        `detached workspace window created id=${workspaceWindow.id}`,
      );
    },
    runtimeLog,
    showTabDragPreview: (request) => {
      tabDragPreviewWindow.show(request.title, request.screenPoint);
    },
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
