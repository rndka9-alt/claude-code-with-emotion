import { BrowserWindow } from "electron";
import type { WorkspaceWindowScreenPoint } from "../../shared/workspace-window-bridge";

const TAB_DRAG_PREVIEW_WIDTH = 260;
const TAB_DRAG_PREVIEW_HEIGHT = 44;
const TAB_DRAG_PREVIEW_OFFSET_X = 14;
const TAB_DRAG_PREVIEW_OFFSET_Y = 12;

export class TabDragPreviewWindow {
  private previewWindow: BrowserWindow | null = null;
  private previewVersion = 0;

  show(title: string, screenPoint: WorkspaceWindowScreenPoint): void {
    const previewWindow = this.resolvePreviewWindow();
    const previewVersion = this.previewVersion + 1;

    this.previewVersion = previewVersion;
    previewWindow.setBounds(resolvePreviewBounds(screenPoint), false);

    void previewWindow.loadURL(createPreviewDataUrl(title)).then(() => {
      if (
        this.previewVersion !== previewVersion ||
        previewWindow.isDestroyed()
      ) {
        return;
      }

      previewWindow.showInactive();
    });
  }

  move(screenPoint: WorkspaceWindowScreenPoint): void {
    const previewWindow = this.previewWindow;

    if (previewWindow === null || previewWindow.isDestroyed()) {
      return;
    }

    previewWindow.setBounds(resolvePreviewBounds(screenPoint), false);
  }

  hide(): void {
    this.previewVersion += 1;

    if (this.previewWindow === null || this.previewWindow.isDestroyed()) {
      return;
    }

    this.previewWindow.hide();
  }

  dispose(): void {
    this.previewVersion += 1;

    if (this.previewWindow === null || this.previewWindow.isDestroyed()) {
      this.previewWindow = null;
      return;
    }

    this.previewWindow.destroy();
    this.previewWindow = null;
  }

  private resolvePreviewWindow(): BrowserWindow {
    if (this.previewWindow !== null && !this.previewWindow.isDestroyed()) {
      return this.previewWindow;
    }

    this.previewWindow = createTabDragPreviewWindow();

    return this.previewWindow;
  }
}

function createTabDragPreviewWindow(): BrowserWindow {
  const previewWindow = new BrowserWindow({
    alwaysOnTop: true,
    backgroundColor: "#00000000",
    closable: false,
    focusable: false,
    frame: false,
    hasShadow: false,
    height: TAB_DRAG_PREVIEW_HEIGHT,
    maximizable: false,
    minimizable: false,
    movable: false,
    resizable: false,
    show: false,
    skipTaskbar: true,
    transparent: true,
    width: TAB_DRAG_PREVIEW_WIDTH,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  previewWindow.setAlwaysOnTop(true, "screen-saver");
  previewWindow.setIgnoreMouseEvents(true, { forward: true });

  return previewWindow;
}

function resolvePreviewBounds(screenPoint: WorkspaceWindowScreenPoint): {
  height: number;
  width: number;
  x: number;
  y: number;
} {
  return {
    height: TAB_DRAG_PREVIEW_HEIGHT,
    width: TAB_DRAG_PREVIEW_WIDTH,
    x: Math.round(screenPoint.x + TAB_DRAG_PREVIEW_OFFSET_X),
    y: Math.round(screenPoint.y + TAB_DRAG_PREVIEW_OFFSET_Y),
  };
}

function createPreviewDataUrl(title: string): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(createPreviewHtml(title))}`;
}

function createPreviewHtml(title: string): string {
  const escapedTitle = escapeHtml(title);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      * {
        box-sizing: border-box;
      }

      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: transparent;
        font-family:
          Inter,
          ui-sans-serif,
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
      }

      .preview {
        display: flex;
        align-items: center;
        width: 100%;
        height: 100%;
        padding: 0 14px;
        color: rgb(248 250 252);
        background: rgb(24 28 37 / 92%);
        border: 1px solid rgb(148 163 184 / 42%);
        border-radius: 8px;
        box-shadow: 0 18px 42px rgb(0 0 0 / 32%);
        font-size: 12px;
        font-weight: 600;
        line-height: 1;
        white-space: nowrap;
        user-select: none;
      }

      .title {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    </style>
  </head>
  <body>
    <div class="preview">
      <div class="title">${escapedTitle}</div>
    </div>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
