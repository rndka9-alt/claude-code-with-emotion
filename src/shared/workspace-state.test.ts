import {
  createInitialWorkspaceStateArgument,
  parseInitialWorkspaceStateFromArguments,
  parseWorkspaceState,
  type WorkspaceState,
} from "./workspace-state";

const workspaceState: WorkspaceState = {
  tabs: [
    {
      id: "tab-test",
      title: "new session 1 · claude-code-with-emotion",
      focusedPaneId: "pane-test",
      focusedSessionId: "session-test",
      isManuallyRenamed: false,
      layout: {
        kind: "pane",
        id: "pane-test",
        sessionId: "session-test",
      },
      primarySessionId: "session-test",
      primarySessionTitle: "new session 1 · claude-code-with-emotion",
    },
  ],
  sessions: {
    "session-test": {
      id: "session-test",
      title: "new session 1 · claude-code-with-emotion",
      cwd: "/tmp",
      command: "",
      lifecycle: "bootstrapping",
      createdAtMs: 10_000,
    },
  },
  activeTabId: "tab-test",
  nextSessionNumber: 2,
  assistantStatus: {
    visualState: "completed",
    emotion: "happy",
    line: "ready",
    currentTask: "Testing workspace state",
    statusSinceMs: 12_000,
  },
};

describe("workspace state serialization", () => {
  it("round-trips an initial workspace state through a window argument", () => {
    const argument = createInitialWorkspaceStateArgument(workspaceState);

    expect(parseInitialWorkspaceStateFromArguments([argument])).toEqual(
      workspaceState,
    );
  });

  it("returns undefined when no initial workspace state argument exists", () => {
    expect(parseInitialWorkspaceStateFromArguments(["--other=value"])).toBe(
      undefined,
    );
  });

  it("rejects an invalid assistant semantic state", () => {
    expect(() => {
      parseWorkspaceState({
        ...workspaceState,
        assistantStatus: {
          ...workspaceState.assistantStatus,
          visualState: "confused",
        },
      });
    }).toThrow("Workspace state payload is invalid.");
  });
});
