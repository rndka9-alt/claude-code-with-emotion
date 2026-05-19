import { describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => {
  return {
    getAllDisplays: vi.fn(),
    getDisplayNearestPoint: vi.fn(),
  };
});

vi.mock("electron", () => {
  return {
    screen: electronMock,
  };
});

import { resolveInitialWindowBounds } from "./initial-window-bounds";

const primaryDisplay = {
  workArea: {
    x: 0,
    y: 0,
    width: 1440,
    height: 900,
  },
};

describe("resolveInitialWindowBounds", () => {
  it("places a dragged detached window near the drag screen point", () => {
    electronMock.getDisplayNearestPoint.mockReturnValue(primaryDisplay);

    expect(
      resolveInitialWindowBounds(
        {
          x: 30,
          y: 40,
          width: 900,
          height: 700,
        },
        { x: 600, y: 140 },
      ),
    ).toEqual({
      x: 480,
      y: 122,
      width: 900,
      height: 700,
    });
  });

  it("keeps a dragged detached window inside the nearest display work area", () => {
    electronMock.getDisplayNearestPoint.mockReturnValue(primaryDisplay);

    expect(resolveInitialWindowBounds(null, { x: 20, y: 12 })).toEqual({
      x: 0,
      y: 0,
      width: 920,
      height: 680,
    });
  });
});
