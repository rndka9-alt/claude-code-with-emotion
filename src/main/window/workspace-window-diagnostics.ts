import { app, type BrowserWindow } from "electron";
import { RUNTIME_DIAGNOSTIC_CONSOLE_PREFIX } from "../../shared/diagnostics";
import type { RuntimeLog } from "../diagnostics";

export function attachWorkspaceWindowDiagnostics(
  workspaceWindow: BrowserWindow,
  runtimeLog: RuntimeLog,
): void {
  workspaceWindow.webContents.on(
    "console-message",
    (_event, level, message, line, sourceId) => {
      if (message.startsWith(RUNTIME_DIAGNOSTIC_CONSOLE_PREFIX)) {
        return;
      }

      runtimeLog.write(
        "renderer-console",
        `level=${level} source=${sourceId}:${line} message=${message}`,
      );
    },
  );
  workspaceWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
      runtimeLog.write(
        "window-load",
        `did-fail-load code=${errorCode} description=${errorDescription} url=${validatedUrl} mainFrame=${isMainFrame}`,
      );
    },
  );
  workspaceWindow.webContents.on("render-process-gone", (_event, details) => {
    runtimeLog.write(
      "window-process",
      `render-process-gone reason=${details.reason} exitCode=${details.exitCode}`,
    );
  });
  workspaceWindow.webContents.on("did-finish-load", () => {
    runtimeLog.write("window-load", "did-finish-load");

    if (!app.isPackaged) {
      workspaceWindow.webContents.openDevTools({ mode: "detach" });
      runtimeLog.write("window-load", "opened devtools automatically");
    }
  });
}
