import { fireEvent, render, waitFor } from "@testing-library/react";
import type { TerminalOutputEvent } from "../../../shared/terminal-bridge";
import { TerminalSurface } from "./TerminalSurface";
import { handleTerminalExternalBrowserClick } from "./terminal-session-registry";

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

describe("TerminalSurface", () => {
  let openExternal: ReturnType<typeof vi.fn>;

  beforeEach(() => {
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
        onTitleChange={vi.fn()}
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
        onTitleChange={vi.fn()}
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
        onTitleChange={vi.fn()}
        session={session}
      />,
    );

    const terminal = terminalInstances[0];
    const viewport = container.querySelector(".terminal-surface__viewport");

    expect(terminal).toBeDefined();
    expect(viewport).not.toBeNull();

    fireEvent.mouseDown(viewport!);

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
        onTitleChange={vi.fn()}
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
        onTitleChange={vi.fn()}
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
        onTitleChange={vi.fn()}
        session={session}
      />,
    );

    expect(terminalInstances).toHaveLength(1);
    expect(terminalInstances[0]?.open).toHaveBeenCalledTimes(1);
  });
});
