import type { BrowserWindow } from "electron";
import type { WindowBoundsStore } from "./window-bounds-store";

export function attachWorkspaceWindowBoundsPersistence(
  workspaceWindow: BrowserWindow,
  boundsStore: WindowBoundsStore,
): void {
  const persistBounds = (): void => {
    // 최대화/최소화/풀스크린 상태의 bounds 는 저장하지 않아야 다음 실행에서 원래 크기로 복귀 가능하다.
    if (
      workspaceWindow.isMaximized() ||
      workspaceWindow.isMinimized() ||
      workspaceWindow.isFullScreen()
    ) {
      return;
    }

    const { x, y, width, height } = workspaceWindow.getBounds();

    boundsStore.save({ x, y, width, height });
  };

  workspaceWindow.on("resized", persistBounds);
  workspaceWindow.on("moved", persistBounds);
  workspaceWindow.on("close", persistBounds);
}
