const TAB_DETACH_DISTANCE_PX = 32;

export interface PointerClientPosition {
  clientX: number;
  clientY: number;
  screenX: number;
  screenY: number;
}

interface ViewportSize {
  height: number;
  width: number;
}

interface TabDetachDropZoneInput {
  pointerPosition: PointerClientPosition | null;
  stripRect: DOMRectReadOnly;
  viewportSize: ViewportSize;
}

export function shouldDetachTabOnDrop({
  pointerPosition,
  stripRect,
  viewportSize,
}: TabDetachDropZoneInput): boolean {
  if (pointerPosition === null) {
    return false;
  }

  if (
    pointerPosition.clientX < 0 ||
    pointerPosition.clientX > viewportSize.width ||
    pointerPosition.clientY < 0 ||
    pointerPosition.clientY > viewportSize.height
  ) {
    return true;
  }

  return (
    pointerPosition.clientY < stripRect.top - TAB_DETACH_DISTANCE_PX ||
    pointerPosition.clientY > stripRect.bottom + TAB_DETACH_DISTANCE_PX
  );
}
