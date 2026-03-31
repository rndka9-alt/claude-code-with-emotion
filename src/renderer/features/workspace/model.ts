export type AssistantVisualState =
  | 'idle'
  | 'thinking'
  | 'working'
  | 'responding'
  | 'waiting'
  | 'surprised'
  | 'sad'
  | 'happy'
  | 'error';

export type SessionLifecycle = 'bootstrapping' | 'ready';

export interface SessionTab {
  id: string;
  title: string;
  cwd: string;
  command: string;
  lifecycle: SessionLifecycle;
  createdAtMs: number;
}

export interface AssistantStatus {
  visualState: AssistantVisualState;
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
  | { type: 'resizePane'; index: number; deltaRatio: number };

const MIN_PANE_SIZE = 0.18;

function roundPaneSize(size: number): number {
  return Math.round(size * 10_000) / 10_000;
}

function createSessionTitle(tabNumber: number): string {
  if (tabNumber === 1) {
    return 'claude-code-with-emotion · main workspace';
  }

  if (tabNumber === 2) {
    return 'terminal-resize prototype · claude-code-with-emotion';
  }

  return `new session ${tabNumber} · claude-code-with-emotion`;
}

function createSessionTab(tabNumber: number, nowMs: number): SessionTab {
  return {
    id: `session-${tabNumber}`,
    title: createSessionTitle(tabNumber),
    cwd: '/Users/igangmin/workspace/github/personal/claude-code-with-emotion',
    command: 'claude',
    lifecycle: tabNumber === 1 ? 'ready' : 'bootstrapping',
    createdAtMs: nowMs,
  };
}

function createAssistantStatus(
  visualState: AssistantVisualState,
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

export function createInitialWorkspaceState(nowMs: number): WorkspaceState {
  const firstTab = createSessionTab(1, nowMs - 8_000);
  const secondTab = createSessionTab(2, nowMs - 2_500);

  return {
    tabs: [firstTab, secondTab],
    paneSizes: [0.56, 0.44],
    activeTabId: firstTab.id,
    nextTabNumber: 3,
    assistantStatus: createAssistantStatus(
      'working',
      '탭 구조를 정리하는 중이에요. 이제 좀 앱 같죠...!',
      `Keeping "${firstTab.title}" in focus`,
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

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState {
  if (action.type === 'activateTab') {
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
