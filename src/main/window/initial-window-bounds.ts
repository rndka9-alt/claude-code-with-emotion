import { screen } from "electron";
import type { WindowBounds } from "./window-bounds-store";

export const WORKSPACE_WINDOW_SIZE = {
  width: 920,
  height: 680,
  minWidth: 640,
  minHeight: 520,
};

export function resolveInitialWindowBounds(savedBounds: WindowBounds | null): {
  width: number;
  height: number;
  x?: number;
  y?: number;
} {
  if (!savedBounds) {
    return {
      width: WORKSPACE_WINDOW_SIZE.width,
      height: WORKSPACE_WINDOW_SIZE.height,
    };
  }

  const width = Math.max(
    WORKSPACE_WINDOW_SIZE.minWidth,
    Math.round(savedBounds.width),
  );
  const height = Math.max(
    WORKSPACE_WINDOW_SIZE.minHeight,
    Math.round(savedBounds.height),
  );

  // 저장된 좌표가 음수 sentinel(최초 저장 전 상태)이면 OS 가 중앙 배치하도록 맡긴다.
  if (savedBounds.x < 0 || savedBounds.y < 0) {
    return { width, height };
  }

  // 외장 모니터가 사라진 경우 오프스크린으로 복원되는 것을 막기 위해 디스플레이 범위와 교차 검증한다.
  const displays = screen.getAllDisplays();
  const visible = displays.some((display) => {
    const { x: displayX, y: displayY, width: displayWidth, height: displayHeight } =
      display.workArea;
    const right = savedBounds.x + width;
    const bottom = savedBounds.y + height;

    return (
      savedBounds.x < displayX + displayWidth &&
      right > displayX &&
      savedBounds.y < displayY + displayHeight &&
      bottom > displayY
    );
  });

  if (!visible) {
    return { width, height };
  }

  return {
    width,
    height,
    x: Math.round(savedBounds.x),
    y: Math.round(savedBounds.y),
  };
}
