import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "./App";

const { MockTerminal, terminalInstances } = vi.hoisted(() => {
  const hoistedTerminalInstances: Array<{
    attachCustomKeyEventHandler: ReturnType<typeof vi.fn>;
    cols: number;
    dispose: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
    onData: ReturnType<typeof vi.fn>;
    onTitleChange: ReturnType<typeof vi.fn>;
    open: ReturnType<typeof vi.fn>;
    options: { scrollback: number };
    registerLinkProvider: ReturnType<typeof vi.fn>;
    resize: ReturnType<typeof vi.fn>;
    rows: number;
    write: ReturnType<typeof vi.fn>;
  }> = [];

  class HoistedMockTerminal {
    cols = 80;
    rows = 24;
    options = { scrollback: 1000 };
    focus = vi.fn();
    open = vi.fn();
    resize = vi.fn((cols: number, rows: number) => {
      this.cols = cols;
      this.rows = rows;
    });
    write = vi.fn();
    dispose = vi.fn();
    attachCustomKeyEventHandler = vi.fn();
    onData = vi.fn(() => ({ dispose: vi.fn() }));
    onTitleChange = vi.fn(() => ({ dispose: vi.fn() }));
    registerLinkProvider = vi.fn(() => ({ dispose: vi.fn() }));

    constructor() {
      hoistedTerminalInstances.push(this);
    }
  }

  return {
    MockTerminal: HoistedMockTerminal,
    terminalInstances: hoistedTerminalInstances,
  };
});

vi.mock("@xterm/xterm", () => {
  return {
    Terminal: MockTerminal,
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
      },
    });
  });

  it("creates a new session tab and switches focus to it", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "New Session" }));

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(
      screen.getByRole("tab", {
        name: "new session 2 · claude-code-with-emotion",
      }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("tab", {
        name: "new session 2 · claude-code-with-emotion",
      }),
    ).toHaveAttribute("title", "new session 2 · claude-code-with-emotion");
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

  it("does not create a new session tab when ctrl+t is pressed", () => {
    render(<App />);

    fireEvent.keyDown(window, {
      ctrlKey: true,
      key: "t",
    });

    expect(screen.getAllByRole("tab")).toHaveLength(1);
  });

  it("does not create a new session tab when cmd+shift+t is pressed", () => {
    render(<App />);

    fireEvent.keyDown(window, {
      key: "t",
      metaKey: true,
      shiftKey: true,
    });

    expect(screen.getAllByRole("tab")).toHaveLength(1);
  });

  it("moves focus to the previous tab when cmd+left is pressed", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "New Session" }));
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

  it("does not move focus when ctrl+right is pressed", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "New Session" }));
    fireEvent.keyDown(window, {
      ctrlKey: true,
      key: "ArrowRight",
    });

    expect(
      screen.getByRole("tab", {
        name: "new session 2 · claude-code-with-emotion",
      }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("closes a tab from the tab strip close button", () => {
    render(<App />);

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
