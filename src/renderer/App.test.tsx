import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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

describe("App focus restoration", () => {
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

  it("refocuses the terminal after the window regains focus", async () => {
    render(<App />);

    const terminal = terminalInstances[0];

    expect(terminal).toBeDefined();
    expect(terminal?.focus).toHaveBeenCalledTimes(1);

    const statusPanelToggle = screen.getByRole("button", {
      name: "Collapse assistant status panel",
    });

    statusPanelToggle.focus();
    expect(document.activeElement).toBe(statusPanelToggle);

    await act(async () => {
      fireEvent.focus(window);
      await new Promise((resolve) => {
        window.setTimeout(resolve, 0);
      });
    });

    expect(terminal?.focus).toHaveBeenCalledTimes(2);
  });

  it("shows the disconnected status copy before the assistant bridge responds", () => {
    render(<App />);

    expect(
      screen.getByText(/Claude 아직 미연결이에요\. 준비되면 바로 붙을게요/),
    ).toBeInTheDocument();
  });

  it("does not steal focus from text inputs when the window regains focus", async () => {
    render(<App />);

    const terminal = terminalInstances[0];
    const sessionTab = screen.getByRole("tab", {
      name: "new session 1 · claude-code-with-emotion",
    });

    fireEvent.doubleClick(sessionTab);

    const titleEditor = await screen.findByRole("textbox", {
      name: "new session 1 · claude-code-with-emotion title editor",
    });

    await waitFor(() => {
      expect(document.activeElement).toBe(titleEditor);
    });

    expect(terminal?.focus).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.focus(window);
      await new Promise((resolve) => {
        window.setTimeout(resolve, 0);
      });
    });

    expect(terminal?.focus).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(titleEditor);
  });
});
