import {
  createInitialWorkspaceState,
  formatElapsedLabel,
  getFocusedSession,
  getTabSessionIds,
  getVisibleSessions,
  resizePaneSizes,
  workspaceReducer,
} from "./index";
import type { WorkspaceState, WorkspaceTab } from "./index";

function getTabAt(state: WorkspaceState, index: number): WorkspaceTab {
  const tab = state.tabs[index];

  if (tab === undefined) {
    throw new Error(`Expected workspace tab at index ${index}`);
  }

  return tab;
}

function expectWorkspaceId(id: string, prefix: string): void {
  expect(id).toMatch(
    new RegExp(
      `^${prefix}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`,
    ),
  );
}

describe("workspaceReducer", () => {
  it("uses the app workspace cwd for new sessions", () => {
    Object.defineProperty(window, "claudeApp", {
      configurable: true,
      value: {
        workspaceCwd: "/tmp/workspace-under-test",
      },
    });

    const state = createInitialWorkspaceState(10_000);
    const firstTab = getTabAt(state, 0);
    const firstSessionId = firstTab.primarySessionId;

    expectWorkspaceId(state.activeTabId, "tab");
    expectWorkspaceId(firstTab.focusedPaneId, "pane");
    expectWorkspaceId(firstSessionId, "session");
    expect(state.sessions[firstSessionId]?.cwd).toBe(
      "/tmp/workspace-under-test",
    );
    expect(state.sessions[firstSessionId]?.command).toBe("");
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
    const initialSessionId = getTabAt(state, 0).primarySessionId;
    const nextState = workspaceReducer(state, {
      type: "createTab",
      nowMs: 12_000,
    });
    const secondTab = getTabAt(nextState, 1);
    const secondTabSessionIds = getTabSessionIds(secondTab);

    expect(nextState.tabs).toHaveLength(2);
    expect(nextState.activeTabId).toBe(secondTab.id);
    expectWorkspaceId(secondTab.id, "tab");
    expectWorkspaceId(secondTab.primarySessionId, "session");
    expect(secondTab.primarySessionId).not.toBe(initialSessionId);
    expect(secondTabSessionIds).toEqual([secondTab.primarySessionId]);
    expect(nextState.assistantStatus.visualState).toBe("completed");
    expect(nextState.assistantStatus.emotion).toBe("happy");
  });

  it("splits the focused pane horizontally and focuses the new pane", () => {
    const state = createInitialWorkspaceState(10_000);
    const initialTab = getTabAt(state, 0);
    const nextState = workspaceReducer(state, {
      type: "splitPane",
      tabId: initialTab.id,
      direction: "horizontal",
      nowMs: 12_000,
    });

    const tab = getTabAt(nextState, 0);
    const sessionIds = getTabSessionIds(tab);

    expect(tab.layout.kind).toBe("split");
    expect(sessionIds).toEqual([
      initialTab.primarySessionId,
      tab.focusedSessionId,
    ]);
    expect(tab.focusedSessionId).not.toBe(initialTab.primarySessionId);
    expectWorkspaceId(tab.focusedPaneId, "pane");
    expectWorkspaceId(tab.focusedSessionId, "session");
    expect(tab.layout.kind === "split" ? tab.layout.direction : null).toBe(
      "horizontal",
    );
    expect(tab.layout.kind === "split" ? tab.layout.sizes : null).toEqual([
      0.5, 0.5,
    ]);
  });

  it("splits the focused pane vertically when requested", () => {
    const state = createInitialWorkspaceState(10_000);
    const nextState = workspaceReducer(state, {
      type: "splitPane",
      tabId: state.activeTabId,
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
    const initialState = createInitialWorkspaceState(20_000);
    const initialTab = getTabAt(initialState, 0);
    const splitState = workspaceReducer(initialState, {
      type: "splitPane",
      tabId: initialTab.id,
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
      tabId: initialTab.id,
      paneId: firstPaneId ?? "missing-pane",
    });

    expect(focusedState.tabs[0]?.focusedSessionId).toBe(
      initialTab.primarySessionId,
    );
    expect(getFocusedSession(focusedState)?.id).toBe(
      initialTab.primarySessionId,
    );
  });

  it("closes only the requested pane and collapses the split", () => {
    const initialState = createInitialWorkspaceState(20_000);
    const initialTab = getTabAt(initialState, 0);
    const splitState = workspaceReducer(initialState, {
      type: "splitPane",
      tabId: initialTab.id,
      direction: "horizontal",
      nowMs: 20_500,
    });
    const focusedPaneId = splitState.tabs[0]?.focusedPaneId;

    const nextState = workspaceReducer(splitState, {
      type: "closePane",
      tabId: initialTab.id,
      paneId: focusedPaneId ?? "missing-pane",
      nowMs: 21_000,
      reason: "manual",
    });

    expect(nextState.tabs).toHaveLength(1);
    expect(getTabSessionIds(getTabAt(nextState, 0))).toEqual([
      initialTab.primarySessionId,
    ]);
    expect(nextState.tabs[0]?.layout.kind).toBe("pane");
    expect(nextState.tabs[0]?.focusedSessionId).toBe(
      initialTab.primarySessionId,
    );
    expect(nextState.assistantStatus.currentTask).toBe(
      'Closed "new session 2 · claude-code-with-emotion"',
    );
  });

  it("closes a tab when its last remaining pane is removed", () => {
    const initialState = createInitialWorkspaceState(20_000);
    const initialTab = getTabAt(initialState, 0);
    const state = workspaceReducer(initialState, {
      type: "createTab",
      nowMs: 20_500,
    });
    const nextState = workspaceReducer(state, {
      type: "closePane",
      tabId: initialTab.id,
      paneId: initialTab.focusedPaneId,
      nowMs: 21_000,
      reason: "manual",
    });

    expect(nextState.tabs).toHaveLength(1);
    expect(nextState.activeTabId).toBe(getTabAt(state, 1).id);
    expect(nextState.assistantStatus.currentTask).toBe(
      'Closed "new session 1 · claude-code-with-emotion"',
    );
  });

  it("closes an entire split tab at once", () => {
    const initialState = createInitialWorkspaceState(20_000);
    const initialTab = getTabAt(initialState, 0);
    const splitState = workspaceReducer(initialState, {
      type: "splitPane",
      tabId: initialTab.id,
      direction: "horizontal",
      nowMs: 20_500,
    });
    const withSecondTab = workspaceReducer(splitState, {
      type: "createTab",
      nowMs: 21_000,
    });

    const nextState = workspaceReducer(withSecondTab, {
      type: "closeTab",
      tabId: initialTab.id,
      nowMs: 21_500,
    });
    const remainingTab = getTabAt(withSecondTab, 1);

    expect(nextState.tabs).toHaveLength(1);
    expect(nextState.activeTabId).toBe(remainingTab.id);
    expect(Object.keys(nextState.sessions)).toEqual([
      remainingTab.primarySessionId,
    ]);
  });

  it("creates a replacement session when the last session closes", () => {
    const state = createInitialWorkspaceState(20_000);
    const initialTab = getTabAt(state, 0);
    const nextState = workspaceReducer(state, {
      type: "closeSession",
      sessionId: initialTab.primarySessionId,
      nowMs: 26_000,
      reason: "exit",
    });
    const replacementTab = getTabAt(nextState, 0);

    expect(nextState.tabs).toHaveLength(1);
    expect(nextState.activeTabId).toBe(replacementTab.id);
    expect(replacementTab.id).not.toBe(initialTab.id);
    expect(replacementTab.primarySessionId).not.toBe(
      initialTab.primarySessionId,
    );
    expectWorkspaceId(replacementTab.id, "tab");
    expectWorkspaceId(replacementTab.primarySessionId, "session");
    expect(getTabSessionIds(replacementTab)).toEqual([
      replacementTab.primarySessionId,
    ]);
    expect(nextState.assistantStatus.line).toBe(
      "마지막 세션이 종료대서 새 탭을 바로 준비햇어요...!",
    );
  });

  it("pauses Claude auto-launch after an immediate last-session exit", () => {
    const state = createInitialWorkspaceState(20_000);
    const initialTab = getTabAt(state, 0);
    const nextState = workspaceReducer(state, {
      type: "closeSession",
      sessionId: initialTab.primarySessionId,
      nowMs: 21_000,
      reason: "exit",
    });

    const replacementTab = getTabAt(nextState, 0);
    const replacementSessionId = replacementTab.primarySessionId;

    expect(nextState.tabs).toHaveLength(1);
    expect(replacementTab.id).not.toBe(initialTab.id);
    expect(nextState.sessions[replacementSessionId]?.command).toBe("");
    expect(nextState.assistantStatus.visualState).toBe("error");
    expect(nextState.assistantStatus.line).toBe(
      "세션이 너무 빨리 종료대서 Claude 자동 재실행은 멈춰뒀어요...!",
    );
  });

  it("moves focus through adjacent panes using layout geometry", () => {
    let state = createInitialWorkspaceState(20_000);
    const initialTab = getTabAt(state, 0);
    state = workspaceReducer(state, {
      type: "splitPane",
      tabId: initialTab.id,
      direction: "horizontal",
      nowMs: 20_500,
    });
    state = workspaceReducer(state, {
      type: "moveFocus",
      tabId: initialTab.id,
      direction: "left",
    });

    expect(state.tabs[0]?.focusedSessionId).toBe(initialTab.primarySessionId);
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
    const firstTabId = getTabAt(state, 0).id;
    const secondTabId = getTabAt(state, 1).id;
    const thirdTabId = getTabAt(state, 2).id;
    const nextState = workspaceReducer(state, {
      type: "reorderTab",
      tabId: thirdTabId,
      destinationIndex: 0,
      nowMs: 21_500,
    });

    expect(nextState.tabs.map((tab) => tab.id)).toEqual([
      thirdTabId,
      firstTabId,
      secondTabId,
    ]);
    expect(nextState.activeTabId).toBe(thirdTabId);
    expect(nextState.assistantStatus.currentTask).toBe(
      'Moved "new session 3 · claude-code-with-emotion"',
    );
  });

  it("renames a tab manually with trimmed title", () => {
    const initialState = createInitialWorkspaceState(20_000);
    const state = workspaceReducer(initialState, {
      type: "renameTab",
      tabId: initialState.activeTabId,
      title: "  docs  ",
      nowMs: 21_000,
    });

    expect(state.tabs[0]?.title).toBe("docs");
    expect(state.assistantStatus.currentTask).toBe(
      'Renamed "new session 1 · claude-code-with-emotion" to "docs"',
    );
  });

  it("syncs a primary session title into the tab title", () => {
    const initialState = createInitialWorkspaceState(20_000);
    const initialTab = getTabAt(initialState, 0);
    const state = workspaceReducer(initialState, {
      type: "syncSessionTitle",
      sessionId: initialTab.primarySessionId,
      title: "claude-code-with-emotion · main workspace",
      nowMs: 21_000,
    });

    expect(state.tabs[0]?.title).toBe(
      "claude-code-with-emotion · main workspace",
    );
    expect(state.sessions[initialTab.primarySessionId]?.title).toBe(
      "claude-code-with-emotion · main workspace",
    );
    expect(state.assistantStatus.line).toBe(
      "터미널 타이틀을 탭 이름으로 동기화햇어요...!",
    );
  });

  it("does not let a non-primary session overwrite the tab title", () => {
    const initialState = createInitialWorkspaceState(20_000);
    const splitState = workspaceReducer(initialState, {
      type: "splitPane",
      tabId: initialState.activeTabId,
      direction: "horizontal",
      nowMs: 20_500,
    });
    const secondarySessionId = getTabAt(splitState, 0).focusedSessionId;
    const nextState = workspaceReducer(splitState, {
      type: "syncSessionTitle",
      sessionId: secondarySessionId,
      title: "secondary pane",
      nowMs: 21_000,
    });

    expect(nextState.tabs[0]?.title).toBe(
      "new session 1 · claude-code-with-emotion",
    );
    expect(nextState.sessions[secondarySessionId]?.title).toBe(
      "secondary pane",
    );
  });

  it("preserves a manually renamed title from primary session overwrites", () => {
    const initial = createInitialWorkspaceState(20_000);
    const initialTab = getTabAt(initial, 0);
    const renamed = workspaceReducer(initial, {
      type: "renameTab",
      tabId: initialTab.id,
      title: "my docs",
      nowMs: 21_000,
    });

    expect(renamed.tabs[0]?.title).toBe("my docs");
    expect(renamed.tabs[0]?.isManuallyRenamed).toBe(true);

    const afterTerminal = workspaceReducer(renamed, {
      type: "syncSessionTitle",
      sessionId: initialTab.primarySessionId,
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
    const initialTab = getTabAt(initial, 0);

    const withTerminal = workspaceReducer(initial, {
      type: "syncSessionTitle",
      sessionId: initialTab.primarySessionId,
      title: "user@host:~/project",
      nowMs: 20_500,
    });
    const renamed = workspaceReducer(withTerminal, {
      type: "renameTab",
      tabId: initialTab.id,
      title: "my docs",
      nowMs: 21_000,
    });

    const cleared = workspaceReducer(renamed, {
      type: "renameTab",
      tabId: initialTab.id,
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
    const initialState = createInitialWorkspaceState(20_000);
    const initialTab = getTabAt(initialState, 0);
    const splitState = workspaceReducer(initialState, {
      type: "splitPane",
      tabId: initialTab.id,
      direction: "horizontal",
      nowMs: 20_500,
    });
    const tab = getTabAt(splitState, 0);

    expect(getVisibleSessions(splitState).map((session) => session.id)).toEqual(
      getTabSessionIds(tab),
    );
  });
});

describe("resizePaneSizes", () => {
  it("resizes adjacent panes while preserving minimum size", () => {
    expect(resizePaneSizes([0.5, 0.5], 0, 0.12)).toEqual([0.62, 0.38]);
    expect(resizePaneSizes([0.5, 0.5], 0, 0.4)).toEqual([0.82, 0.18]);
  });
});
