import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "./App";

describe("App tab reordering", () => {
  it("reorders tabs live while dragging in the tab strip", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "New Session" }));
    fireEvent.click(screen.getByRole("button", { name: "New Session" }));

    const firstTab = screen.getByRole("tab", {
      name: "new session 1 · claude-code-with-emotion",
    });
    const thirdTab = screen.getByRole("tab", {
      name: "new session 3 · claude-code-with-emotion",
    });
    const middleTab = screen.getByRole("tab", {
      name: "new session 2 · claude-code-with-emotion",
    });

    const tabRects = new Map<HTMLElement, DOMRect>([
      [firstTab.parentElement as HTMLElement, new DOMRect(0, 0, 180, 28)],
      [middleTab.parentElement as HTMLElement, new DOMRect(182, 0, 180, 28)],
      [thirdTab.parentElement as HTMLElement, new DOMRect(364, 0, 180, 28)],
    ]);
    const originalGetBoundingClientRect =
      HTMLElement.prototype.getBoundingClientRect;

    HTMLElement.prototype.getBoundingClientRect =
      function getBoundingClientRect(): DOMRect {
        return tabRects.get(this as HTMLElement) ?? new DOMRect(0, 0, 0, 0);
      };

    try {
      fireEvent.pointerDown(thirdTab.parentElement as HTMLElement, {
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

    fireEvent.click(screen.getByRole("button", { name: "New Session" }));
    fireEvent.click(screen.getByRole("button", { name: "New Session" }));

    const firstTab = screen.getByRole("tab", {
      name: "new session 1 · claude-code-with-emotion",
    });
    const thirdTab = screen.getByRole("tab", {
      name: "new session 3 · claude-code-with-emotion",
    });
    const middleTab = screen.getByRole("tab", {
      name: "new session 2 · claude-code-with-emotion",
    });

    const tabRects = new Map<HTMLElement, DOMRect>([
      [firstTab.parentElement as HTMLElement, new DOMRect(0, 0, 180, 28)],
      [middleTab.parentElement as HTMLElement, new DOMRect(182, 0, 180, 28)],
      [thirdTab.parentElement as HTMLElement, new DOMRect(364, 0, 180, 28)],
    ]);
    const originalGetBoundingClientRect =
      HTMLElement.prototype.getBoundingClientRect;

    HTMLElement.prototype.getBoundingClientRect =
      function getBoundingClientRect(): DOMRect {
        return tabRects.get(this as HTMLElement) ?? new DOMRect(0, 0, 0, 0);
      };

    try {
      fireEvent.pointerDown(thirdTab.parentElement as HTMLElement, {
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
