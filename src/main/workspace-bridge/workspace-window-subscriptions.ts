import type { BrowserWindow } from "electron";
import { APP_THEME_CHANNELS } from "../../shared/app-theme-bridge";
import { VISUAL_ASSET_CHANNELS } from "../../shared/visual-assets-bridge";
import { getAppThemeDefinition } from "../../shared/theme";
import type { RuntimeLog } from "../diagnostics";
import type { ThemeStore } from "../theme";
import type { VisualAssetStore } from "../visual-assets";

interface AttachWorkspaceWindowSubscriptionsOptions {
  mainWindow: BrowserWindow;
  runtimeLog: RuntimeLog;
  themeStore: ThemeStore;
  visualAssetStore: VisualAssetStore;
}

export function attachWorkspaceWindowSubscriptions({
  mainWindow,
  runtimeLog,
  themeStore,
  visualAssetStore,
}: AttachWorkspaceWindowSubscriptionsOptions): () => void {
  const unsubscribeVisualAssets = visualAssetStore.subscribe((catalog) => {
    runtimeLog.write(
      "visual-assets",
      `snapshot assets=${catalog.assets.length} mappings=${catalog.mappings.length}`,
    );
    mainWindow.webContents.send(VISUAL_ASSET_CHANNELS.catalog, catalog);
  });
  const unsubscribeTheme = themeStore.subscribe((selection) => {
    const nextTheme = getAppThemeDefinition(selection.themeId);

    runtimeLog.write("app-theme", `snapshot theme=${selection.themeId}`);
    mainWindow.setBackgroundColor(nextTheme.windowBackground);
    mainWindow.webContents.send(APP_THEME_CHANNELS.selection, selection);
  });

  return () => {
    unsubscribeTheme();
    unsubscribeVisualAssets();
  };
}
