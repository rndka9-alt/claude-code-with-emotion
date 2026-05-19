import { BrowserWindow } from "electron";
import path from "node:path";
import {
  getAppThemeDefinition,
  type AppThemeSelection,
} from "../../shared/theme";
import {
  createInitialWorkspaceStateArgument,
  type WorkspaceState,
} from "../../shared/workspace-state";
import type { WorkspaceWindowScreenPoint } from "../../shared/workspace-window-bridge";
import {
  resolveInitialWindowBounds,
  WORKSPACE_WINDOW_SIZE,
} from "./initial-window-bounds";
import { getRendererEntry } from "./renderer-entry";
import { attachWorkspaceWindowBoundsPersistence } from "./workspace-window-bounds-persistence";
import { attachWorkspaceWindowNavigationPolicy } from "./workspace-window-navigation";
import type { WindowBoundsStore } from "./window-bounds-store";

export interface CreateWorkspaceWindowOptions {
  initialScreenPoint?: WorkspaceWindowScreenPoint;
  initialWorkspaceState?: WorkspaceState;
}

export function createWorkspaceWindow(
  themeSelection: AppThemeSelection,
  boundsStore: WindowBoundsStore,
  options: CreateWorkspaceWindowOptions = {},
): BrowserWindow {
  const preloadPath = path.join(__dirname, "../../preload/index.js");
  const themeDefinition = getAppThemeDefinition(themeSelection.themeId);
  const initialBounds = resolveInitialWindowBounds(
    boundsStore.getBounds(),
    options.initialScreenPoint,
  );
  const additionalArguments =
    options.initialWorkspaceState === undefined
      ? []
      : [createInitialWorkspaceStateArgument(options.initialWorkspaceState)];
  const workspaceWindow = new BrowserWindow({
    ...initialBounds,
    minWidth: WORKSPACE_WINDOW_SIZE.minWidth,
    minHeight: WORKSPACE_WINDOW_SIZE.minHeight,
    show: false,
    backgroundColor: themeDefinition.windowBackground,
    title: "Claude Code With Emotion",
    webPreferences: {
      preload: preloadPath,
      additionalArguments,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  attachWorkspaceWindowBoundsPersistence(workspaceWindow, boundsStore);

  const rendererEntry = getRendererEntry();

  if (rendererEntry.kind === "url") {
    void workspaceWindow.loadURL(rendererEntry.value);
  } else {
    void workspaceWindow.loadFile(rendererEntry.value);
  }

  workspaceWindow.once("ready-to-show", () => {
    workspaceWindow.show();
  });
  attachWorkspaceWindowNavigationPolicy(workspaceWindow);

  return workspaceWindow;
}

export function hasOpenWorkspaceWindows(): boolean {
  return BrowserWindow.getAllWindows().length > 0;
}
