import { Menu, app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { createApplicationMenuTemplate } from "./application-menu";
import {
  createForensicsRecorder,
  createRuntimeLog,
  ForensicsModeStore,
  isForensicsEnabled,
  resolveForensicsDirectory,
  resolveRuntimeLogPath,
} from "./diagnostics";
import {
  ensureNodePtySpawnHelpersExecutable,
  getDefaultAssistantProvider,
} from "./terminal";
import { ThemeStore } from "./theme";
import {
  attachWorkspaceWindowDiagnostics,
  createWorkspaceWindow,
  hasOpenWorkspaceWindows,
  WindowBoundsStore,
} from "./window";
import {
  registerWorkspaceBridge,
  type WorkspaceBridge,
} from "./workspace-bridge";
import {
  DIAGNOSTICS_CHANNELS,
  type RuntimeDiagnosticPayload,
} from "../shared/diagnostics";
import { FORENSICS_MODE_CHANNELS } from "../shared/forensics-bridge";
import type { OpenDetachedWorkspaceWindowRequest } from "../shared/workspace-window-bridge";
import { WORKSPACE_COMMAND_CHANNELS } from "../shared/workspace-command-bridge";

function installApplicationMenu(): void {
  const template = createApplicationMenuTemplate(app.name, {
    openTerminalSearch: () => {
      const focusedWindow = BrowserWindow.getFocusedWindow();

      focusedWindow?.webContents.send(
        WORKSPACE_COMMAND_CHANNELS.openTerminalSearch,
      );
    },
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
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

  // 감시 모드(stall 추적 계측)는 설정 토글 또는 FORENSICS 환경변수로 켠다.
  // recorder는 항상 만들되, enable() 전에는 어떤 계측도 가동하지 않는다(평소 오버헤드 0).
  const forensicsRecorder = createForensicsRecorder({
    runtimeLog,
    directory: resolveForensicsDirectory(
      app.getAppPath(),
      app.getPath("userData"),
      app.isPackaged,
    ),
  });
  const forensicsModeStore = new ForensicsModeStore(
    path.join(app.getPath("userData"), "forensics.json"),
    (message) => {
      runtimeLog.write("forensics", message);
    },
  );

  // 감시 모드를 켜고/끄고 열린 모든 창에 상태를 반영한다.
  // ON: 메인 계측 가동 + 모든 창에 렌더러 프로파일러 attach
  // OFF: 모든 계측 정지 + 디버거 detach
  // 어느 쪽이든 각 창 preload watchdog이 start/stop하도록 상태 변경을 broadcast한다.
  function applyForensicsEnabled(enabled: boolean): void {
    if (enabled) {
      forensicsRecorder.enable();

      for (const openWindow of BrowserWindow.getAllWindows()) {
        forensicsRecorder.attachWindow(openWindow.webContents);
      }
    } else {
      forensicsRecorder.disable();
    }

    for (const openWindow of BrowserWindow.getAllWindows()) {
      openWindow.webContents.send(FORENSICS_MODE_CHANNELS.stateChanged, {
        enabled,
      });
    }
  }

  // 저장된 설정이 켜져 있거나 FORENSICS 환경변수가 켜져 있으면 시작부터 가동한다.
  if (forensicsModeStore.isEnabled() || isForensicsEnabled()) {
    applyForensicsEnabled(true);
  }

  ipcMain.handle(FORENSICS_MODE_CHANNELS.getState, () => {
    return { enabled: forensicsRecorder.isEnabled() };
  });
  ipcMain.handle(
    FORENSICS_MODE_CHANNELS.setState,
    (_event, request: unknown) => {
      const enabled = request === true;

      forensicsModeStore.setEnabled(enabled);
      applyForensicsEnabled(enabled);

      return { enabled };
    },
  );

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
  const assistantProvider = getDefaultAssistantProvider();
  installApplicationMenu();
  let workspaceBridge: WorkspaceBridge | null = null;

  function createManagedWorkspaceWindow(
    request?: OpenDetachedWorkspaceWindowRequest,
  ): BrowserWindow {
    const workspaceWindow = createWorkspaceWindow(
      themeStore.getSelection(),
      windowBoundsStore,
      assistantProvider,
      request === undefined
        ? {}
        : {
            ...(request.assistantSnapshotsBySessionId === undefined
              ? {}
              : {
                  initialAssistantSnapshotsBySessionId:
                    request.assistantSnapshotsBySessionId,
                }),
            ...(request.initialScreenPoint === undefined
              ? {}
              : { initialScreenPoint: request.initialScreenPoint }),
            initialWorkspaceState: request.initialWorkspaceState,
          },
    );

    attachWorkspaceWindowDiagnostics(workspaceWindow, runtimeLog);
    forensicsRecorder.attachWindow(workspaceWindow.webContents);

    if (workspaceBridge === null) {
      workspaceBridge = registerWorkspaceBridge({
        createDetachedWindow: createManagedWorkspaceWindow,
        initialWindow: workspaceWindow,
        onDispose: () => {
          workspaceBridge = null;
        },
        runtimeLog,
        themeStore,
      });
    } else {
      workspaceBridge.attachWindow(workspaceWindow);
    }

    return workspaceWindow;
  }

  createManagedWorkspaceWindow();

  app.on("activate", () => {
    const openCount = BrowserWindow.getAllWindows().length;
    runtimeLog.write(
      "window-lifecycle",
      `activate fired — hasOpenWorkspaceWindows=${openCount > 0} count=${openCount}`,
    );
    if (!hasOpenWorkspaceWindows()) {
      createManagedWorkspaceWindow();
      runtimeLog.write(
        "window-lifecycle",
        "activate: new window created + bridge re-registered",
      );
    }
  });

  app.on("before-quit", () => {
    forensicsRecorder.dispose();
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
