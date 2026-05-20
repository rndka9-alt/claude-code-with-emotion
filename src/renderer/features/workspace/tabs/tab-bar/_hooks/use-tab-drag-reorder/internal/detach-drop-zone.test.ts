import { describe, expect, it } from "vitest";
import { shouldDetachTabOnDrop } from "./detach-drop-zone";

const stripRect = new DOMRect(0, 0, 420, 32);

describe("shouldDetachTabOnDrop", () => {
  it("keeps a tab attached when the pointer is inside the expanded reorder zone", () => {
    expect(
      shouldDetachTabOnDrop({
        pointerPosition: {
          clientX: 80,
          clientY: 90,
          screenX: 480,
          screenY: 190,
        },
        stripRect,
      }),
    ).toBe(false);
  });

  it("keeps a tab attached when the pointer is slightly above the tab strip", () => {
    expect(
      shouldDetachTabOnDrop({
        pointerPosition: {
          clientX: 80,
          clientY: -24,
          screenX: 480,
          screenY: 76,
        },
        stripRect,
      }),
    ).toBe(false);
  });

  it("keeps a tab attached when the pointer is slightly left of the tab strip", () => {
    expect(
      shouldDetachTabOnDrop({
        pointerPosition: {
          clientX: -24,
          clientY: 16,
          screenX: 376,
          screenY: 116,
        },
        stripRect,
      }),
    ).toBe(false);
  });

  it("detaches a tab when the pointer is beyond the expanded reorder zone", () => {
    expect(
      shouldDetachTabOnDrop({
        pointerPosition: {
          clientX: 80,
          clientY: 150,
          screenX: 480,
          screenY: 250,
        },
        stripRect,
      }),
    ).toBe(true);
  });

  it("detaches a tab when the pointer is horizontally beyond the expanded reorder zone", () => {
    expect(
      shouldDetachTabOnDrop({
        pointerPosition: {
          clientX: 520,
          clientY: 16,
          screenX: 920,
          screenY: 116,
        },
        stripRect,
      }),
    ).toBe(true);
  });
});
