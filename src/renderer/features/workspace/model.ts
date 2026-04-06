import type {
  AssistantEmotionalState,
  AssistantSemanticState,
} from "../../../shared/assistant-status";

export type SessionLifecycle = "bootstrapping" | "ready";

const IMMEDIATE_EXIT_RELAUNCH_WINDOW_MS = 5_000;

export interface SessionTab {
  id: string;
  title: string;
  cwd: string;
  command: string;
  lifecycle: SessionLifecycle;
  createdAtMs: number;
  isManuallyRenamed: boolean;
  /** 터미널 OSC 시퀀스로 마지막에 받은 타이틀. 수동 이름을 지울 때 복원용. */
  terminalTitle: string;
}

export interface AssistantStatus {
  visualState: AssistantSemanticState;
  // lifecycle 상태(visualState) 와 감정 오버레이(emotion) 는 독립 축으로 따로 들고다닌다.
  // UI 조작 직후의 "해피 기분" 같은 짧은 무드를 표현하려면 여기서 emotion 을 얹는다.
  emotion?: AssistantEmotionalState;
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
  | { type: "activateTab"; tabId: string; nowMs: number }
  | { type: "createTab"; nowMs: number }
  | {
      type: "closeTab";
      tabId: string;
      nowMs: number;
      reason: "manual" | "exit";
    }
  | {
      type: "updateTabTitle";
      tabId: string;
      title: string;
      nowMs: number;
      source: "manual" | "terminal";
    }
  | {
      type: "reorderTab";
      tabId: string;
      destinationIndex: number;
      nowMs: number;
    }
  | { type: "resizePane"; index: number; deltaRatio: number };

const MIN_PANE_SIZE = 0.18;

function roundPaneSize(size: number): number {
  return Math.round(size * 10_000) / 10_000;
}

function createSessionTitle(tabNumber: number): string {
  return `new session ${tabNumber} · claude-code-with-emotion`;
}

function resolveDefaultSessionCwd(): string {
  const workspaceCwd = window.claudeApp?.workspaceCwd;

  if (typeof workspaceCwd === "string" && workspaceCwd.length > 0) {
    return workspaceCwd;
  }

  return "/tmp";
}

function createSessionTab(tabNumber: number, nowMs: number): SessionTab {
  return {
    id: `session-${tabNumber}`,
    title: createSessionTitle(tabNumber),
    cwd: resolveDefaultSessionCwd(),
    command: "",
    lifecycle: "bootstrapping",
    createdAtMs: nowMs,
    isManuallyRenamed: false,
    terminalTitle: "",
  };
}

function createRecoverySessionTab(
  tabNumber: number,
  nowMs: number,
): SessionTab {
  return createSessionTab(tabNumber, nowMs);
}

function createAssistantStatus(
  visualState: AssistantSemanticState,
  line: string,
  currentTask: string,
  nowMs: number,
  emotion?: AssistantEmotionalState,
): AssistantStatus {
  // exactOptionalPropertyTypes 이 켜져 잇어서 undefined 를 직접 박으면 타입 안 맞음.
  // emotion 이 잇을 때만 스프레드로 필드를 얹어 준다.
  return {
    visualState,
    ...(emotion !== undefined ? { emotion } : {}),
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
  reason: "manual" | "exit",
  closedTabTitle: string,
  nowMs: number,
): AssistantStatus {
  if (reason === "exit") {
    return createAssistantStatus(
      "waiting",
      "터미널이 종료돼서 탭도 같이 닫앗어요...!",
      `Closed "${closedTabTitle}" after the shell exited`,
      nowMs,
    );
  }

  return createAssistantStatus(
    "completed",
    "탭 하나 정리햇어요. 꽤 깔끔하죠...!",
    `Closed "${closedTabTitle}"`,
    nowMs,
    "happy",
  );
}

function closeTabState(
  state: WorkspaceState,
  tabId: string,
  nowMs: number,
  reason: "manual" | "exit",
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
      reason === "exit" &&
      nowMs - closedTab.createdAtMs < IMMEDIATE_EXIT_RELAUNCH_WINDOW_MS;
    const replacementTab = shouldPauseAutoLaunch
      ? createRecoverySessionTab(state.nextTabNumber, nowMs)
      : createSessionTab(state.nextTabNumber, nowMs);
    const replacementLine = shouldPauseAutoLaunch
      ? "세션이 너무 빨리 종료돼서 Claude 자동 재실행은 멈춰뒀어요...!"
      : reason === "exit"
        ? "마지막 세션이 종료돼서 새 탭을 바로 준비햇어요...!"
        : "마지막 탭을 닫아서 새 세션 하나 열어뒀어요...!";

    return {
      tabs: [replacementTab],
      paneSizes: [1],
      activeTabId: replacementTab.id,
      nextTabNumber: state.nextTabNumber + 1,
      assistantStatus: createAssistantStatus(
        shouldPauseAutoLaunch ? "error" : "waiting",
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
      : (remainingTabs[Math.max(0, tabIndex - 1)]?.id ?? remainingTabs[0]?.id);

  if (typeof nextActiveTabId !== "string") {
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
      "working",
      "새 세션 하나만 먼저 열어뒀어요...!",
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
  action: Extract<WorkspaceAction, { type: "activateTab" }>,
): WorkspaceState {
  const nextActiveTab = state.tabs.find((tab) => tab.id === action.tabId);

  if (nextActiveTab === undefined) {
    return state;
  }

  return {
    ...state,
    activeTabId: nextActiveTab.id,
    assistantStatus: createAssistantStatus(
      "working",
      "세션 전환 완료. 흐름 안 놓쳣어요...!",
      `Reviewing "${nextActiveTab.title}"`,
      action.nowMs,
    ),
  };
}

function updateTabTitleState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: "updateTabTitle" }>,
): WorkspaceState {
  const normalizedTitle = action.title.trim();
  const tabToUpdate = state.tabs.find((tab) => tab.id === action.tabId);

  if (tabToUpdate === undefined) {
    return state;
  }

  // 수동 편집에서 타이틀을 전부 지우면 잠금을 해제하고 캐싱된 터미널 타이틀로 복원한다.
  if (normalizedTitle.length === 0) {
    if (action.source !== "manual" || !tabToUpdate.isManuallyRenamed) {
      return state;
    }

    const restoredTitle = tabToUpdate.terminalTitle || tabToUpdate.title;

    return {
      ...state,
      tabs: state.tabs.map((tab) =>
        tab.id === action.tabId
          ? { ...tab, title: restoredTitle, isManuallyRenamed: false }
          : tab,
      ),
      assistantStatus: createAssistantStatus(
        "completed",
        "이름 잠금 풀렷어요. 터미널이 알아서 채워넣을 거예요...!",
        `Unlocked terminal title sync for "${restoredTitle}"`,
        action.nowMs,
        "happy",
      ),
    };
  }

  if (tabToUpdate.title === normalizedTitle) {
    return state;
  }

  // 유저가 직접 지은 이름은 터미널 OSC 시퀀스로 덮어쓰지 않는다.
  // 단, terminalTitle 캐시는 항상 최신으로 유지한다.
  if (action.source === "terminal" && tabToUpdate.isManuallyRenamed) {
    if (tabToUpdate.terminalTitle === normalizedTitle) {
      return state;
    }

    return {
      ...state,
      tabs: state.tabs.map((tab) =>
        tab.id === action.tabId
          ? { ...tab, terminalTitle: normalizedTitle }
          : tab,
      ),
    };
  }

  const isManuallyRenamed = action.source === "manual";
  const terminalTitle =
    action.source === "terminal" ? normalizedTitle : tabToUpdate.terminalTitle;

  return {
    ...state,
    tabs: state.tabs.map((tab) =>
      tab.id === action.tabId
        ? { ...tab, title: normalizedTitle, isManuallyRenamed, terminalTitle }
        : tab,
    ),
    assistantStatus: createAssistantStatus(
      isManuallyRenamed ? "completed" : "working",
      isManuallyRenamed
        ? "탭 이름 바꿧어요. 더 알아보기 쉬워요...!"
        : "터미널 타이틀을 탭 이름으로 동기화햇어요...!",
      `Renamed "${tabToUpdate.title}" to "${normalizedTitle}"`,
      action.nowMs,
      isManuallyRenamed ? "happy" : undefined,
    ),
  };
}

function reorderTabState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: "reorderTab" }>,
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
      "working",
      "탭 순서 바꿔놨어요. 동선이 좀 더 편해질 거예요...!",
      `Moved "${movedTab.title}"`,
      action.nowMs,
    ),
  };
}

function createTabState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: "createTab" }>,
): WorkspaceState {
  const nextTab = createSessionTab(state.nextTabNumber, action.nowMs);
  const nextTabs = [...state.tabs, nextTab];

  return {
    tabs: nextTabs,
    paneSizes: createBalancedPaneSizes(nextTabs.length),
    activeTabId: nextTab.id,
    nextTabNumber: state.nextTabNumber + 1,
    assistantStatus: createAssistantStatus(
      "completed",
      "새 탭 하나 추가햇어요. 멀티세션 기분 좋다...!",
      `Bootstrapping "${nextTab.title}"`,
      action.nowMs,
      "happy",
    ),
  };
}

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState {
  if (action.type === "activateTab") {
    return activateTabState(state, action);
  }

  if (action.type === "resizePane") {
    return {
      ...state,
      paneSizes: resizePaneSizes(
        state.paneSizes,
        action.index,
        action.deltaRatio,
      ),
    };
  }

  if (action.type === "closeTab") {
    return closeTabState(state, action.tabId, action.nowMs, action.reason);
  }

  if (action.type === "updateTabTitle") {
    return updateTabTitleState(state, action);
  }

  if (action.type === "reorderTab") {
    return reorderTabState(state, action);
  }

  return createTabState(state, action);
}
