import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { TerminalOutputEvent } from "../../../../shared/terminal-bridge";
import { TerminalSurface } from "./TerminalSurface";
import { handleTerminalExternalBrowserClick } from "./terminal-session-registry";

const {
  MockSearchAddon,
  searchAddonInstances,
  MockTerminal,
  terminalInstances,
} = vi.hoisted(() => {
  const hoistedTerminalInstances: Array<{
    _core: {
      _renderService: {
        dimensions: {
          css: {
            cell: {
              height: number;
              width: number;
            };
          };
        };
      };
      viewport: {
        scrollBarWidth: number;
      };
    };
    attachCustomKeyEventHandler: ReturnType<typeof vi.fn>;
    buffer: {
      active: {
        baseY: number;
        cursorY: number;
        getLine: ReturnType<typeof vi.fn>;
        length: number;
        type: "alternate" | "normal";
        viewportY: number;
      };
    };
    clearSelection: ReturnType<typeof vi.fn>;
    cols: number;
    dispose: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
    getSelectionPosition: ReturnType<typeof vi.fn>;
    loadAddon: ReturnType<typeof vi.fn>;
    onData: ReturnType<typeof vi.fn>;
    onCursorMove: ReturnType<typeof vi.fn>;
    onScroll: ReturnType<typeof vi.fn>;
    onTitleChange: ReturnType<typeof vi.fn>;
    open: ReturnType<typeof vi.fn>;
    options: { scrollback: number };
    registerLinkProvider: ReturnType<typeof vi.fn>;
    resize: ReturnType<typeof vi.fn>;
    rows: number;
    scrollToBottom: ReturnType<typeof vi.fn>;
    scrollLines: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
  }> = [];

  const hoistedSearchAddonInstances: Array<{
    clearActiveDecoration: ReturnType<typeof vi.fn>;
    clearDecorations: ReturnType<typeof vi.fn>;
    findNext: ReturnType<typeof vi.fn>;
    findPrevious: ReturnType<typeof vi.fn>;
    onDidChangeResults: ReturnType<typeof vi.fn>;
  }> = [];

  class HoistedMockSearchAddon {
    clearActiveDecoration = vi.fn();
    clearDecorations = vi.fn();
    findNext = vi.fn(() => true);
    findPrevious = vi.fn(() => true);
    onDidChangeResults = vi.fn(() => ({ dispose: vi.fn() }));

    constructor() {
      hoistedSearchAddonInstances.push(this);
    }
  }

  class HoistedMockTerminal {
    cols = 80;
    rows = 24;
    _core = {
      _renderService: {
        dimensions: {
          css: {
            cell: {
              height: 16,
              width: 8,
            },
          },
        },
      },
      viewport: {
        scrollBarWidth: 0,
      },
    };
    private selectionPosition:
      | { end: { x: number; y: number }; start: { x: number; y: number } }
      | undefined;
    options = { scrollback: 1000 };
    buffer = {
      active: {
        baseY: 0,
        cursorY: 0,
        getLine: vi.fn((row: number) => {
          if (row !== 0) {
            return undefined;
          }

          return {
            isWrapped: false,
            translateToString: () => "claude and claude",
          };
        }),
        length: 1,
        type: "normal" as const,
        viewportY: 0,
      },
    };
    clearSelection = vi.fn(() => {
      this.selectionPosition = undefined;
    });
    focus = vi.fn();
    getSelectionPosition = vi.fn(() => this.selectionPosition);
    loadAddon = vi.fn();
    open = vi.fn();
    resize = vi.fn((cols: number, rows: number) => {
      this.cols = cols;
      this.rows = rows;
    });
    scrollToBottom = vi.fn(() => {
      this.buffer.active.viewportY = this.buffer.active.baseY;
    });
    scrollLines = vi.fn((lineCount: number) => {
      this.buffer.active.viewportY += lineCount;
    });
    select = vi.fn((column: number, row: number, length: number) => {
      this.selectionPosition = {
        end: { x: column + length + 1, y: row + 1 },
        start: { x: column + 1, y: row + 1 },
      };
    });
    write = vi.fn();
    dispose = vi.fn();
    attachCustomKeyEventHandler = vi.fn();
    onData = vi.fn(() => ({ dispose: vi.fn() }));
    onCursorMove = vi.fn(() => ({ dispose: vi.fn() }));
    onScroll = vi.fn(() => ({ dispose: vi.fn() }));
    onTitleChange = vi.fn(() => ({ dispose: vi.fn() }));
    registerLinkProvider = vi.fn(() => ({ dispose: vi.fn() }));

    constructor() {
      hoistedTerminalInstances.push(this);
    }
  }

  return {
    MockSearchAddon: HoistedMockSearchAddon,
    searchAddonInstances: hoistedSearchAddonInstances,
    MockTerminal: HoistedMockTerminal,
    terminalInstances: hoistedTerminalInstances,
  };
});

vi.mock("@xterm/xterm", () => {
  return {
    Terminal: MockTerminal,
  };
});

vi.mock("@xterm/addon-search", () => {
  return {
    SearchAddon: MockSearchAddon,
  };
});

function requireElement<TElement extends Element>(
  element: TElement | null,
  message: string,
): TElement {
  if (element === null) {
    throw new Error(message);
  }

  return element;
}

describe("TerminalSurface", () => {
  let openExternal: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    searchAddonInstances.length = 0;
    terminalInstances.length = 0;
    openExternal = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(window, "claudeApp", {
      configurable: true,
      value: {
        links: {
          openExternal,
        },
        terminals: {
          bootstrapSession: vi.fn().mockResolvedValue({
            outputSnapshot: "",
            outputVersion: 0,
          }),
          sendInput: vi.fn().mockResolvedValue(undefined),
          resizeSession: vi.fn().mockResolvedValue(undefined),
          closeSession: vi.fn().mockResolvedValue(undefined),
          onOutput: vi.fn(() => () => {}),
          onExit: vi.fn(() => () => {}),
        },
      },
    });
  });

  it("opens terminal browser links through the Electron links bridge", () => {
    const anchor = document.createElement("a");
    const preventDefault = vi.fn();

    anchor.href = "http://localhost:3000";
    anchor.textContent = "Local app";

    handleTerminalExternalBrowserClick(
      {
        defaultPrevented: false,
        preventDefault,
        target: anchor,
      },
      openExternal,
    );

    expect(openExternal).toHaveBeenCalledWith("http://localhost:3000/");
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it("ignores non-browser terminal links for now", () => {
    const anchor = document.createElement("a");
    const preventDefault = vi.fn();

    anchor.href = "intent://open/example";
    anchor.textContent = "Intent app";

    handleTerminalExternalBrowserClick(
      {
        defaultPrevented: false,
        preventDefault,
        target: anchor,
      },
      openExternal,
    );

    expect(openExternal).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("refocuses the terminal when the focus request key changes", () => {
    const session = {
      id: "session-1",
      title: "new session 1 · claude-code-with-emotion",
      cwd: "/tmp",
      command: "",
      lifecycle: "bootstrapping" as const,
      createdAtMs: Date.now(),
    };
    const { rerender } = render(
      <TerminalSurface
        focusRequestKey={0}
        isActive={true}
        onFocusPane={vi.fn()}
        onSearchResultsChange={vi.fn()}
        onTitleChange={vi.fn()}
        paneId="pane-1"
        searchRequest={null}
        session={session}
      />,
    );

    const terminal = terminalInstances[0];

    expect(terminal).toBeDefined();
    expect(terminal?.focus).toHaveBeenCalledTimes(1);

    rerender(
      <TerminalSurface
        focusRequestKey={1}
        isActive={true}
        onFocusPane={vi.fn()}
        onSearchResultsChange={vi.fn()}
        onTitleChange={vi.fn()}
        paneId="pane-1"
        searchRequest={null}
        session={session}
      />,
    );

    expect(terminal?.focus).toHaveBeenCalledTimes(2);
  });

  it("focuses the terminal again when the viewport is clicked", () => {
    const session = {
      id: "session-1",
      title: "new session 1 · claude-code-with-emotion",
      cwd: "/tmp",
      command: "",
      lifecycle: "bootstrapping" as const,
      createdAtMs: Date.now(),
    };
    const { container } = render(
      <TerminalSurface
        focusRequestKey={0}
        isActive={true}
        onFocusPane={vi.fn()}
        onSearchResultsChange={vi.fn()}
        onTitleChange={vi.fn()}
        paneId="pane-1"
        searchRequest={null}
        session={session}
      />,
    );

    const terminal = terminalInstances[0];
    const viewport = container.querySelector(".terminal-surface__viewport");

    expect(terminal).toBeDefined();
    expect(viewport).not.toBeNull();

    fireEvent.mouseDown(
      requireElement(viewport, "Expected terminal viewport to exist."),
    );

    expect(terminal?.focus).toHaveBeenCalledTimes(2);
  });

  it("replays the saved output snapshot and ignores duplicate live chunks", async () => {
    const outputListeners: Array<(event: TerminalOutputEvent) => void> = [];

    Object.defineProperty(window, "claudeApp", {
      configurable: true,
      value: {
        terminals: {
          bootstrapSession: vi.fn().mockResolvedValue({
            outputSnapshot: "saved output",
            outputVersion: 1,
          }),
          sendInput: vi.fn().mockResolvedValue(undefined),
          resizeSession: vi.fn().mockResolvedValue(undefined),
          closeSession: vi.fn().mockResolvedValue(undefined),
          onOutput: vi.fn((listener) => {
            outputListeners.push(listener);
            return () => {};
          }),
          onExit: vi.fn(() => () => {}),
        },
      },
    });

    render(
      <TerminalSurface
        focusRequestKey={0}
        isActive={true}
        onFocusPane={vi.fn()}
        onSearchResultsChange={vi.fn()}
        onTitleChange={vi.fn()}
        paneId="pane-1"
        searchRequest={null}
        session={{
          id: "session-1",
          title: "new session 1 · claude-code-with-emotion",
          cwd: "/tmp",
          command: "",
          lifecycle: "bootstrapping",
          createdAtMs: Date.now(),
        }}
      />,
    );

    const terminal = terminalInstances[0];

    await waitFor(() => {
      expect(terminal?.write).toHaveBeenCalledWith("saved output");
    });

    const emitOutput = outputListeners[0];

    expect(emitOutput).toBeDefined();

    if (emitOutput === undefined) {
      throw new Error("Expected the terminal output listener to be registered");
    }

    emitOutput({
      sessionId: "session-1",
      data: "saved output",
      outputVersion: 1,
    });
    emitOutput({
      sessionId: "session-1",
      data: "\r\nnext line",
      outputVersion: 2,
    });

    await waitFor(() => {
      expect(terminal?.write).toHaveBeenCalledWith("\r\nnext line");
    });

    expect(
      terminal?.write.mock.calls.filter(([value]) => value === "saved output"),
    ).toHaveLength(1);
  });

  it("previews search results without moving the terminal selection", () => {
    const onSearchResultsChange = vi.fn();

    render(
      <TerminalSurface
        focusRequestKey={0}
        isActive={true}
        onFocusPane={vi.fn()}
        onSearchResultsChange={onSearchResultsChange}
        onTitleChange={vi.fn()}
        paneId="pane-1"
        searchRequest={{
          anchorIndex: null,
          direction: "next",
          mode: "preview",
          query: "claude",
          sequence: 1,
          sessionId: "session-1",
        }}
        session={{
          id: "session-1",
          title: "new session 1 · claude-code-with-emotion",
          cwd: "/tmp",
          command: "",
          lifecycle: "bootstrapping",
          createdAtMs: Date.now(),
        }}
      />,
    );

    const terminal = terminalInstances[0];

    expect(terminal).toBeDefined();
    expect(terminal?.select).not.toHaveBeenCalled();
    expect(terminal?.scrollLines).not.toHaveBeenCalled();
    expect(onSearchResultsChange).toHaveBeenCalledWith({
      hasMatch: true,
      resultCount: 2,
      resultIndex: 0,
      sessionId: "session-1",
    });
  });

  it("moves to the next match after the preview anchor when the user presses next", async () => {
    const onSearchResultsChange = vi.fn();

    render(
      <TerminalSurface
        focusRequestKey={0}
        isActive={true}
        onFocusPane={vi.fn()}
        onSearchResultsChange={onSearchResultsChange}
        onTitleChange={vi.fn()}
        paneId="pane-1"
        searchRequest={{
          anchorIndex: 0,
          direction: "next",
          mode: "navigate",
          query: "claude",
          sequence: 1,
          sessionId: "session-1",
        }}
        session={{
          id: "session-1",
          title: "new session 1 · claude-code-with-emotion",
          cwd: "/tmp",
          command: "",
          lifecycle: "bootstrapping",
          createdAtMs: Date.now(),
        }}
      />,
    );

    const terminal = terminalInstances[0];

    await waitFor(() => {
      expect(onSearchResultsChange).toHaveBeenCalledWith({
        hasMatch: true,
        resultCount: 2,
        resultIndex: 1,
        sessionId: "session-1",
      });
    });
    expect(terminal?.select).toHaveBeenCalledWith(11, 0, 6);
  });

  it("applies each navigate request only once even if rerenders update the anchor", async () => {
    const onSearchResultsChange = vi.fn();
    const session = {
      id: "session-1",
      title: "new session 1 · claude-code-with-emotion",
      cwd: "/tmp",
      command: "",
      lifecycle: "bootstrapping" as const,
      createdAtMs: Date.now(),
    };
    const { rerender } = render(
      <TerminalSurface
        focusRequestKey={0}
        isActive={true}
        onFocusPane={vi.fn()}
        onSearchResultsChange={onSearchResultsChange}
        onTitleChange={vi.fn()}
        paneId="pane-1"
        searchRequest={{
          anchorIndex: 0,
          direction: "next",
          mode: "navigate",
          query: "claude",
          sequence: 7,
          sessionId: "session-1",
        }}
        session={session}
      />,
    );

    const terminal = terminalInstances[0];

    await waitFor(() => {
      expect(terminal?.select).toHaveBeenCalledTimes(1);
    });

    rerender(
      <TerminalSurface
        focusRequestKey={0}
        isActive={true}
        onFocusPane={vi.fn()}
        onSearchResultsChange={onSearchResultsChange}
        onTitleChange={vi.fn()}
        paneId="pane-1"
        searchRequest={{
          anchorIndex: 1,
          direction: "next",
          mode: "navigate",
          query: "claude",
          sequence: 7,
          sessionId: "session-1",
        }}
        session={session}
      />,
    );

    expect(terminal?.select).toHaveBeenCalledTimes(1);
  });

  it("keeps using the stored anchor index instead of recomputing from scroll position", async () => {
    const onSearchResultsChange = vi.fn();
    const session = {
      id: "session-1",
      title: "new session 1 · claude-code-with-emotion",
      cwd: "/tmp",
      command: "",
      lifecycle: "bootstrapping" as const,
      createdAtMs: Date.now(),
    };
    const { rerender } = render(
      <TerminalSurface
        focusRequestKey={0}
        isActive={true}
        onFocusPane={vi.fn()}
        onSearchResultsChange={onSearchResultsChange}
        onTitleChange={vi.fn()}
        paneId="pane-1"
        searchRequest={null}
        session={session}
      />,
    );

    const terminal = terminalInstances[0];

    if (terminal === undefined) {
      throw new Error("Expected terminal instance to exist.");
    }

    terminal.buffer.active.getLine.mockImplementation((row: number) => {
      if (row === 0) {
        return {
          isWrapped: false,
          translateToString: () => "claude",
        };
      }

      if (row === 1) {
        return {
          isWrapped: false,
          translateToString: () => "claude",
        };
      }

      return undefined;
    });
    terminal.buffer.active.length = 2;
    terminal.buffer.active.viewportY = 1;

    rerender(
      <TerminalSurface
        focusRequestKey={0}
        isActive={true}
        onFocusPane={vi.fn()}
        onSearchResultsChange={onSearchResultsChange}
        onTitleChange={vi.fn()}
        paneId="pane-1"
        searchRequest={{
          anchorIndex: 0,
          direction: "next",
          mode: "navigate",
          query: "claude",
          sequence: 1,
          sessionId: "session-1",
        }}
        session={session}
      />,
    );

    await waitFor(() => {
      expect(onSearchResultsChange).toHaveBeenCalledWith({
        hasMatch: true,
        resultCount: 2,
        resultIndex: 1,
        sessionId: "session-1",
      });
    });
    expect(terminal.select).toHaveBeenCalledWith(0, 1, 6);
  });

  it("reuses the same terminal instance across unmount and remount", () => {
    const session = {
      id: "session-1",
      title: "new session 1 · claude-code-with-emotion",
      cwd: "/tmp",
      command: "",
      lifecycle: "bootstrapping" as const,
      createdAtMs: Date.now(),
    };
    const firstRender = render(
      <TerminalSurface
        focusRequestKey={0}
        isActive={true}
        onFocusPane={vi.fn()}
        onSearchResultsChange={vi.fn()}
        onTitleChange={vi.fn()}
        paneId="pane-1"
        searchRequest={null}
        session={session}
      />,
    );

    expect(terminalInstances).toHaveLength(1);
    expect(terminalInstances[0]?.open).toHaveBeenCalledTimes(1);

    firstRender.unmount();

    render(
      <TerminalSurface
        focusRequestKey={0}
        isActive={true}
        onFocusPane={vi.fn()}
        onSearchResultsChange={vi.fn()}
        onTitleChange={vi.fn()}
        paneId="pane-1"
        searchRequest={null}
        session={session}
      />,
    );

    expect(terminalInstances).toHaveLength(1);
    expect(terminalInstances[0]?.open).toHaveBeenCalledTimes(1);
  });

  it("shows a pin suggestion after typing while manually scrolled away", () => {
    vi.useFakeTimers();

    try {
      const { container } = render(
        <TerminalSurface
          focusRequestKey={0}
          isActive={true}
          onFocusPane={vi.fn()}
          onSearchResultsChange={vi.fn()}
          onTitleChange={vi.fn()}
          paneId="pane-1"
          searchRequest={null}
          session={{
            id: "session-1",
            title: "new session 1 · claude-code-with-emotion",
            cwd: "/tmp",
            command: "",
            lifecycle: "bootstrapping",
            createdAtMs: Date.now(),
          }}
        />,
      );

      const terminal = terminalInstances[0];
      const host = container.querySelector(".terminal-surface__viewport");
      const inputListener = terminal?.onData.mock.calls[0]?.[0];
      const scrollListener = terminal?.onScroll.mock.calls[0]?.[0];

      if (
        terminal === undefined ||
        host === null ||
        typeof inputListener !== "function" ||
        typeof scrollListener !== "function"
      ) {
        throw new Error("Expected the terminal listeners to be registered.");
      }

      act(() => {
        fireEvent.wheel(host);
        terminal.buffer.active.baseY = 20;
        terminal.buffer.active.viewportY = 10;
        scrollListener();
        inputListener("a");
      });

      expect(
        screen.getByRole("button", { name: "Pin terminal input overlay" }),
      ).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(
        screen.queryByRole("button", { name: "Pin terminal input overlay" }),
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens a pinned overlay that follows the cursor band", async () => {
    const originalClientWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientWidth",
    );
    const originalClientHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientHeight",
    );

    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return 640;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return 320;
      },
    });

    try {
      const { container } = render(
        <TerminalSurface
          focusRequestKey={0}
          isActive={true}
          onFocusPane={vi.fn()}
          onSearchResultsChange={vi.fn()}
          onTitleChange={vi.fn()}
          paneId="pane-1"
          searchRequest={null}
          session={{
            id: "session-1",
            title: "new session 1 · claude-code-with-emotion",
            cwd: "/tmp",
            command: "",
            lifecycle: "bootstrapping",
            createdAtMs: Date.now(),
          }}
        />,
      );

      const terminal = terminalInstances[0];
      const host = container.querySelector(".terminal-surface__viewport");
      const cursorMoveListener = terminal?.onCursorMove.mock.calls[0]?.[0];
      const inputListener = terminal?.onData.mock.calls[0]?.[0];
      const scrollListener = terminal?.onScroll.mock.calls[0]?.[0];

      if (
        terminal === undefined ||
        host === null ||
        typeof cursorMoveListener !== "function" ||
        typeof inputListener !== "function" ||
        typeof scrollListener !== "function"
      ) {
        throw new Error("Expected the terminal listeners to be registered.");
      }

      terminal.buffer.active.baseY = 20;
      terminal.buffer.active.cursorY = 18;
      terminal.buffer.active.length = 60;
      terminal.buffer.active.viewportY = 10;
      terminal.buffer.active.getLine.mockImplementation((row: number) => {
        if (row === 38) {
          return {
            isWrapped: true,
            translateToString: () => "wrapped input",
          };
        }

        if (row === 37) {
          return {
            isWrapped: false,
            translateToString: () => "prompt",
          };
        }

        return {
          isWrapped: false,
          translateToString: () => "",
        };
      });

      act(() => {
        cursorMoveListener();
        fireEvent.wheel(host);
        scrollListener();
        inputListener("a");
      });

      fireEvent.click(
        screen.getByRole("button", { name: "Pin terminal input overlay" }),
      );

      await waitFor(() => {
        expect(
          container.querySelector('[data-pinned-terminal-overlay="true"]'),
        ).not.toBeNull();
      });

      expect(
        screen.getByRole("button", { name: "Unpin terminal input overlay" }),
      ).toBeInTheDocument();
      expect(terminalInstances).toHaveLength(2);
      expect(terminalInstances[1]?.open).toHaveBeenCalledTimes(1);

      const scrollContainer = container.querySelector(
        '[data-pinned-terminal-scroll-container="true"]',
      );

      if (!(scrollContainer instanceof HTMLDivElement)) {
        throw new Error("Expected the pinned scroll container to exist.");
      }

      expect(scrollContainer.style.height).toBe("80px");
    } finally {
      if (originalClientWidth !== undefined) {
        Object.defineProperty(
          HTMLElement.prototype,
          "clientWidth",
          originalClientWidth,
        );
      }

      if (originalClientHeight !== undefined) {
        Object.defineProperty(
          HTMLElement.prototype,
          "clientHeight",
          originalClientHeight,
        );
      }
    }
  });

  it("keeps a bottom-anchored viewport pinned after fitting to a resized pane", async () => {
    const originalClientWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientWidth",
    );
    const originalClientHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientHeight",
    );

    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return 640;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return 320;
      },
    });

    try {
      render(
        <TerminalSurface
          focusRequestKey={0}
          isActive={true}
          onFocusPane={vi.fn()}
          onSearchResultsChange={vi.fn()}
          onTitleChange={vi.fn()}
          paneId="pane-1"
          searchRequest={null}
          session={{
            id: "session-1",
            title: "new session 1 · claude-code-with-emotion",
            cwd: "/tmp",
            command: "",
            lifecycle: "bootstrapping",
            createdAtMs: Date.now(),
          }}
        />,
      );

      const terminal = terminalInstances[0];

      if (terminal === undefined) {
        throw new Error("Expected terminal instance to exist.");
      }

      terminal.buffer.active.baseY = 120;
      terminal.buffer.active.viewportY = 120;
      terminal.resize.mockImplementation((cols: number, rows: number) => {
        terminal.cols = cols;
        terminal.rows = rows;
        terminal.buffer.active.viewportY = 60;
      });

      await waitFor(() => {
        expect(terminal.resize).toHaveBeenCalled();
      });

      expect(terminal.scrollToBottom).toHaveBeenCalledTimes(1);
      expect(terminal.buffer.active.viewportY).toBe(120);
    } finally {
      if (originalClientWidth !== undefined) {
        Object.defineProperty(
          HTMLElement.prototype,
          "clientWidth",
          originalClientWidth,
        );
      }

      if (originalClientHeight !== undefined) {
        Object.defineProperty(
          HTMLElement.prototype,
          "clientHeight",
          originalClientHeight,
        );
      }
    }
  });
});
