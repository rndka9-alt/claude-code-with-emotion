import {
  dialog,
  ipcMain,
  shell,
  type BrowserWindow,
  type IpcMainEvent,
  type OpenDialogOptions,
  type WebContents,
} from "electron";
import { APP_THEME_CHANNELS } from "../../shared/app-theme-bridge";
import {
  ASSISTANT_STATUS_CHANNELS,
  type AssistantStatusSnapshotRequest,
} from "../../shared/assistant-status";
import { LINKS_CHANNELS } from "../../shared/links-bridge";
import { MCP_SETUP_CHANNELS } from "../../shared/mcp-setup-bridge";
import {
  TERMINAL_CHANNELS,
  type TerminalBootstrapRequest,
  type TerminalCloseRequest,
  type TerminalInputRequest,
  type TerminalResizeRequest,
} from "../../shared/terminal-bridge";
import { VISUAL_ASSET_CHANNELS } from "../../shared/visual-assets-bridge";
import type { VisualAssetCatalog } from "../../shared/visual-assets";
import type { AppThemeSelection } from "../../shared/theme";
import {
  WORKSPACE_WINDOW_CHANNELS,
  parseAttachWorkspaceStateToWindowAtPointRequest,
  parseOpenDetachedWorkspaceWindowRequest,
  parseWorkspaceTabDragPreviewMoveRequest,
  parseWorkspaceTabDragPreviewRequest,
  type AttachWorkspaceStateToWindowAtPointRequest,
  type OpenDetachedWorkspaceWindowRequest,
  type WorkspaceTabDragPreviewMoveRequest,
  type WorkspaceTabDragPreviewRequest,
} from "../../shared/workspace-window-bridge";
import type { RuntimeLog } from "../diagnostics";
import type { TerminalSessionService } from "../terminal";
import type { ThemeStore } from "../theme";
import type { VisualAssetStore } from "../visual-assets";
import { isExternalBrowserUrl } from "../window";

interface RegisterWorkspaceIpcHandlersOptions {
  getFocusedWindow: () => BrowserWindow | null;
  attachWorkspaceStateToWindowAtPoint: (
    request: AttachWorkspaceStateToWindowAtPointRequest,
    sender: WebContents,
  ) => boolean;
  closeCurrentWorkspaceWindow: (sender: WebContents) => void;
  hideTabDragPreview: () => void;
  moveTabDragPreview: (request: WorkspaceTabDragPreviewMoveRequest) => void;
  openDetachedWorkspaceWindow: (
    request: OpenDetachedWorkspaceWindowRequest,
  ) => void;
  runtimeLog: RuntimeLog;
  terminalSessionService: TerminalSessionService;
  themeStore: ThemeStore;
  showTabDragPreview: (request: WorkspaceTabDragPreviewRequest) => void;
  visualAssetStore: VisualAssetStore;
}

export function registerWorkspaceIpcHandlers({
  attachWorkspaceStateToWindowAtPoint,
  closeCurrentWorkspaceWindow,
  getFocusedWindow,
  hideTabDragPreview,
  moveTabDragPreview,
  openDetachedWorkspaceWindow,
  runtimeLog,
  showTabDragPreview,
  terminalSessionService,
  themeStore,
  visualAssetStore,
}: RegisterWorkspaceIpcHandlersOptions): () => void {
  ipcMain.handle(
    WORKSPACE_WINDOW_CHANNELS.attachToWindowAtPoint,
    (event, request) => {
      return attachWorkspaceStateToWindowAtPoint(
        parseAttachWorkspaceStateToWindowAtPointRequest(request),
        event.sender,
      );
    },
  );
  ipcMain.handle(WORKSPACE_WINDOW_CHANNELS.closeCurrent, (event) => {
    closeCurrentWorkspaceWindow(event.sender);
  });
  const showTabDragPreviewListener = (
    _event: IpcMainEvent,
    request: unknown,
  ) => {
    showTabDragPreview(parseWorkspaceTabDragPreviewRequest(request));
  };
  const moveTabDragPreviewListener = (
    _event: IpcMainEvent,
    request: unknown,
  ) => {
    moveTabDragPreview(parseWorkspaceTabDragPreviewMoveRequest(request));
  };
  const hideTabDragPreviewListener = () => {
    hideTabDragPreview();
  };

  ipcMain.on(
    WORKSPACE_WINDOW_CHANNELS.showTabDragPreview,
    showTabDragPreviewListener,
  );
  ipcMain.on(
    WORKSPACE_WINDOW_CHANNELS.moveTabDragPreview,
    moveTabDragPreviewListener,
  );
  ipcMain.on(
    WORKSPACE_WINDOW_CHANNELS.hideTabDragPreview,
    hideTabDragPreviewListener,
  );
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
    const focusedWindow = getFocusedWindow();
    const dialogOptions: OpenDialogOptions = {
      buttonLabel: "Choose Images",
      filters: [
        {
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "gif", "webp"],
        },
      ],
      properties: ["openFile", "multiSelections"],
    };
    const result =
      focusedWindow === null
        ? await dialog.showOpenDialog(dialogOptions)
        : await dialog.showOpenDialog(focusedWindow, dialogOptions);

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
  ipcMain.handle(WORKSPACE_WINDOW_CHANNELS.openDetached, (_event, request) => {
    openDetachedWorkspaceWindow(
      parseOpenDetachedWorkspaceWindowRequest(request),
    );
  });

  return () => {
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
    ipcMain.removeHandler(WORKSPACE_WINDOW_CHANNELS.attachToWindowAtPoint);
    ipcMain.removeHandler(WORKSPACE_WINDOW_CHANNELS.closeCurrent);
    ipcMain.removeHandler(WORKSPACE_WINDOW_CHANNELS.openDetached);
    ipcMain.removeListener(
      WORKSPACE_WINDOW_CHANNELS.showTabDragPreview,
      showTabDragPreviewListener,
    );
    ipcMain.removeListener(
      WORKSPACE_WINDOW_CHANNELS.moveTabDragPreview,
      moveTabDragPreviewListener,
    );
    ipcMain.removeListener(
      WORKSPACE_WINDOW_CHANNELS.hideTabDragPreview,
      hideTabDragPreviewListener,
    );
  };
}
