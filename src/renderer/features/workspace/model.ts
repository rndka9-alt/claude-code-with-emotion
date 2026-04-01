import type { AssistantSemanticState } from '../../../shared/assistant-status';

export type SessionLifecycle = 'bootstrapping' | 'ready';

const IMMEDIATE_EXIT_RELAUNCH_WINDOW_MS = 5_000;

export interface SessionTab {
  id: string;
  title: string;
  cwd: string;
  command: string;
  lifecycle: SessionLifecycle;
  createdAtMs: number;
}

export interface AssistantStatus {
  visualState: AssistantSemanticState;
  line: string;
  currentTask: string;
  statusSinceMs: number;
}

export interface WorkspaceState {
  tabs: SessionTab[];
  paneSizes: number[];
  activeTabId: string;
  nextTabNumber: number;
  assistantStatus: AssistantStatus;
}

export type WorkspaceAction =
  | { type: 'activateTab'; tabId: string; nowMs: number }
  | { type: 'createTab'; nowMs: number }
  | { type: 'closeTab'; tabId: string; nowMs: number; reason: 'manual' | 'exit' }
  | {
      type: 'updateTabTitle';
      tabId: string;
      title: string;
      nowMs: number;
      source: 'manual' | 'terminal';
    }
  | { type: 'reorderTab'; tabId: string; destinationIndex: number; nowMs: number }
  | { type: 'resizePane'; index: number; deltaRatio: number };

const MIN_PANE_SIZE = 0.18;

function roundPaneSize(size: number): number {
  return Math.round(size * 10_000) / 10_000;
}

function createSessionTitle(tabNumber: number): string {
  return `new session ${tabNumber} · claude-code-with-emotion`;
}

function resolveDefaultSessionCwd(): string {
  const workspaceCwd = window.claudeApp?.workspaceCwd;

  if (typeof workspaceCwd === 'string' && workspaceCwd.length > 0) {
    return workspaceCwd;
  }

  return '/tmp';
}

function createSessionTab(tabNumber: number, nowMs: number): SessionTab {
  return {
    id: `session-${tabNumber}`,
    title: createSessionTitle(tabNumber),
    cwd: resolveDefaultSessionCwd(),
    command: '',
    lifecycle: 'bootstrapping',
    createdAtMs: nowMs,
  };
}

function createRecoverySessionTab(tabNumber: number, nowMs: number): SessionTab {
  return createSessionTab(tabNumber, nowMs);
}

function createAssistantStatus(
  visualState: AssistantSemanticState,
  line: string,
  currentTask: string,
  nowMs: number,
): AssistantStatus {
  return {
    visualState,
    line,
    currentTask,
    statusSinceMs: nowMs,
  };
}

function createBalancedPaneSizes(count: number): number[] {
  if (count <= 0) {
    return [];
  }

  const size = 1 / count;

  return Array.from({ length: count }, () => size);
}

function createClosedTabAssistantStatus(
  reason: 'manual' | 'exit',
  closedTabTitle: string,
  nowMs: number,
): AssistantStatus {
  if (reason === 'exit') {
    return createAssistantStatus(
      'waiting',
      '터미널이 종료돼서 탭도 같이 닫앗어요...!',
      `Closed "${closedTabTitle}" after the shell exited`,
      nowMs,
    );
  }

  return createAssistantStatus(
    'happy',
    '탭 하나 정리햇어요. 꽤 깔끔하죠...!',
    `Closed "${closedTabTitle}"`,
    nowMs,
  );
}

function closeTabState(
  state: WorkspaceState,
  tabId: string,
  nowMs: number,
  reason: 'manual' | 'exit',
): WorkspaceState {
  const tabIndex = state.tabs.findIndex((tab) => tab.id === tabId);

  if (tabIndex < 0) {
    return state;
  }

  const closedTab = state.tabs[tabIndex];

  if (closedTab === undefined) {
    return state;
  }

  const remainingTabs = state.tabs.filter((tab) => tab.id !== tabId);

  if (remainingTabs.length === 0) {
    const shouldPauseAutoLaunch =
      reason === 'exit' &&
      nowMs - closedTab.createdAtMs < IMMEDIATE_EXIT_RELAUNCH_WINDOW_MS;
    const replacementTab = shouldPauseAutoLaunch
      ? createRecoverySessionTab(state.nextTabNumber, nowMs)
      : createSessionTab(state.nextTabNumber, nowMs);
    const replacementLine = shouldPauseAutoLaunch
      ? '세션이 너무 빨리 종료돼서 Claude 자동 재실행은 멈춰뒀어요...!'
      : reason === 'exit'
        ? '마지막 세션이 종료돼서 새 탭을 바로 준비햇어요...!'
        : '마지막 탭을 닫아서 새 세션 하나 열어뒀어요...!';

    return {
      tabs: [replacementTab],
      paneSizes: [1],
      activeTabId: replacementTab.id,
      nextTabNumber: state.nextTabNumber + 1,
      assistantStatus: createAssistantStatus(
        shouldPauseAutoLaunch ? 'error' : 'waiting',
        replacementLine,
        shouldPauseAutoLaunch
          ? `Paused Claude auto-launch for "${replacementTab.title}"`
          : `Bootstrapping "${replacementTab.title}"`,
        nowMs,
      ),
    };
  }

  const nextActiveTabId =
    state.activeTabId !== tabId
      ? state.activeTabId
      : remainingTabs[Math.max(0, tabIndex - 1)]?.id ?? remainingTabs[0]?.id;

  if (typeof nextActiveTabId !== 'string') {
    return state;
  }

  return {
    ...state,
    tabs: remainingTabs,
    paneSizes: createBalancedPaneSizes(remainingTabs.length),
    activeTabId: nextActiveTabId,
    assistantStatus: createClosedTabAssistantStatus(
      reason,
      closedTab.title,
      nowMs,
    ),
  };
}

export function createInitialWorkspaceState(nowMs: number): WorkspaceState {
  const firstTab = createSessionTab(1, nowMs - 2_500);

  return {
    tabs: [firstTab],
    paneSizes: [1],
    activeTabId: firstTab.id,
    nextTabNumber: 2,
    assistantStatus: createAssistantStatus(
      'working',
      '새 세션 하나만 먼저 열어뒀어요...!',
      `Bootstrapping "${firstTab.title}"`,
      nowMs,
    ),
  };
}

export function getActiveTab(state: WorkspaceState): SessionTab | null {
  const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId);

  if (activeTab !== undefined) {
    return activeTab;
  }

  const firstTab = state.tabs[0];

  return firstTab !== undefined ? firstTab : null;
}

export function getVisibleTabs(state: WorkspaceState): SessionTab[] {
  const activeTab = getActiveTab(state);

  if (activeTab === null) {
    return [];
  }

  return [activeTab];
}

export function formatElapsedLabel(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes < 60) {
    return `${minutes}m ${seconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}h ${remainingMinutes}m`;
}

export function resizePaneSizes(
  paneSizes: number[],
  index: number,
  deltaRatio: number,
): number[] {
  const currentSize = paneSizes[index];
  const nextSize = paneSizes[index + 1];

  if (currentSize === undefined || nextSize === undefined) {
    return paneSizes;
  }

  const minDelta = -(currentSize - MIN_PANE_SIZE);
  const maxDelta = nextSize - MIN_PANE_SIZE;
  const boundedDelta = Math.min(Math.max(deltaRatio, minDelta), maxDelta);

  if (boundedDelta === 0) {
    return paneSizes;
  }

  return paneSizes.map((size, paneIndex) => {
    if (paneIndex === index) {
      return roundPaneSize(size + boundedDelta);
    }

    if (paneIndex === index + 1) {
      return roundPaneSize(size - boundedDelta);
    }

    return size;
  });
}

function activateTabState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'activateTab' }>,
): WorkspaceState {
  const nextActiveTab = state.tabs.find((tab) => tab.id === action.tabId);

  if (nextActiveTab === undefined) {
    return state;
  }

  return {
    ...state,
    activeTabId: nextActiveTab.id,
    assistantStatus: createAssistantStatus(
      'working',
      '세션 전환 완료. 흐름 안 놓쳣어요...!',
      `Reviewing "${nextActiveTab.title}"`,
      action.nowMs,
    ),
  };
}

function updateTabTitleState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'updateTabTitle' }>,
): WorkspaceState {
  const normalizedTitle = action.title.trim();

  if (normalizedTitle.length === 0) {
    return state;
  }

  const tabToRename = state.tabs.find((tab) => tab.id === action.tabId);

  if (tabToRename === undefined || tabToRename.title === normalizedTitle) {
    return state;
  }

  return {
    ...state,
    tabs: state.tabs.map((tab) =>
      tab.id === action.tabId ? { ...tab, title: normalizedTitle } : tab,
    ),
    assistantStatus: createAssistantStatus(
      action.source === 'manual' ? 'happy' : 'working',
      action.source === 'manual'
        ? '탭 이름 바꿧어요. 더 알아보기 쉬워요...!'
        : '터미널 타이틀을 탭 이름으로 동기화햇어요...!',
      `Renamed "${tabToRename.title}" to "${normalizedTitle}"`,
      action.nowMs,
    ),
  };
}

function reorderTabState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'reorderTab' }>,
): WorkspaceState {
  const fromIndex = state.tabs.findIndex((tab) => tab.id === action.tabId);

  if (fromIndex < 0) {
    return state;
  }

  const movedTab = state.tabs[fromIndex];

  if (movedTab === undefined) {
    return state;
  }

  const reorderedTabs = [...state.tabs];
  reorderedTabs.splice(fromIndex, 1);
  const boundedDestinationIndex = Math.min(
    Math.max(action.destinationIndex, 0),
    state.tabs.length,
  );
  const nextIndex =
    boundedDestinationIndex > fromIndex
      ? boundedDestinationIndex - 1
      : boundedDestinationIndex;

  if (nextIndex === fromIndex) {
    return state;
  }

  reorderedTabs.splice(nextIndex, 0, movedTab);

  return {
    ...state,
    tabs: reorderedTabs,
    assistantStatus: createAssistantStatus(
      'working',
      '탭 순서 바꿔놨어요. 동선이 좀 더 편해질 거예요...!',
      `Moved "${movedTab.title}"`,
      action.nowMs,
    ),
  };
}

function createTabState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: 'createTab' }>,
): WorkspaceState {
  const nextTab = createSessionTab(state.nextTabNumber, action.nowMs);
  const nextTabs = [...state.tabs, nextTab];

  return {
    tabs: nextTabs,
    paneSizes: createBalancedPaneSizes(nextTabs.length),
    activeTabId: nextTab.id,
    nextTabNumber: state.nextTabNumber + 1,
    assistantStatus: createAssistantStatus(
      'happy',
      '새 탭 하나 추가햇어요. 멀티세션 기분 좋다...!',
      `Bootstrapping "${nextTab.title}"`,
      action.nowMs,
    ),
  };
}

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState {
  if (action.type === 'activateTab') {
    return activateTabState(state, action);
  }

  if (action.type === 'resizePane') {
    return {
      ...state,
      paneSizes: resizePaneSizes(
        state.paneSizes,
        action.index,
        action.deltaRatio,
      ),
    };
  }

  if (action.type === 'closeTab') {
    return closeTabState(state, action.tabId, action.nowMs, action.reason);
  }

  if (action.type === 'updateTabTitle') {
    return updateTabTitleState(state, action);
  }

  if (action.type === 'reorderTab') {
    return reorderTabState(state, action);
  }

  return createTabState(state, action);
}
