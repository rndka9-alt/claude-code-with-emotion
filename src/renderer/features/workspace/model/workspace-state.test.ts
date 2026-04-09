import {
  createInitialWorkspaceState,
  formatElapsedLabel,
  getFocusedSession,
  getVisibleSessions,
  resizePaneSizes,
  workspaceReducer,
} from "./index";

describe("workspaceReducer", () => {
  it("uses the app workspace cwd for new sessions", () => {
    Object.defineProperty(window, "claudeApp", {
      configurable: true,
      value: {
        workspaceCwd: "/tmp/workspace-under-test",
      },
    });

    const state = createInitialWorkspaceState(10_000);
    const firstSessionId = state.tabs[0]?.sessionIds[0];

    expect(firstSessionId).toBe("session-1");
    expect(
      firstSessionId !== undefined ? state.sessions[firstSessionId]?.cwd : null,
    ).toBe("/tmp/workspace-under-test");
    expect(
      firstSessionId !== undefined
        ? state.sessions[firstSessionId]?.command
        : null,
    ).toBe("");
  });

  it("creates a new active tab with updated assistant status", () => {
    const state = createInitialWorkspaceState(10_000);
    const nextState = workspaceReducer(state, {
      type: "createTab",
      nowMs: 12_000,
    });

    expect(nextState.tabs).toHaveLength(2);
    expect(nextState.activeTabId).toBe("tab-2");
    expect(nextState.tabs[1]?.sessionIds).toEqual(["session-2"]);
    expect(nextState.assistantStatus.visualState).toBe("completed");
    expect(nextState.assistantStatus.emotion).toBe("happy");
  });

  it("creates an additional focused session inside an existing tab", () => {
    const state = createInitialWorkspaceState(10_000);
    const nextState = workspaceReducer(state, {
      type: "createSessionInTab",
      tabId: "tab-1",
      nowMs: 12_000,
    });

    expect(nextState.tabs).toHaveLength(1);
    expect(nextState.tabs[0]?.sessionIds).toEqual(["session-1", "session-2"]);
    expect(nextState.tabs[0]?.focusedSessionId).toBe("session-2");
    expect(nextState.tabs[0]?.paneSizes).toEqual([0.5, 0.5]);
    expect(nextState.sessions["session-2"]?.title).toBe(
      "new session 2 · claude-code-with-emotion",
    );
  });

  it("activates an existing tab and keeps unknown tabs ignored", () => {
    const state = workspaceReducer(createInitialWorkspaceState(20_000), {
      type: "createTab",
      nowMs: 20_500,
    });
    const activatedState = workspaceReducer(state, {
      type: "activateTab",
      tabId: "tab-1",
      nowMs: 21_000,
    });
    const unchangedState = workspaceReducer(state, {
      type: "activateTab",
      tabId: "missing-tab",
      nowMs: 21_000,
    });

    expect(activatedState.activeTabId).toBe("tab-1");
    expect(unchangedState).toBe(state);
  });

  it("remembers the last focused session inside a tab", () => {
    const splitState = workspaceReducer(createInitialWorkspaceState(20_000), {
      type: "createSessionInTab",
      tabId: "tab-1",
      nowMs: 20_500,
    });

    const focusedState = workspaceReducer(splitState, {
      type: "focusSession",
      tabId: "tab-1",
      sessionId: "session-1",
    });

    expect(focusedState.tabs[0]?.focusedSessionId).toBe("session-1");
    expect(getFocusedSession(focusedState)?.id).toBe("session-1");
  });

  it("closes only the focused session inside a split tab", () => {
    const splitState = workspaceReducer(createInitialWorkspaceState(20_000), {
      type: "createSessionInTab",
      tabId: "tab-1",
      nowMs: 20_500,
    });
    const nextState = workspaceReducer(splitState, {
      type: "closeFocusedSession",
      tabId: "tab-1",
      nowMs: 21_000,
      reason: "manual",
    });

    expect(nextState.tabs).toHaveLength(1);
    expect(nextState.tabs[0]?.sessionIds).toEqual(["session-1"]);
    expect(nextState.tabs[0]?.focusedSessionId).toBe("session-1");
    expect(nextState.tabs[0]?.paneSizes).toEqual([1]);
    expect(nextState.assistantStatus.currentTask).toBe(
      'Closed "new session 2 · claude-code-with-emotion"',
    );
  });

  it("closes a tab when its last remaining session is removed", () => {
    const state = workspaceReducer(createInitialWorkspaceState(20_000), {
      type: "createTab",
      nowMs: 20_500,
    });
    const nextState = workspaceReducer(state, {
      type: "closeFocusedSession",
      tabId: "tab-1",
      nowMs: 21_000,
      reason: "manual",
    });

    expect(nextState.tabs).toHaveLength(1);
    expect(nextState.activeTabId).toBe("tab-2");
    expect(nextState.assistantStatus.currentTask).toBe(
      'Closed "new session 1 · claude-code-with-emotion"',
    );
  });

  it("creates a replacement session when the last session closes", () => {
    const state = createInitialWorkspaceState(20_000);
    const nextState = workspaceReducer(state, {
      type: "closeSession",
      sessionId: "session-1",
      nowMs: 26_000,
      reason: "exit",
    });

    expect(nextState.tabs).toHaveLength(1);
    expect(nextState.activeTabId).toBe("tab-2");
    expect(nextState.tabs[0]?.sessionIds).toEqual(["session-2"]);
    expect(nextState.assistantStatus.line).toBe(
      "마지막 세션이 종료대서 새 탭을 바로 준비햇어요...!",
    );
  });

  it("pauses Claude auto-launch after an immediate last-session exit", () => {
    const state = createInitialWorkspaceState(20_000);
    const nextState = workspaceReducer(state, {
      type: "closeSession",
      sessionId: "session-1",
      nowMs: 21_000,
      reason: "exit",
    });

    const replacementSessionId = nextState.tabs[0]?.sessionIds[0];

    expect(nextState.tabs).toHaveLength(1);
    expect(nextState.tabs[0]?.id).toBe("tab-2");
    expect(
      replacementSessionId !== undefined
        ? nextState.sessions[replacementSessionId]?.command
        : null,
    ).toBe("");
    expect(nextState.assistantStatus.visualState).toBe("error");
    expect(nextState.assistantStatus.line).toBe(
      "세션이 너무 빨리 종료대서 Claude 자동 재실행은 멈춰뒀어요...!",
    );
  });

  it("reorders tabs when a tab is dragged over another tab", () => {
    const withSecondTab = workspaceReducer(
      createInitialWorkspaceState(20_000),
      {
        type: "createTab",
        nowMs: 21_000,
      },
    );
    const state = workspaceReducer(withSecondTab, {
      type: "createTab",
      nowMs: 21_250,
    });
    const nextState = workspaceReducer(state, {
      type: "reorderTab",
      tabId: "tab-3",
      destinationIndex: 0,
      nowMs: 21_500,
    });

    expect(nextState.tabs.map((tab) => tab.id)).toEqual([
      "tab-3",
      "tab-1",
      "tab-2",
    ]);
    expect(nextState.activeTabId).toBe("tab-3");
    expect(nextState.assistantStatus.currentTask).toBe(
      'Moved "new session 3 · claude-code-with-emotion"',
    );
  });

  it("renames a tab manually with trimmed title", () => {
    const state = workspaceReducer(createInitialWorkspaceState(20_000), {
      type: "renameTab",
      tabId: "tab-1",
      title: "  docs  ",
      nowMs: 21_000,
    });

    expect(state.tabs[0]?.title).toBe("docs");
    expect(state.assistantStatus.currentTask).toBe(
      'Renamed "new session 1 · claude-code-with-emotion" to "docs"',
    );
  });

  it("syncs a primary session title into the tab title", () => {
    const state = workspaceReducer(createInitialWorkspaceState(20_000), {
      type: "syncSessionTitle",
      sessionId: "session-1",
      title: "claude-code-with-emotion · main workspace",
      nowMs: 21_000,
    });

    expect(state.tabs[0]?.title).toBe(
      "claude-code-with-emotion · main workspace",
    );
    expect(state.sessions["session-1"]?.title).toBe(
      "claude-code-with-emotion · main workspace",
    );
    expect(state.assistantStatus.line).toBe(
      "터미널 타이틀을 탭 이름으로 동기화햇어요...!",
    );
  });

  it("does not let a non-primary session overwrite the tab title", () => {
    const splitState = workspaceReducer(createInitialWorkspaceState(20_000), {
      type: "createSessionInTab",
      tabId: "tab-1",
      nowMs: 20_500,
    });
    const nextState = workspaceReducer(splitState, {
      type: "syncSessionTitle",
      sessionId: "session-2",
      title: "secondary pane",
      nowMs: 21_000,
    });

    expect(nextState.tabs[0]?.title).toBe(
      "new session 1 · claude-code-with-emotion",
    );
    expect(nextState.sessions["session-2"]?.title).toBe("secondary pane");
  });

  it("preserves a manually renamed title from primary session overwrites", () => {
    const initial = createInitialWorkspaceState(20_000);
    const renamed = workspaceReducer(initial, {
      type: "renameTab",
      tabId: "tab-1",
      title: "my docs",
      nowMs: 21_000,
    });

    expect(renamed.tabs[0]?.title).toBe("my docs");
    expect(renamed.tabs[0]?.isManuallyRenamed).toBe(true);

    const afterTerminal = workspaceReducer(renamed, {
      type: "syncSessionTitle",
      sessionId: "session-1",
      title: "user@host:~/project",
      nowMs: 22_000,
    });

    expect(afterTerminal.tabs[0]?.title).toBe("my docs");
    expect(afterTerminal.tabs[0]?.terminalTitle).toBe("user@host:~/project");
  });

  it("caches the primary session title even when the tab is manually renamed", () => {
    const initial = createInitialWorkspaceState(20_000);

    const withTerminal = workspaceReducer(initial, {
      type: "syncSessionTitle",
      sessionId: "session-1",
      title: "user@host:~/project",
      nowMs: 20_500,
    });

    expect(withTerminal.tabs[0]?.terminalTitle).toBe("user@host:~/project");

    const renamed = workspaceReducer(withTerminal, {
      type: "renameTab",
      tabId: "tab-1",
      title: "my docs",
      nowMs: 21_000,
    });

    expect(renamed.tabs[0]?.terminalTitle).toBe("user@host:~/project");

    const afterSecondOsc = workspaceReducer(renamed, {
      type: "syncSessionTitle",
      sessionId: "session-1",
      title: "user@host:~/other",
      nowMs: 22_000,
    });

    expect(afterSecondOsc.tabs[0]?.title).toBe("my docs");
    expect(afterSecondOsc.tabs[0]?.terminalTitle).toBe("user@host:~/other");
  });

  it("restores the cached terminal title when a manual tab title is cleared", () => {
    const initial = createInitialWorkspaceState(20_000);

    const withTerminal = workspaceReducer(initial, {
      type: "syncSessionTitle",
      sessionId: "session-1",
      title: "user@host:~/project",
      nowMs: 20_500,
    });
    const renamed = workspaceReducer(withTerminal, {
      type: "renameTab",
      tabId: "tab-1",
      title: "my docs",
      nowMs: 21_000,
    });

    const cleared = workspaceReducer(renamed, {
      type: "renameTab",
      tabId: "tab-1",
      title: "   ",
      nowMs: 22_000,
    });

    expect(cleared.tabs[0]?.title).toBe("user@host:~/project");
    expect(cleared.tabs[0]?.isManuallyRenamed).toBe(false);
    expect(cleared.tabs[0]?.terminalTitle).toBe("user@host:~/project");
  });
});

describe("formatElapsedLabel", () => {
  it("formats seconds, minutes, and hours consistently", () => {
    expect(formatElapsedLabel(9_000)).toBe("9s");
    expect(formatElapsedLabel(125_000)).toBe("2m 5s");
    expect(formatElapsedLabel(4_200_000)).toBe("1h 10m");
  });
});

describe("getVisibleSessions", () => {
  it("returns the active tab sessions for the workspace content area", () => {
    const splitState = workspaceReducer(createInitialWorkspaceState(20_000), {
      type: "createSessionInTab",
      tabId: "tab-1",
      nowMs: 20_500,
    });

    expect(getVisibleSessions(splitState).map((session) => session.id)).toEqual([
      "session-1",
      "session-2",
    ]);
  });
});

describe("resizePaneSizes", () => {
  it("resizes adjacent panes while preserving minimum size", () => {
    expect(resizePaneSizes([0.5, 0.5], 0, 0.12)).toEqual([0.62, 0.38]);
    expect(resizePaneSizes([0.5, 0.5], 0, 0.4)).toEqual([0.82, 0.18]);
  });
});
