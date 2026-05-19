import { shell, type BrowserWindow } from "electron";
import { isExternalBrowserUrl } from "./external-url-policy";

export function attachWorkspaceWindowNavigationPolicy(
  workspaceWindow: BrowserWindow,
): void {
  workspaceWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalBrowserUrl(url)) {
      void shell.openExternal(url);
    }

    return { action: "deny" };
  });
  workspaceWindow.webContents.on("will-navigate", (event, url) => {
    if (!isExternalBrowserUrl(url)) {
      return;
    }

    event.preventDefault();
    void shell.openExternal(url);
  });
}
