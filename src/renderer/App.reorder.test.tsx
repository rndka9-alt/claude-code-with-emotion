import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { App } from "./App";

function requireParentElement(element: HTMLElement): HTMLElement {
  if (!(element.parentElement instanceof HTMLElement)) {
    throw new Error("Expected tab button to have an HTMLElement parent.");
  }

  return element.parentElement;
}

function installDetachedWorkspaceWindowBridge() {
  const hideTabDragPreview = vi.fn();
  const moveTabDragPreview = vi.fn();
  const openDetachedWorkspaceWindow = vi.fn().mockResolvedValue(undefined);
  const showTabDragPreview = vi.fn();

  Object.defineProperty(window, "claudeApp", {
    configurable: true,
    value: {
      workspaceCwd: "/tmp/claude-code-with-emotion",
      terminals: {
        bootstrapSession: vi.fn().mockResolvedValue({
          outputSnapshot: "",
          outputVersion: 0,
        }),
        closeSession: vi.fn().mockResolvedValue(undefined),
        onExit: vi.fn(() => () => {}),
        onOutput: vi.fn(() => () => {}),
        resizeSession: vi.fn().mockResolvedValue(undefined),
        sendInput: vi.fn().mockResolvedValue(undefined),
      },
      workspaceCommands: {
        onOpenTerminalSearch: vi.fn(() => () => {}),
      },
      workspaceWindows: {
        attachWorkspaceStateToWindowAtPoint: vi.fn().mockResolvedValue(false),
        closeCurrentWorkspaceWindow: vi.fn().mockResolvedValue(undefined),
        hideTabDragPreview,
        moveTabDragPreview,
        onAttachWorkspaceState: vi.fn(() => () => {}),
        openDetachedWorkspaceWindow,
        showTabDragPreview,
      },
    },
  });

  return {
    hideTabDragPreview,
    moveTabDragPreview,
    openDetachedWorkspaceWindow,
    showTabDragPreview,
  };
}

describe("App tab reordering", () => {
  it("reorders tabs live while dragging in the tab strip", async () => {
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

        const container =
          this.getAttribute("role") === "presentation"
            ? this
            : this.closest('[role="presentation"]');

        if (!(container instanceof HTMLElement)) {
          return new DOMRect(0, 0, 0, 0);
        }

        return tabRects.get(container) ?? new DOMRect(0, 0, 0, 0);
      };

    try {
      act(() => {
        fireEvent.mouseDown(thirdTab, {
          button: 0,
          buttons: 1,
          clientX: 430,
          clientY: 12,
        });
      });
      act(() => {
        fireEvent.mouseMove(document, {
          buttons: 1,
          clientX: 420,
          clientY: 12,
        });
      });
      act(() => {
        fireEvent.mouseMove(document, {
          buttons: 1,
          clientX: 40,
          clientY: 12,
        });
      });
      act(() => {
        fireEvent.mouseUp(document, {
          clientX: 40,
          clientY: 12,
        });
      });
    } finally {
      HTMLElement.prototype.getBoundingClientRect =
        originalGetBoundingClientRect;
    }

    await waitFor(() => {
      const tabs = screen.getAllByRole("tab");
      expect(tabs[0]).toHaveAccessibleName(
        "new session 3 · claude-code-with-emotion",
      );
    });
  });

  it("detaches a dragged tab when it is dropped below the tab strip", async () => {
    const {
      hideTabDragPreview,
      openDetachedWorkspaceWindow,
      showTabDragPreview,
    } = installDetachedWorkspaceWindowBridge();

    render(<App />);

    fireEvent.keyDown(window, {
      key: "t",
      metaKey: true,
    });

    const firstTab = screen.getByRole("tab", {
      name: "new session 1 · claude-code-with-emotion",
    });
    const secondTab = screen.getByRole("tab", {
      name: "new session 2 · claude-code-with-emotion",
    });
    const firstTabContainer = requireParentElement(firstTab);
    const secondTabContainer = requireParentElement(secondTab);
    const strip = screen.getByRole("tablist", {
      name: "Terminal sessions",
    });
    const stripRect = new DOMRect(0, 0, 420, 32);
    const tabRects = new Map<HTMLElement, DOMRect>([
      [firstTabContainer, new DOMRect(0, 0, 180, 28)],
      [secondTabContainer, new DOMRect(182, 0, 180, 28)],
    ]);
    const originalGetBoundingClientRect =
      HTMLElement.prototype.getBoundingClientRect;

    HTMLElement.prototype.getBoundingClientRect =
      function getBoundingClientRect(): DOMRect {
        if (!(this instanceof HTMLElement)) {
          return new DOMRect(0, 0, 0, 0);
        }

        if (this === strip) {
          return stripRect;
        }

        const container =
          this.getAttribute("role") === "presentation"
            ? this
            : this.closest('[role="presentation"]');

        if (!(container instanceof HTMLElement)) {
          return new DOMRect(0, 0, 0, 0);
        }

        return tabRects.get(container) ?? new DOMRect(0, 0, 0, 0);
      };

    try {
      act(() => {
        fireEvent.mouseDown(firstTab, {
          button: 0,
          buttons: 1,
          clientX: 40,
          clientY: 12,
          screenX: 440,
          screenY: 112,
        });
      });
      act(() => {
        fireEvent.mouseMove(document, {
          buttons: 1,
          clientX: 80,
          clientY: 20,
          screenX: 480,
          screenY: 120,
        });
      });
      act(() => {
        fireEvent.mouseMove(document, {
          buttons: 1,
          clientX: 80,
          clientY: 150,
          screenX: 480,
          screenY: 250,
        });
      });
      act(() => {
        fireEvent.mouseUp(document, {
          clientX: 80,
          clientY: 150,
          screenX: 480,
          screenY: 250,
        });
      });

      expect(showTabDragPreview).toHaveBeenCalledWith({
        screenPoint: {
          x: 480,
          y: 250,
        },
        title: "new session 1 · claude-code-with-emotion",
      });
      expect(hideTabDragPreview).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(openDetachedWorkspaceWindow).toHaveBeenCalledTimes(1);
      });
      expect(openDetachedWorkspaceWindow).toHaveBeenCalledWith({
        initialScreenPoint: {
          x: 480,
          y: 250,
        },
        initialWorkspaceState: expect.objectContaining({
          tabs: [
            expect.objectContaining({
              title: "new session 1 · claude-code-with-emotion",
            }),
          ],
        }),
      });
      await waitFor(() => {
        expect(screen.getAllByRole("tab")).toHaveLength(1);
      });
      expect(
        screen.getByRole("tab", {
          name: "new session 2 · claude-code-with-emotion",
        }),
      ).toBeInTheDocument();
    } finally {
      HTMLElement.prototype.getBoundingClientRect =
        originalGetBoundingClientRect;
      Reflect.deleteProperty(window, "claudeApp");
    }
  });

  it("keeps a dragged tab attached when the mouse is released back inside the tab strip", async () => {
    const {
      hideTabDragPreview,
      openDetachedWorkspaceWindow,
      showTabDragPreview,
    } = installDetachedWorkspaceWindowBridge();

    render(<App />);

    fireEvent.keyDown(window, {
      key: "t",
      metaKey: true,
    });

    const firstTab = screen.getByRole("tab", {
      name: "new session 1 · claude-code-with-emotion",
    });
    const secondTab = screen.getByRole("tab", {
      name: "new session 2 · claude-code-with-emotion",
    });
    const firstTabContainer = requireParentElement(firstTab);
    const secondTabContainer = requireParentElement(secondTab);
    const strip = screen.getByRole("tablist", {
      name: "Terminal sessions",
    });
    const stripRect = new DOMRect(0, 0, 420, 32);
    const tabRects = new Map<HTMLElement, DOMRect>([
      [firstTabContainer, new DOMRect(0, 0, 180, 28)],
      [secondTabContainer, new DOMRect(182, 0, 180, 28)],
    ]);
    const originalGetBoundingClientRect =
      HTMLElement.prototype.getBoundingClientRect;

    HTMLElement.prototype.getBoundingClientRect =
      function getBoundingClientRect(): DOMRect {
        if (!(this instanceof HTMLElement)) {
          return new DOMRect(0, 0, 0, 0);
        }

        if (this === strip) {
          return stripRect;
        }

        const container =
          this.getAttribute("role") === "presentation"
            ? this
            : this.closest('[role="presentation"]');

        if (!(container instanceof HTMLElement)) {
          return new DOMRect(0, 0, 0, 0);
        }

        return tabRects.get(container) ?? new DOMRect(0, 0, 0, 0);
      };

    try {
      act(() => {
        fireEvent.mouseDown(firstTab, {
          button: 0,
          buttons: 1,
          clientX: 40,
          clientY: 12,
          screenX: 440,
          screenY: 112,
        });
      });
      act(() => {
        fireEvent.mouseMove(document, {
          buttons: 1,
          clientX: 80,
          clientY: 150,
          screenX: 480,
          screenY: 250,
        });
      });
      act(() => {
        fireEvent.mouseUp(document, {
          clientX: 80,
          clientY: 20,
          screenX: 480,
          screenY: 120,
        });
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(showTabDragPreview).toHaveBeenCalledWith({
        screenPoint: {
          x: 480,
          y: 250,
        },
        title: "new session 1 · claude-code-with-emotion",
      });
      expect(hideTabDragPreview).toHaveBeenCalledTimes(1);
      expect(openDetachedWorkspaceWindow).not.toHaveBeenCalled();
      expect(screen.getAllByRole("tab")).toHaveLength(2);
    } finally {
      HTMLElement.prototype.getBoundingClientRect =
        originalGetBoundingClientRect;
      Reflect.deleteProperty(window, "claudeApp");
    }
  });

  it.skip("activates a reordered tab on the next click", async () => {
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

        const container =
          this.getAttribute("role") === "presentation"
            ? this
            : this.closest('[role="presentation"]');

        if (!(container instanceof HTMLElement)) {
          return new DOMRect(0, 0, 0, 0);
        }

        return tabRects.get(container) ?? new DOMRect(0, 0, 0, 0);
      };

    try {
      act(() => {
        fireEvent.mouseDown(thirdTab, {
          button: 0,
          buttons: 1,
          clientX: 430,
          clientY: 12,
        });
      });
      act(() => {
        fireEvent.mouseMove(document, {
          buttons: 1,
          clientX: 420,
          clientY: 12,
        });
      });
      act(() => {
        fireEvent.mouseMove(document, {
          buttons: 1,
          clientX: 40,
          clientY: 12,
        });
      });
      act(() => {
        fireEvent.mouseUp(document, {
          clientX: 40,
          clientY: 12,
        });
      });
    } finally {
      HTMLElement.prototype.getBoundingClientRect =
        originalGetBoundingClientRect;
    }

    await waitFor(() => {
      const reorderedTab = screen.getAllByRole("tab")[0];
      expect(reorderedTab).toHaveAccessibleName(
        "new session 3 · claude-code-with-emotion",
      );
    });

    act(() => {
      const reorderedTab = screen.getByRole("tab", {
        name: "new session 1 · claude-code-with-emotion",
      });

      fireEvent.mouseDown(reorderedTab, {
        button: 0,
        buttons: 1,
      });
      fireEvent.mouseUp(reorderedTab, {
        button: 0,
      });
      fireEvent.click(reorderedTab);
    });

    await waitFor(() => {
      expect(
        screen.getByRole("tab", {
          name: "new session 1 · claude-code-with-emotion",
        }),
      ).toHaveAttribute("aria-selected", "true");
    });
  });

  it("auto-scrolls the tab strip while dragging near the edge", async () => {
    render(<App />);

    fireEvent.keyDown(window, {
      key: "t",
      metaKey: true,
    });
    fireEvent.keyDown(window, {
      key: "t",
      metaKey: true,
    });
    fireEvent.keyDown(window, {
      key: "t",
      metaKey: true,
    });
    fireEvent.keyDown(window, {
      key: "t",
      metaKey: true,
    });

    const strip = screen.getByRole("tablist", {
      name: "Terminal sessions",
    });
    const firstTab = screen.getByRole("tab", {
      name: "new session 1 · claude-code-with-emotion",
    });
    const firstTabContainer = requireParentElement(firstTab);
    const stripRect = new DOMRect(0, 0, 240, 32);
    let scrollLeft = 0;
    let animationFrameId = 0;
    const animationFrameCallbacks = new Map<number, FrameRequestCallback>();
    const originalGetBoundingClientRect =
      HTMLElement.prototype.getBoundingClientRect;

    Object.defineProperty(strip, "clientWidth", {
      configurable: true,
      value: stripRect.width,
    });
    Object.defineProperty(strip, "scrollWidth", {
      configurable: true,
      value: 940,
    });
    Object.defineProperty(strip, "scrollLeft", {
      configurable: true,
      get() {
        return scrollLeft;
      },
      set(value: number) {
        scrollLeft = value;
      },
    });

    HTMLElement.prototype.getBoundingClientRect =
      function getBoundingClientRect(): DOMRect {
        if (!(this instanceof HTMLElement)) {
          return new DOMRect(0, 0, 0, 0);
        }

        if (this === strip) {
          return stripRect;
        }

        const container =
          this.getAttribute("role") === "presentation"
            ? this
            : this.closest('[role="presentation"]');

        if (!(container instanceof HTMLElement)) {
          return new DOMRect(0, 0, 0, 0);
        }

        const tabContainers = Array.from(strip.children).filter((child) => {
          return (
            child instanceof HTMLElement &&
            child.getAttribute("role") === "presentation"
          );
        });
        const index = tabContainers.indexOf(container);

        if (index < 0) {
          return new DOMRect(0, 0, 0, 0);
        }

        return new DOMRect(
          stripRect.left + index * 182 - scrollLeft,
          stripRect.top,
          180,
          28,
        );
      };

    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        animationFrameId += 1;
        animationFrameCallbacks.set(animationFrameId, callback);
        return animationFrameId;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation((frameId: number) => {
        animationFrameCallbacks.delete(frameId);
      });

    function flushNextAnimationFrame(timestamp: number): boolean {
      const nextFrame = animationFrameCallbacks.entries().next().value;

      if (nextFrame === undefined) {
        return false;
      }

      const [frameId, callback] = nextFrame;
      animationFrameCallbacks.delete(frameId);

      act(() => {
        callback(timestamp);
      });

      return true;
    }

    try {
      act(() => {
        fireEvent.mouseDown(firstTab, {
          button: 0,
          buttons: 1,
          clientX: 40,
          clientY: 12,
        });
      });
      act(() => {
        fireEvent.mouseMove(document, {
          buttons: 1,
          clientX: 300,
          clientY: 12,
        });
      });
      expect(animationFrameCallbacks.size).toBeGreaterThan(0);

      for (let frame = 1; frame <= 60; frame += 1) {
        if (!flushNextAnimationFrame(frame * 16)) {
          break;
        }
      }

      act(() => {
        fireEvent.mouseUp(document, {
          clientX: 300,
          clientY: 12,
        });
      });
      await act(async () => {
        await Promise.resolve();
      });
    } finally {
      HTMLElement.prototype.getBoundingClientRect =
        originalGetBoundingClientRect;
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    }

    expect(scrollLeft).toBeGreaterThan(0);
  });
});
