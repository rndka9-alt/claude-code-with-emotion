const AUTO_SCROLL_EDGE_THRESHOLD_PX = 48;
const AUTO_SCROLL_MAX_SPEED_PX_PER_SECOND = 420;
const INITIAL_FRAME_DURATION_MS = 16;
const MAX_FRAME_DURATION_MS = 32;

interface AutoScrollControllerOptions {
  getActiveDragTabId: () => string | null;
  getEdgeClientX: () => number | null;
  getStripElement: () => HTMLDivElement | null;
}

export interface AutoScrollController {
  stop: () => void;
  update: (edgeClientX: number | null) => void;
}

export function createAutoScrollController(
  options: AutoScrollControllerOptions,
): AutoScrollController {
  let animationFrameId: number | null = null;
  let lastTimestamp: number | null = null;

  function stop(): void {
    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    lastTimestamp = null;
  }

  function runAutoScrollFrame(timestamp: number): void {
    animationFrameId = null;

    const activeDragTabId = options.getActiveDragTabId();
    const stripElement = options.getStripElement();
    const edgeClientX = options.getEdgeClientX();

    if (
      activeDragTabId === null ||
      stripElement === null ||
      edgeClientX === null
    ) {
      lastTimestamp = null;
      return;
    }

    const velocity = getAutoScrollVelocity(edgeClientX, stripElement);

    if (velocity === 0) {
      lastTimestamp = null;
      return;
    }

    const elapsedMs =
      lastTimestamp === null
        ? INITIAL_FRAME_DURATION_MS
        : Math.min(timestamp - lastTimestamp, MAX_FRAME_DURATION_MS);
    lastTimestamp = timestamp;

    const visibleWidth = getStripVisibleWidth(stripElement);
    const maxScrollLeft = Math.max(stripElement.scrollWidth - visibleWidth, 0);
    const nextScrollLeft = Math.min(
      Math.max(
        stripElement.scrollLeft + velocity * (elapsedMs / 1_000),
        0,
      ),
      maxScrollLeft,
    );

    if (nextScrollLeft === stripElement.scrollLeft) {
      lastTimestamp = null;
      return;
    }

    stripElement.scrollLeft = nextScrollLeft;
    animationFrameId = window.requestAnimationFrame(runAutoScrollFrame);
  }

  function update(edgeClientX: number | null): void {
    const stripElement = options.getStripElement();

    if (stripElement === null || edgeClientX === null) {
      stop();
      return;
    }

    if (getAutoScrollVelocity(edgeClientX, stripElement) === 0) {
      stop();
      return;
    }

    if (animationFrameId !== null) {
      return;
    }

    animationFrameId = window.requestAnimationFrame(runAutoScrollFrame);
  }

  return {
    stop,
    update,
  };
}

function getAutoScrollVelocity(
  pointerClientX: number,
  stripElement: HTMLDivElement,
): number {
  const rect = stripElement.getBoundingClientRect();
  const visibleWidth = getStripVisibleWidth(stripElement);
  const maxScrollLeft = Math.max(stripElement.scrollWidth - visibleWidth, 0);

  if (maxScrollLeft === 0) {
    return 0;
  }

  const leftThreshold = rect.left + AUTO_SCROLL_EDGE_THRESHOLD_PX;

  if (pointerClientX < leftThreshold && stripElement.scrollLeft > 0) {
    const intensity = Math.min(
      (leftThreshold - pointerClientX) / AUTO_SCROLL_EDGE_THRESHOLD_PX,
      1,
    );

    return -AUTO_SCROLL_MAX_SPEED_PX_PER_SECOND * intensity * intensity;
  }

  const rightThreshold = rect.right - AUTO_SCROLL_EDGE_THRESHOLD_PX;

  if (
    pointerClientX > rightThreshold &&
    stripElement.scrollLeft < maxScrollLeft
  ) {
    const intensity = Math.min(
      (pointerClientX - rightThreshold) / AUTO_SCROLL_EDGE_THRESHOLD_PX,
      1,
    );

    return AUTO_SCROLL_MAX_SPEED_PX_PER_SECOND * intensity * intensity;
  }

  return 0;
}

function getStripVisibleWidth(stripElement: HTMLDivElement): number {
  const rect = stripElement.getBoundingClientRect();

  if (stripElement.clientWidth > 0) {
    return stripElement.clientWidth;
  }

  return rect.width;
}
