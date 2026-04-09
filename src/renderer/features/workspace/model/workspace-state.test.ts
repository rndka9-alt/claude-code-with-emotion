import {
  createInitialWorkspaceState,
  formatElapsedLabel,
  getFocusedSession,
  getTabSessionIds,
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
    const firstSessionId = state.tabs[0]?.primarySessionId;

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

  it("starts with the shared disconnected assistant fallback", () => {
    const state = createInitialWorkspaceState(10_000);

    expect(state.assistantStatus.visualState).toBe("disconnected");
    expect(state.assistantStatus.line).toBe(
      "Claude 아직 미연결이에요. 준비되면 바로 붙을게요...!",
    );
    expect(state.assistantStatus.currentTask).toBe(
      "Waiting for Claude to start",
    );
  });

  it("creates a new active tab with updated assistant status", () => {
    const state = createInitialWorkspaceState(10_000);
    const nextState = workspaceReducer(state, {
      type: "createTab",
      nowMs: 12_000,
    });

    expect(nextState.tabs).toHaveLength(2);
    expect(nextState.activeTabId).toBe("tab-2");
    expect(getTabSessionIds(nextState.tabs[1]!)).toEqual(["session-2"]);
    expect(nextState.assistantStatus.visualState).toBe("completed");
    expect(nextState.assistantStatus.emotion).toBe("happy");
  });

  it("splits the focused pane horizontally and focuses the new pane", () => {
    const state = createInitialWorkspaceState(10_000);
    const nextState = workspaceReducer(state, {
      type: "splitPane",
      tabId: "tab-1",
      direction: "horizontal",
      nowMs: 12_000,
    });

    const tab = nextState.tabs[0];

    expect(tab?.layout.kind).toBe("split");
    expect(getTabSessionIds(tab!)).toEqual(["session-1", "session-2"]);
    expect(tab?.focusedSessionId).toBe("session-2");
    expect(tab?.layout.kind === "split" ? tab.layout.direction : null).toBe(
      "horizontal",
    );
    expect(tab?.layout.kind === "split" ? tab.layout.sizes : null).toEqual([
      0.5,
      0.5,
    ]);
  });

  it("splits the focused pane vertically when requested", () => {
    const state = createInitialWorkspaceState(10_000);
    const nextState = workspaceReducer(state, {
      type: "splitPane",
      tabId: "tab-1",
      direction: "vertical",
      nowMs: 12_000,
    });

    expect(
      nextState.tabs[0]?.layout.kind === "split"
        ? nextState.tabs[0].layout.direction
        : null,
    ).toBe("vertical");
  });

  it("focuses a different pane inside the active tab", () => {
    const splitState = workspaceReducer(createInitialWorkspaceState(20_000), {
      type: "splitPane",
      tabId: "tab-1",
      direction: "horizontal",
      nowMs: 20_500,
    });
    const rootLayout = splitState.tabs[0]?.layout;
    const firstPaneId =
      rootLayout?.kind === "split" && rootLayout.children[0].kind === "pane"
        ? rootLayout.children[0].id
        : null;

    expect(firstPaneId).toBeTruthy();

    const focusedState = workspaceReducer(splitState, {
      type: "focusPane",
      tabId: "tab-1",
      paneId: firstPaneId ?? "missing-pane",
    });

    expect(focusedState.tabs[0]?.focusedSessionId).toBe("session-1");
    expect(getFocusedSession(focusedState)?.id).toBe("session-1");
  });

  it("closes only the requested pane and collapses the split", () => {
    const splitState = workspaceReducer(createInitialWorkspaceState(20_000), {
      type: "splitPane",
      tabId: "tab-1",
      direction: "horizontal",
      nowMs: 20_500,
    });
    const focusedPaneId = splitState.tabs[0]?.focusedPaneId;

    const nextState = workspaceReducer(splitState, {
      type: "closePane",
      tabId: "tab-1",
      paneId: focusedPaneId ?? "missing-pane",
      nowMs: 21_000,
      reason: "manual",
    });

    expect(nextState.tabs).toHaveLength(1);
    expect(getTabSessionIds(nextState.tabs[0]!)).toEqual(["session-1"]);
    expect(nextState.tabs[0]?.layout.kind).toBe("pane");
    expect(nextState.tabs[0]?.focusedSessionId).toBe("session-1");
    expect(nextState.assistantStatus.currentTask).toBe(
      'Closed "new session 2 · claude-code-with-emotion"',
    );
  });

  it("closes a tab when its last remaining pane is removed", () => {
    const state = workspaceReducer(createInitialWorkspaceState(20_000), {
      type: "createTab",
      nowMs: 20_500,
    });
    const nextState = workspaceReducer(state, {
      type: "closePane",
      tabId: "tab-1",
      paneId: "pane-1",
      nowMs: 21_000,
      reason: "manual",
    });

    expect(nextState.tabs).toHaveLength(1);
    expect(nextState.activeTabId).toBe("tab-2");
    expect(nextState.assistantStatus.currentTask).toBe(
      'Closed "new session 1 · claude-code-with-emotion"',
    );
  });

  it("closes an entire split tab at once", () => {
    const splitState = workspaceReducer(createInitialWorkspaceState(20_000), {
      type: "splitPane",
      tabId: "tab-1",
      direction: "horizontal",
      nowMs: 20_500,
    });
    const withSecondTab = workspaceReducer(splitState, {
      type: "createTab",
      nowMs: 21_000,
    });

    const nextState = workspaceReducer(withSecondTab, {
      type: "closeTab",
      tabId: "tab-1",
      nowMs: 21_500,
    });

    expect(nextState.tabs).toHaveLength(1);
    expect(nextState.activeTabId).toBe("tab-2");
    expect(Object.keys(nextState.sessions)).toEqual(["session-3"]);
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
    expect(getTabSessionIds(nextState.tabs[0]!)).toEqual(["session-2"]);
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

    const replacementSessionId = nextState.tabs[0]?.primarySessionId;

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

  it("moves focus through adjacent panes using layout geometry", () => {
    let state = createInitialWorkspaceState(20_000);
    state = workspaceReducer(state, {
      type: "splitPane",
      tabId: "tab-1",
      direction: "horizontal",
      nowMs: 20_500,
    });
    state = workspaceReducer(state, {
      type: "moveFocus",
      tabId: "tab-1",
      direction: "left",
    });

    expect(state.tabs[0]?.focusedSessionId).toBe("session-1");
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
      type: "splitPane",
      tabId: "tab-1",
      direction: "horizontal",
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
    expect(afterTerminal.tabs[0]?.primarySessionTitle).toBe(
      "user@host:~/project",
    );
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
    expect(cleared.tabs[0]?.primarySessionTitle).toBe("user@host:~/project");
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
      type: "splitPane",
      tabId: "tab-1",
      direction: "horizontal",
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
