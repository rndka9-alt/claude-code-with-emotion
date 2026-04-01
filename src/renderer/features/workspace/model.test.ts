import {
  createInitialWorkspaceState,
  formatElapsedLabel,
  getVisibleTabs,
  resizePaneSizes,
  workspaceReducer,
} from './model';

describe('workspaceReducer', () => {
  it('creates a new active tab with updated assistant status', () => {
    const state = createInitialWorkspaceState(10_000);
    const nextState = workspaceReducer(state, {
      type: 'createTab',
      nowMs: 12_000,
    });

    expect(nextState.tabs).toHaveLength(3);
    expect(nextState.activeTabId).toBe('session-3');
    expect(nextState.assistantStatus.visualState).toBe('happy');
  });

  it('activates an existing tab and keeps unknown tabs ignored', () => {
    const state = createInitialWorkspaceState(20_000);
    const activatedState = workspaceReducer(state, {
      type: 'activateTab',
      tabId: 'session-2',
      nowMs: 21_000,
    });
    const unchangedState = workspaceReducer(state, {
      type: 'activateTab',
      tabId: 'missing-tab',
      nowMs: 21_000,
    });

    expect(activatedState.activeTabId).toBe('session-2');
    expect(unchangedState).toBe(state);
  });
});

describe('formatElapsedLabel', () => {
  it('formats seconds, minutes, and hours consistently', () => {
    expect(formatElapsedLabel(9_000)).toBe('9s');
    expect(formatElapsedLabel(125_000)).toBe('2m 5s');
    expect(formatElapsedLabel(4_200_000)).toBe('1h 10m');
  });
});

describe('getVisibleTabs', () => {
  it('returns only the active tab for the workspace content area', () => {
    const state = createInitialWorkspaceState(20_000);
    const nextState = workspaceReducer(state, {
      type: 'activateTab',
      tabId: 'session-2',
      nowMs: 21_000,
    });

    expect(getVisibleTabs(nextState)).toEqual([nextState.tabs[1]]);
  });
});

describe('resizePaneSizes', () => {
  it('resizes adjacent panes while preserving minimum size', () => {
    expect(resizePaneSizes([0.5, 0.5], 0, 0.12)).toEqual([0.62, 0.38]);
    expect(resizePaneSizes([0.5, 0.5], 0, 0.4)).toEqual([0.82, 0.18]);
  });
});
