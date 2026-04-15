import { fireEvent, render, screen } from "@testing-library/react";
import type { TerminalSession, WorkspaceLayoutNode } from "../model";
import { TerminalLayout } from "./TerminalLayout";

vi.mock("./TerminalSurface", () => {
  return {
    TerminalSurface: ({
      paneId,
      session,
    }: {
      paneId: string;
      session: TerminalSession;
    }) => {
      return <div data-testid={`terminal-surface-${paneId}`}>{session.title}</div>;
    },
  };
});

function createSession(id: string, title: string): TerminalSession {
  return {
    id,
    title,
    cwd: "/tmp",
    command: "",
    lifecycle: "ready",
    createdAtMs: Date.now(),
  };
}

function createSplitLayout(): WorkspaceLayoutNode {
  return {
    kind: "split",
    id: "split-1",
    direction: "horizontal",
    children: [
      {
        kind: "pane",
        id: "pane-1",
        sessionId: "session-1",
      },
      {
        kind: "pane",
        id: "pane-2",
        sessionId: "session-2",
      },
    ],
    sizes: [1, 1],
  };
}

describe("TerminalLayout", () => {
  const sessions = {
    "session-1": createSession("session-1", "Session 1"),
    "session-2": createSession("session-2", "Session 2"),
  };

  it("renders the focused pane title bar as an overlay in split layouts", () => {
    const { container } = render(
      <TerminalLayout
        focusedPaneId="pane-1"
        layout={createSplitLayout()}
        onClosePane={vi.fn()}
        onFocusPane={vi.fn()}
        onResizeSplit={vi.fn()}
        onSyncSessionTitle={vi.fn()}
        sessions={sessions}
        terminalFocusRequestKey={0}
      />,
    );

    expect(screen.getAllByTestId(/terminal-surface-/)).toHaveLength(2);
    expect(container.querySelectorAll('[data-pane-title-bar="true"]')).toHaveLength(
      1,
    );
  });

  it("does not reserve extra space for a single pane layout", () => {
    const { container } = render(
      <TerminalLayout
        focusedPaneId="pane-1"
        layout={{
          kind: "pane",
          id: "pane-1",
          sessionId: "session-1",
        }}
        onClosePane={vi.fn()}
        onFocusPane={vi.fn()}
        onResizeSplit={vi.fn()}
        onSyncSessionTitle={vi.fn()}
        sessions={sessions}
        terminalFocusRequestKey={0}
      />,
    );

    expect(screen.getAllByTestId(/terminal-surface-/)).toHaveLength(1);
    expect(container.querySelectorAll('[data-pane-title-bar="true"]')).toHaveLength(
      0,
    );
  });

  it("opens the search bar in a single pane layout with Cmd+F", () => {
    render(
      <TerminalLayout
        focusedPaneId="pane-1"
        layout={{
          kind: "pane",
          id: "pane-1",
          sessionId: "session-1",
        }}
        onClosePane={vi.fn()}
        onFocusPane={vi.fn()}
        onResizeSplit={vi.fn()}
        onSyncSessionTitle={vi.fn()}
        sessions={sessions}
        terminalFocusRequestKey={0}
      />,
    );

    fireEvent.keyDown(window, {
      key: "f",
      metaKey: true,
    });

    expect(
      screen.getByRole("textbox", { name: "Search terminal output" }),
    ).toBeInTheDocument();
  });
});
