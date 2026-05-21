import { Menu, app, BrowserWindow } from "electron";
import path from "node:path";
import { createApplicationMenuTemplate } from "./application-menu";
import { createRuntimeLog, resolveRuntimeLogPath } from "./diagnostics";
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
