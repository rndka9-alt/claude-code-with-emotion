const TAB_DETACH_SAFE_DISTANCE_PX = 96;

export interface PointerClientPoint {
  clientX: number;
  clientY: number;
}

export interface PointerClientPosition extends PointerClientPoint {
  screenX: number;
  screenY: number;
}

interface TabDetachDropZoneInput {
  pointerPosition: PointerClientPoint | null;
  stripRect: DOMRectReadOnly;
}

export function shouldDetachTabOnDrop({
  pointerPosition,
  stripRect,
}: TabDetachDropZoneInput): boolean {
  if (pointerPosition === null) {
    return false;
  }

  if (
    pointerPosition.clientX >= stripRect.left - TAB_DETACH_SAFE_DISTANCE_PX &&
    pointerPosition.clientX <= stripRect.right + TAB_DETACH_SAFE_DISTANCE_PX &&
    pointerPosition.clientY >= stripRect.top - TAB_DETACH_SAFE_DISTANCE_PX &&
    pointerPosition.clientY <= stripRect.bottom + TAB_DETACH_SAFE_DISTANCE_PX
  ) {
    return false;
  }

  return true;
}
