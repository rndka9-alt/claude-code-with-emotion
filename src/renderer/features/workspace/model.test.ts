import {
  createInitialWorkspaceState,
  formatElapsedLabel,
  getVisibleTabs,
  resizePaneSizes,
  workspaceReducer,
} from "./model";

describe("workspaceReducer", () => {
  it("uses the app workspace cwd for new sessions", () => {
    Object.defineProperty(window, "claudeApp", {
      configurable: true,
      value: {
        workspaceCwd: "/tmp/workspace-under-test",
      },
    });

    const state = createInitialWorkspaceState(10_000);

    expect(state.tabs[0]?.cwd).toBe("/tmp/workspace-under-test");
    expect(state.tabs[0]?.command).toBe("");
  });

  it("creates a new active tab with updated assistant status", () => {
    const state = createInitialWorkspaceState(10_000);
    const nextState = workspaceReducer(state, {
      type: "createTab",
      nowMs: 12_000,
    });

    expect(nextState.tabs).toHaveLength(2);
    expect(nextState.activeTabId).toBe("session-2");
    expect(nextState.assistantStatus.visualState).toBe("completed");
    expect(nextState.assistantStatus.emotion).toBe("happy");
  });

  it("activates an existing tab and keeps unknown tabs ignored", () => {
    const state = workspaceReducer(createInitialWorkspaceState(20_000), {
      type: "createTab",
      nowMs: 20_500,
    });
    const activatedState = workspaceReducer(state, {
      type: "activateTab",
      tabId: "session-1",
      nowMs: 21_000,
    });
    const unchangedState = workspaceReducer(state, {
      type: "activateTab",
      tabId: "missing-tab",
      nowMs: 21_000,
    });

    expect(activatedState.activeTabId).toBe("session-1");
    expect(unchangedState).toBe(state);
  });

  it("closes a tab and keeps the neighboring tab active", () => {
    const state = workspaceReducer(createInitialWorkspaceState(20_000), {
      type: "createTab",
      nowMs: 20_500,
    });
    const nextState = workspaceReducer(state, {
      type: "closeTab",
      tabId: "session-1",
      nowMs: 21_000,
      reason: "manual",
    });

    expect(nextState.tabs).toHaveLength(1);
    expect(nextState.activeTabId).toBe("session-2");
    expect(nextState.assistantStatus.currentTask).toBe(
      'Closed "new session 1 · claude-code-with-emotion"',
    );
  });

  it("creates a replacement session when the last tab closes", () => {
    const state = createInitialWorkspaceState(20_000);
    const nextState = workspaceReducer(state, {
      type: "closeTab",
      tabId: "session-1",
      nowMs: 26_000,
      reason: "exit",
    });

    expect(nextState.tabs).toHaveLength(1);
    expect(nextState.activeTabId).toBe("session-2");
    expect(nextState.assistantStatus.line).toBe(
      "마지막 세션이 종료돼서 새 탭을 바로 준비햇어요...!",
    );
  });

  it("pauses Claude auto-launch after an immediate last-session exit", () => {
    const state = createInitialWorkspaceState(20_000);
    const nextState = workspaceReducer(state, {
      type: "closeTab",
      tabId: "session-1",
      nowMs: 21_000,
      reason: "exit",
    });

    expect(nextState.tabs).toHaveLength(1);
    expect(nextState.tabs[0]?.id).toBe("session-2");
    expect(nextState.tabs[0]?.command).toBe("");
    expect(nextState.assistantStatus.visualState).toBe("error");
    expect(nextState.assistantStatus.line).toBe(
      "세션이 너무 빨리 종료돼서 Claude 자동 재실행은 멈춰뒀어요...!",
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
      tabId: "session-3",
      destinationIndex: 0,
      nowMs: 21_500,
    });

    expect(nextState.tabs.map((tab) => tab.id)).toEqual([
      "session-3",
      "session-1",
      "session-2",
    ]);
    expect(nextState.activeTabId).toBe("session-3");
    expect(nextState.assistantStatus.currentTask).toBe(
      'Moved "new session 3 · claude-code-with-emotion"',
    );
  });

  it("renames a tab manually with trimmed title", () => {
    const state = workspaceReducer(createInitialWorkspaceState(20_000), {
      type: "updateTabTitle",
      tabId: "session-1",
      title: "  docs  ",
      nowMs: 21_000,
      source: "manual",
    });

    expect(state.tabs[0]?.title).toBe("docs");
    expect(state.assistantStatus.currentTask).toBe(
      'Renamed "new session 1 · claude-code-with-emotion" to "docs"',
    );
  });

  it("syncs a terminal title into the tab title", () => {
    const state = workspaceReducer(createInitialWorkspaceState(20_000), {
      type: "updateTabTitle",
      tabId: "session-1",
      title: "claude-code-with-emotion · main workspace",
      nowMs: 21_000,
      source: "terminal",
    });

    expect(state.tabs[0]?.title).toBe(
      "claude-code-with-emotion · main workspace",
    );
    expect(state.assistantStatus.line).toBe(
      "터미널 타이틀을 탭 이름으로 동기화햇어요...!",
    );
  });

  it("preserves a manually renamed title from terminal overwrites", () => {
    const initial = createInitialWorkspaceState(20_000);
    const renamed = workspaceReducer(initial, {
      type: "updateTabTitle",
      tabId: "session-1",
      title: "my docs",
      nowMs: 21_000,
      source: "manual",
    });

    expect(renamed.tabs[0]?.title).toBe("my docs");
    expect(renamed.tabs[0]?.isManuallyRenamed).toBe(true);

    const afterTerminal = workspaceReducer(renamed, {
      type: "updateTabTitle",
      tabId: "session-1",
      title: "user@host:~/project",
      nowMs: 22_000,
      source: "terminal",
    });

    expect(afterTerminal.tabs[0]?.title).toBe("my docs");
    expect(afterTerminal.tabs[0]?.terminalTitle).toBe("user@host:~/project");
  });

  it("caches terminal title even when manually renamed", () => {
    const initial = createInitialWorkspaceState(20_000);

    const withTerminal = workspaceReducer(initial, {
      type: "updateTabTitle",
      tabId: "session-1",
      title: "user@host:~/project",
      nowMs: 20_500,
      source: "terminal",
    });

    expect(withTerminal.tabs[0]?.terminalTitle).toBe("user@host:~/project");

    const renamed = workspaceReducer(withTerminal, {
      type: "updateTabTitle",
      tabId: "session-1",
      title: "my docs",
      nowMs: 21_000,
      source: "manual",
    });

    // 수동 이름으로 바꿔도 terminalTitle 캐시는 유지
    expect(renamed.tabs[0]?.terminalTitle).toBe("user@host:~/project");

    const afterSecondOsc = workspaceReducer(renamed, {
      type: "updateTabTitle",
      tabId: "session-1",
      title: "user@host:~/other",
      nowMs: 22_000,
      source: "terminal",
    });

    // 수동 잠금 중에도 terminalTitle 캐시는 최신으로 갱신
    expect(afterSecondOsc.tabs[0]?.title).toBe("my docs");
    expect(afterSecondOsc.tabs[0]?.terminalTitle).toBe("user@host:~/other");
  });

  it("restores terminal title when manual title is cleared", () => {
    const initial = createInitialWorkspaceState(20_000);

    const withTerminal = workspaceReducer(initial, {
      type: "updateTabTitle",
      tabId: "session-1",
      title: "user@host:~/project",
      nowMs: 20_500,
      source: "terminal",
    });
    const renamed = workspaceReducer(withTerminal, {
      type: "updateTabTitle",
      tabId: "session-1",
      title: "my docs",
      nowMs: 21_000,
      source: "manual",
    });

    // 타이틀을 비우면 캐싱된 터미널 타이틀로 복원 + 잠금 해제
    const cleared = workspaceReducer(renamed, {
      type: "updateTabTitle",
      tabId: "session-1",
      title: "   ",
      nowMs: 22_000,
      source: "manual",
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

describe("getVisibleTabs", () => {
  it("returns only the active tab for the workspace content area", () => {
    const state = createInitialWorkspaceState(20_000);

    expect(getVisibleTabs(state)).toEqual([state.tabs[0]]);
  });
});

describe("resizePaneSizes", () => {
  it("resizes adjacent panes while preserving minimum size", () => {
    expect(resizePaneSizes([0.5, 0.5], 0, 0.12)).toEqual([0.62, 0.38]);
    expect(resizePaneSizes([0.5, 0.5], 0, 0.4)).toEqual([0.82, 0.18]);
  });
});
