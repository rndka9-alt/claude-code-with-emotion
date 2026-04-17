import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { App } from "./App";

const { MockSearchAddon, MockTerminal, terminalInstances } = vi.hoisted(() => {
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
        viewportY: number;
      };
    };
    clearSelection: ReturnType<typeof vi.fn>;
    cols: number;
    dispose: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
    loadAddon: ReturnType<typeof vi.fn>;
    onCursorMove: ReturnType<typeof vi.fn>;
    onData: ReturnType<typeof vi.fn>;
    onScroll: ReturnType<typeof vi.fn>;
    onTitleChange: ReturnType<typeof vi.fn>;
    open: ReturnType<typeof vi.fn>;
    options: { scrollback: number };
    registerLinkProvider: ReturnType<typeof vi.fn>;
    resize: ReturnType<typeof vi.fn>;
    rows: number;
    scrollToBottom: ReturnType<typeof vi.fn>;
    scrollLines: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
  }> = [];

  class HoistedMockSearchAddon {
    clearActiveDecoration = vi.fn();
    clearDecorations = vi.fn();
    findNext = vi.fn(() => true);
    findPrevious = vi.fn(() => true);
    onDidChangeResults = vi.fn(() => ({ dispose: vi.fn() }));
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
    options = { scrollback: 1000 };
    buffer = {
      active: {
        baseY: 0,
        cursorY: 0,
        getLine: vi.fn(() => ({
          isWrapped: false,
          translateToString: () => "",
        })),
        length: 1,
        viewportY: 0,
      },
    };
    clearSelection = vi.fn();
    focus = vi.fn();
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
    write = vi.fn();
    dispose = vi.fn();
    attachCustomKeyEventHandler = vi.fn();
    onCursorMove = vi.fn(() => ({ dispose: vi.fn() }));
    onData = vi.fn(() => ({ dispose: vi.fn() }));
    onScroll = vi.fn(() => ({ dispose: vi.fn() }));
    onTitleChange = vi.fn(() => ({ dispose: vi.fn() }));
    registerLinkProvider = vi.fn(() => ({ dispose: vi.fn() }));

    constructor() {
      hoistedTerminalInstances.push(this);
    }
  }

  return {
    MockSearchAddon: HoistedMockSearchAddon,
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

describe("App tab actions", () => {
  beforeEach(() => {
    terminalInstances.length = 0;

    Object.defineProperty(window, "claudeApp", {
      configurable: true,
      value: {
        workspaceCwd: "/tmp",
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
        workspaceCommands: {
          onOpenTerminalSearch: vi.fn(() => () => {}),
        },
      },
    });
  });

  it("creates a new session tab and switches focus to it", () => {
    render(<App />);

    fireEvent.keyDown(window, {
      key: "t",
      metaKey: true,
    });

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(
      screen.getByRole("tab", {
        name: "new session 2 · claude-code-with-emotion",
      }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("creates a new session tab when cmd+t is pressed", () => {
    render(<App />);

    fireEvent.keyDown(window, {
      key: "t",
      metaKey: true,
    });

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(
      screen.getByRole("tab", {
        name: "new session 2 · claude-code-with-emotion",
      }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("splits the active pane horizontally when cmd+d is pressed", () => {
    render(<App />);

    fireEvent.keyDown(window, {
      key: "d",
      metaKey: true,
    });

    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(
      screen.getByRole("separator", { name: "Resize horizontal split" }),
    ).toHaveAttribute("aria-orientation", "vertical");
    expect(
      screen.getByRole("button", {
        name: "Close pane new session 2 · claude-code-with-emotion",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Close pane new session 1 · claude-code-with-emotion",
      }),
    ).not.toBeInTheDocument();
  });

  it("splits the active pane vertically when cmd+shift+d is pressed", () => {
    render(<App />);

    fireEvent.keyDown(window, {
      key: "d",
      metaKey: true,
      shiftKey: true,
    });

    expect(
      screen.getByRole("separator", { name: "Resize vertical split" }),
    ).toHaveAttribute("aria-orientation", "horizontal");
  });

  it("moves focus between panes with cmd+option+arrow", () => {
    render(<App />);

    fireEvent.keyDown(window, {
      key: "d",
      metaKey: true,
    });
    fireEvent.keyDown(window, {
      key: "ArrowLeft",
      metaKey: true,
      altKey: true,
    });

    expect(
      screen.getByRole("button", {
        name: "Close pane new session 1 · claude-code-with-emotion",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Close pane new session 2 · claude-code-with-emotion",
      }),
    ).not.toBeInTheDocument();
  });

  it("moves focus to the previous tab when cmd+left is pressed", () => {
    render(<App />);

    fireEvent.keyDown(window, {
      key: "t",
      metaKey: true,
    });
    fireEvent.keyDown(window, {
      key: "ArrowLeft",
      metaKey: true,
    });

    expect(
      screen.getByRole("tab", {
        name: "new session 1 · claude-code-with-emotion",
      }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("closes a tab from the tab strip close button", () => {
    render(<App />);

    fireEvent.keyDown(window, {
      key: "t",
      metaKey: true,
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Close new session 1 · claude-code-with-emotion",
      }),
    );

    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(
      screen.getByRole("tab", {
        name: "new session 2 · claude-code-with-emotion",
      }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("restores the cached terminal title when a manual tab name is cleared", async () => {
    render(<App />);

    fireEvent.keyDown(window, {
      key: "t",
      metaKey: true,
    });
    fireEvent.click(
      screen.getByRole("tab", {
        name: "new session 1 · claude-code-with-emotion",
      }),
    );

    const terminal = terminalInstances[0];
    const titleChangeListener = terminal?.onTitleChange.mock.calls[0]?.[0] as
      | ((title: string) => void)
      | undefined;

    expect(titleChangeListener).toBeDefined();

    await act(async () => {
      titleChangeListener?.("user@host:~/project");
    });

    await waitFor(() => {
      expect(
        screen.getByRole("tab", { name: "user@host:~/project" }),
      ).toBeInTheDocument();
    });

    fireEvent.doubleClick(
      screen.getByRole("tab", { name: "user@host:~/project" }),
    );

    const firstEditor = await screen.findByRole("textbox", {
      name: "user@host:~/project title editor",
    });

    fireEvent.change(firstEditor, { target: { value: "my docs" } });
    fireEvent.keyDown(firstEditor, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "my docs" })).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByRole("tab", { name: "my docs" }));

    const secondEditor = await screen.findByRole("textbox", {
      name: "my docs title editor",
    });

    fireEvent.change(secondEditor, { target: { value: "" } });
    fireEvent.keyDown(secondEditor, { key: "Enter" });

    await waitFor(() => {
      expect(
        screen.getByRole("tab", { name: "user@host:~/project" }),
      ).toBeInTheDocument();
    });
  });
});
