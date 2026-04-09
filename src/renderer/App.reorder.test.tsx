import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "./App";

function requireParentElement(element: HTMLElement): HTMLElement {
  if (!(element.parentElement instanceof HTMLElement)) {
    throw new Error("Expected tab button to have an HTMLElement parent.");
  }

  return element.parentElement;
}

describe("App tab reordering", () => {
  it("reorders tabs live while dragging in the tab strip", () => {
    render(<App />);

    fireEvent.keyDown(window, {
      key: "t",
      metaKey: true,
    });
    fireEvent.keyDown(window, {
      key: "t",
      metaKey: true,
    });

    const firstTab = screen.getByRole("tab", {
      name: "new session 1 · claude-code-with-emotion",
    });
    const thirdTab = screen.getByRole("tab", {
      name: "new session 3 · claude-code-with-emotion",
    });
    const middleTab = screen.getByRole("tab", {
      name: "new session 2 · claude-code-with-emotion",
    });
    const firstTabContainer = requireParentElement(firstTab);
    const middleTabContainer = requireParentElement(middleTab);
    const thirdTabContainer = requireParentElement(thirdTab);

    const tabRects = new Map<HTMLElement, DOMRect>([
      [firstTabContainer, new DOMRect(0, 0, 180, 28)],
      [middleTabContainer, new DOMRect(182, 0, 180, 28)],
      [thirdTabContainer, new DOMRect(364, 0, 180, 28)],
    ]);
    const originalGetBoundingClientRect =
      HTMLElement.prototype.getBoundingClientRect;

    HTMLElement.prototype.getBoundingClientRect =
      function getBoundingClientRect(): DOMRect {
        if (!(this instanceof HTMLElement)) {
          return new DOMRect(0, 0, 0, 0);
        }

        return tabRects.get(this) ?? new DOMRect(0, 0, 0, 0);
      };

    try {
      fireEvent.pointerDown(thirdTabContainer, {
        button: 0,
        clientX: 430,
        clientY: 12,
        pointerId: 1,
      });
      fireEvent.pointerMove(window, {
        clientX: 40,
        clientY: 12,
        pointerId: 1,
      });
      fireEvent.pointerUp(window, {
        clientX: 40,
        clientY: 12,
        pointerId: 1,
      });
    } finally {
      HTMLElement.prototype.getBoundingClientRect =
        originalGetBoundingClientRect;
    }

    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAccessibleName(
      "new session 3 · claude-code-with-emotion",
    );
  });

  it("activates a reordered tab on the next click", () => {
    render(<App />);

    fireEvent.keyDown(window, {
      key: "t",
      metaKey: true,
    });
    fireEvent.keyDown(window, {
      key: "t",
      metaKey: true,
    });

    const firstTab = screen.getByRole("tab", {
      name: "new session 1 · claude-code-with-emotion",
    });
    const thirdTab = screen.getByRole("tab", {
      name: "new session 3 · claude-code-with-emotion",
    });
    const middleTab = screen.getByRole("tab", {
      name: "new session 2 · claude-code-with-emotion",
    });
    const firstTabContainer = requireParentElement(firstTab);
    const middleTabContainer = requireParentElement(middleTab);
    const thirdTabContainer = requireParentElement(thirdTab);

    const tabRects = new Map<HTMLElement, DOMRect>([
      [firstTabContainer, new DOMRect(0, 0, 180, 28)],
      [middleTabContainer, new DOMRect(182, 0, 180, 28)],
      [thirdTabContainer, new DOMRect(364, 0, 180, 28)],
    ]);
    const originalGetBoundingClientRect =
      HTMLElement.prototype.getBoundingClientRect;

    HTMLElement.prototype.getBoundingClientRect =
      function getBoundingClientRect(): DOMRect {
        if (!(this instanceof HTMLElement)) {
          return new DOMRect(0, 0, 0, 0);
        }

        return tabRects.get(this) ?? new DOMRect(0, 0, 0, 0);
      };

    try {
      fireEvent.pointerDown(thirdTabContainer, {
        button: 0,
        clientX: 430,
        clientY: 12,
        pointerId: 1,
      });
      fireEvent.pointerMove(window, {
        clientX: 40,
        clientY: 12,
        pointerId: 1,
      });
      fireEvent.pointerUp(window, {
        clientX: 40,
        clientY: 12,
        pointerId: 1,
      });
    } finally {
      HTMLElement.prototype.getBoundingClientRect =
        originalGetBoundingClientRect;
    }

    fireEvent.click(
      screen.getByRole("tab", {
        name: "new session 1 · claude-code-with-emotion",
      }),
    );

    expect(
      screen.getByRole("tab", {
        name: "new session 1 · claude-code-with-emotion",
      }),
    ).toHaveAttribute("aria-selected", "true");
  });
});
