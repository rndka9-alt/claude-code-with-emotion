import type { CollisionDetection } from "@dnd-kit/core";
import { shouldDetachTabOnDrop } from "./detach-drop-zone";

interface DetachAwareCollisionDetectionOptions {
  getStripElement: () => HTMLDivElement | null;
  reorderCollisionDetection: CollisionDetection;
}

// 분리 영역에서는 over를 비워 다른 탭이 순서 변경 자리로 밀리지 않게 한다
export function createDetachAwareCollisionDetection({
  getStripElement,
  reorderCollisionDetection,
}: DetachAwareCollisionDetectionOptions): CollisionDetection {
  return (args) => {
    const stripElement = getStripElement();

    if (
      stripElement !== null &&
      args.pointerCoordinates !== null &&
      shouldDetachTabOnDrop({
        pointerPosition: {
          clientX: args.pointerCoordinates.x,
          clientY: args.pointerCoordinates.y,
        },
        stripRect: stripElement.getBoundingClientRect(),
      })
    ) {
      return [];
    }

    return reorderCollisionDetection(args);
  };
}
