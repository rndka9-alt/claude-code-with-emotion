import { screen } from "electron";
import type { WorkspaceWindowScreenPoint } from "../../shared/workspace-window-bridge";
import type { WindowBounds } from "./window-bounds-store";

export const WORKSPACE_WINDOW_SIZE = {
  width: 920,
  height: 680,
  minWidth: 640,
  minHeight: 520,
};

export function resolveInitialWindowBounds(
  savedBounds: WindowBounds | null,
  initialScreenPoint?: WorkspaceWindowScreenPoint,
): {
  width: number;
  height: number;
  x?: number;
  y?: number;
} {
  if (initialScreenPoint !== undefined) {
    return resolveInitialWindowBoundsFromScreenPoint(
      savedBounds,
      initialScreenPoint,
    );
  }

  const { height, width } = resolveWindowSize(savedBounds);

  if (!savedBounds) {
    return {
      height,
      width,
    };
  }

  // 저장된 좌표가 음수 sentinel(최초 저장 전 상태)이면 OS 가 중앙 배치하도록 맡긴다.
  if (savedBounds.x < 0 || savedBounds.y < 0) {
    return { height, width };
  }

  // 외장 모니터가 사라진 경우 오프스크린으로 복원되는 것을 막기 위해 디스플레이 범위와 교차 검증한다.
  if (!isWindowBoundsVisible(savedBounds.x, savedBounds.y, width, height)) {
    return { height, width };
  }

  return {
    height,
    width,
    x: Math.round(savedBounds.x),
    y: Math.round(savedBounds.y),
  };
}

function resolveWindowSize(savedBounds: WindowBounds | null): {
  height: number;
  width: number;
} {
  if (savedBounds === null) {
    return {
      height: WORKSPACE_WINDOW_SIZE.height,
      width: WORKSPACE_WINDOW_SIZE.width,
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

  return { height, width };
}

function isWindowBoundsVisible(
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  const displays = screen.getAllDisplays();
  return displays.some((display) => {
    const {
      x: displayX,
      y: displayY,
      width: displayWidth,
      height: displayHeight,
    } = display.workArea;
    const right = x + width;
    const bottom = y + height;

    return (
      x < displayX + displayWidth &&
      right > displayX &&
      y < displayY + displayHeight &&
      bottom > displayY
    );
  });
}

function resolveInitialWindowBoundsFromScreenPoint(
  savedBounds: WindowBounds | null,
  initialScreenPoint: WorkspaceWindowScreenPoint,
): {
  height: number;
  width: number;
  x: number;
  y: number;
} {
  const { height, width } = resolveWindowSize(savedBounds);
  const display = screen.getDisplayNearestPoint({
    x: Math.round(initialScreenPoint.x),
    y: Math.round(initialScreenPoint.y),
  });
  const { workArea } = display;

  return {
    height,
    width,
    x: clamp(
      Math.round(initialScreenPoint.x - 120),
      workArea.x,
      workArea.x + workArea.width - width,
    ),
    y: clamp(
      Math.round(initialScreenPoint.y - 18),
      workArea.y,
      workArea.y + workArea.height - height,
    ),
  };
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}
