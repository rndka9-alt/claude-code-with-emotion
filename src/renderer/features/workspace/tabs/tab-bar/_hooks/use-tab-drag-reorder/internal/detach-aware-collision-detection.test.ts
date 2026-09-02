import type { Collision, CollisionDetection } from "@dnd-kit/core";
import { describe, expect, it, vi } from "vitest";
import { createDetachAwareCollisionDetection } from "./detach-aware-collision-detection";

const stripRect = new DOMRect(0, 0, 420, 32);
const reorderCollision: Collision = { id: "tab-b" };

function createCollisionArgs(
  pointerCoordinates: { x: number; y: number } | null,
): Parameters<CollisionDetection>[0] {
  return {
    active: {
      id: "tab-a",
      data: { current: undefined },
      rect: { current: { initial: null, translated: null } },
    },
    collisionRect: {
      width: 180,
      height: 28,
      top: 0,
      left: 0,
      right: 180,
      bottom: 28,
    },
    droppableContainers: [],
    droppableRects: new Map(),
    pointerCoordinates,
  };
}

function createStripElement(): HTMLDivElement {
  const stripElement = document.createElement("div");

  stripElement.getBoundingClientRect = () => stripRect;

  return stripElement;
}

describe("createDetachAwareCollisionDetection", () => {
  it("delegates to the reorder collision detection inside the reorder zone", () => {
    const reorderCollisionDetection = vi.fn(() => [reorderCollision]);
    const collisionDetection = createDetachAwareCollisionDetection({
      getStripElement: createStripElement,
      reorderCollisionDetection,
    });
    const args = createCollisionArgs({ x: 80, y: 90 });

    expect(collisionDetection(args)).toEqual([reorderCollision]);
    expect(reorderCollisionDetection).toHaveBeenCalledWith(args);
  });

  it("reports no collision while the pointer is in the detach zone", () => {
    const reorderCollisionDetection = vi.fn(() => [reorderCollision]);
    const collisionDetection = createDetachAwareCollisionDetection({
      getStripElement: createStripElement,
      reorderCollisionDetection,
    });

    expect(collisionDetection(createCollisionArgs({ x: 80, y: 150 }))).toEqual(
      [],
    );
    expect(reorderCollisionDetection).not.toHaveBeenCalled();
  });

  it("delegates to the reorder collision detection without pointer coordinates", () => {
    const reorderCollisionDetection = vi.fn(() => [reorderCollision]);
    const collisionDetection = createDetachAwareCollisionDetection({
      getStripElement: createStripElement,
      reorderCollisionDetection,
    });

    expect(collisionDetection(createCollisionArgs(null))).toEqual([
      reorderCollision,
    ]);
  });
});
