import type {
  AssistantEmotionalState,
  AssistantSemanticState,
} from "../../../../shared/assistant-status";

export type SessionLifecycle = "bootstrapping" | "ready";

const IMMEDIATE_EXIT_RELAUNCH_WINDOW_MS = 5_000;
const MIN_PANE_SIZE = 0.18;

export interface TerminalSession {
  id: string;
  title: string;
  cwd: string;
  command: string;
  lifecycle: SessionLifecycle;
  createdAtMs: number;
}

export interface WorkspaceTab {
  id: string;
  title: string;
  focusedSessionId: string;
  isManuallyRenamed: boolean;
  paneSizes: number[];
  sessionIds: string[];
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
  tabs: WorkspaceTab[];
  sessions: Record<string, TerminalSession>;
  activeTabId: string;
  nextSessionNumber: number;
  nextTabNumber: number;
  assistantStatus: AssistantStatus;
}

export type WorkspaceAction =
  | { type: "activateTab"; tabId: string; nowMs: number }
  | { type: "createTab"; nowMs: number }
  | { type: "createSessionInTab"; tabId: string; nowMs: number }
  | {
      type: "closeFocusedSession";
      tabId: string;
      nowMs: number;
      reason: "manual" | "exit";
    }
  | {
      type: "closeSession";
      sessionId: string;
      nowMs: number;
      reason: "manual" | "exit";
    }
  | {
      type: "focusSession";
      sessionId: string;
      tabId: string;
    }
  | {
      type: "renameTab";
      tabId: string;
      title: string;
      nowMs: number;
    }
  | {
      type: "syncSessionTitle";
      sessionId: string;
      title: string;
      nowMs: number;
    }
  | {
      type: "reorderTab";
      tabId: string;
      destinationIndex: number;
      nowMs: number;
    }
  | { type: "resizePane"; index: number; deltaRatio: number };

function roundPaneSize(size: number): number {
  return Math.round(size * 10_000) / 10_000;
}

function createSessionTitle(sessionNumber: number): string {
  return `new session ${sessionNumber} · claude-code-with-emotion`;
}

function resolveDefaultSessionCwd(): string {
  const workspaceCwd = window.claudeApp?.workspaceCwd;

  if (typeof workspaceCwd === "string" && workspaceCwd.length > 0) {
    return workspaceCwd;
  }

  return "/tmp";
}

function createSession(
  sessionNumber: number,
  nowMs: number,
): TerminalSession {
  return {
    id: `session-${sessionNumber}`,
    title: createSessionTitle(sessionNumber),
    cwd: resolveDefaultSessionCwd(),
    command: "",
    lifecycle: "bootstrapping",
    createdAtMs: nowMs,
  };
}

function createRecoverySession(
  sessionNumber: number,
  nowMs: number,
): TerminalSession {
  return createSession(sessionNumber, nowMs);
}

function createWorkspaceTab(
  tabNumber: number,
  session: TerminalSession,
): WorkspaceTab {
  return {
    id: `tab-${tabNumber}`,
    title: session.title,
    focusedSessionId: session.id,
    isManuallyRenamed: false,
    paneSizes: [1],
    sessionIds: [session.id],
    terminalTitle: session.title,
  };
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

function getPrimarySessionId(tab: WorkspaceTab): string | null {
  return tab.sessionIds[0] ?? null;
}

function getSession(
  state: WorkspaceState,
  sessionId: string,
): TerminalSession | null {
  return state.sessions[sessionId] ?? null;
}

function getTabById(state: WorkspaceState, tabId: string): WorkspaceTab | null {
  return state.tabs.find((tab) => tab.id === tabId) ?? null;
}

function getTabIndexBySessionId(
  state: WorkspaceState,
  sessionId: string,
): number {
  return state.tabs.findIndex((tab) => tab.sessionIds.includes(sessionId));
}

function normalizePaneSizes(paneSizes: number[]): number[] {
  if (paneSizes.length <= 1) {
    return paneSizes.length === 1 ? [1] : [];
  }

  const total = paneSizes.reduce((sum, size) => sum + size, 0);

  if (total <= 0) {
    return createBalancedPaneSizes(paneSizes.length);
  }

  return paneSizes.map((size) => roundPaneSize(size / total));
}

function removePaneSizeAtIndex(paneSizes: number[], index: number): number[] {
  const nextPaneSizes = paneSizes.filter(
    (_paneSize, paneIndex) => paneIndex !== index,
  );

  return normalizePaneSizes(nextPaneSizes);
}

function syncTabWithPrimarySession(
  tab: WorkspaceTab,
  sessions: Record<string, TerminalSession>,
): WorkspaceTab {
  const primarySessionId = getPrimarySessionId(tab);

  if (primarySessionId === null) {
    return tab;
  }

  const primarySession = sessions[primarySessionId];

  if (primarySession === undefined) {
    return tab;
  }

  if (tab.isManuallyRenamed) {
    return {
      ...tab,
      terminalTitle: primarySession.title,
    };
  }

  return {
    ...tab,
    title: primarySession.title,
    terminalTitle: primarySession.title,
  };
}

function createClosedSessionAssistantStatus(
  reason: "manual" | "exit",
  closedSessionTitle: string,
  nowMs: number,
): AssistantStatus {
  if (reason === "exit") {
    return createAssistantStatus(
      "waiting",
      "터미널이 종료대서 세션도 같이 정리햇어요...!",
      `Closed "${closedSessionTitle}" after the shell exited`,
      nowMs,
    );
  }

  return createAssistantStatus(
    "completed",
    "포커스된 세션 하나 닫앗어요. 정리감 꽤 좋죠...!",
    `Closed "${closedSessionTitle}"`,
    nowMs,
    "happy",
  );
}

function createReplacementWorkspaceState(
  state: WorkspaceState,
  closedSession: TerminalSession,
  nowMs: number,
  reason: "manual" | "exit",
): WorkspaceState {
  const shouldPauseAutoLaunch =
    reason === "exit" &&
    nowMs - closedSession.createdAtMs < IMMEDIATE_EXIT_RELAUNCH_WINDOW_MS;
  const replacementSession = shouldPauseAutoLaunch
    ? createRecoverySession(state.nextSessionNumber, nowMs)
    : createSession(state.nextSessionNumber, nowMs);
  const replacementTab = createWorkspaceTab(
    state.nextTabNumber,
    replacementSession,
  );
  const replacementLine = shouldPauseAutoLaunch
    ? "세션이 너무 빨리 종료대서 Claude 자동 재실행은 멈춰뒀어요...!"
    : reason === "exit"
      ? "마지막 세션이 종료대서 새 탭을 바로 준비햇어요...!"
      : "마지막 세션을 닫아서 새 탭 하나 열어뒀어요...!";

  return {
    tabs: [replacementTab],
    sessions: {
      [replacementSession.id]: replacementSession,
    },
    activeTabId: replacementTab.id,
    nextSessionNumber: state.nextSessionNumber + 1,
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

function closeSessionState(
  state: WorkspaceState,
  sessionId: string,
  nowMs: number,
  reason: "manual" | "exit",
): WorkspaceState {
  const sessionToClose = getSession(state, sessionId);
  const tabIndex = getTabIndexBySessionId(state, sessionId);

  if (sessionToClose === null || tabIndex < 0) {
    return state;
  }

  const tab = state.tabs[tabIndex];

  if (tab === undefined) {
    return state;
  }

  const sessionIndex = tab.sessionIds.findIndex(
    (candidateSessionId) => candidateSessionId === sessionId,
  );

  if (sessionIndex < 0) {
    return state;
  }

  const nextSessions = { ...state.sessions };
  delete nextSessions[sessionId];

  const remainingSessionIds = tab.sessionIds.filter(
    (candidateSessionId) => candidateSessionId !== sessionId,
  );

  if (remainingSessionIds.length === 0) {
    const remainingTabs = state.tabs.filter(
      (candidateTab) => candidateTab.id !== tab.id,
    );

    if (remainingTabs.length === 0) {
      return createReplacementWorkspaceState(
        state,
        sessionToClose,
        nowMs,
        reason,
      );
    }

    const nextActiveTabId =
      state.activeTabId !== tab.id
        ? state.activeTabId
        : (remainingTabs[Math.max(0, tabIndex - 1)]?.id ??
            remainingTabs[0]?.id);

    if (typeof nextActiveTabId !== "string") {
      return state;
    }

    return {
      ...state,
      tabs: remainingTabs,
      sessions: nextSessions,
      activeTabId: nextActiveTabId,
      assistantStatus: createClosedSessionAssistantStatus(
        reason,
        sessionToClose.title,
        nowMs,
      ),
    };
  }

  const nextFocusedSessionId =
    tab.focusedSessionId !== sessionId
      ? tab.focusedSessionId
      : (remainingSessionIds[Math.max(0, sessionIndex - 1)] ??
          remainingSessionIds[0]);

  if (typeof nextFocusedSessionId !== "string") {
    return state;
  }

  const resizedPaneSizes = removePaneSizeAtIndex(tab.paneSizes, sessionIndex);
  const nextTab = syncTabWithPrimarySession(
    {
      ...tab,
      focusedSessionId: nextFocusedSessionId,
      paneSizes:
        resizedPaneSizes.length > 0
          ? resizedPaneSizes
          : createBalancedPaneSizes(remainingSessionIds.length),
      sessionIds: remainingSessionIds,
    },
    nextSessions,
  );

  return {
    ...state,
    tabs: state.tabs.map((candidateTab) =>
      candidateTab.id === tab.id ? nextTab : candidateTab,
    ),
    sessions: nextSessions,
    assistantStatus: createClosedSessionAssistantStatus(
      reason,
      sessionToClose.title,
      nowMs,
    ),
  };
}

export function createInitialWorkspaceState(nowMs: number): WorkspaceState {
  const firstSession = createSession(1, nowMs - 2_500);
  const firstTab = createWorkspaceTab(1, firstSession);

  return {
    tabs: [firstTab],
    sessions: {
      [firstSession.id]: firstSession,
    },
    activeTabId: firstTab.id,
    nextSessionNumber: 2,
    nextTabNumber: 2,
    assistantStatus: createAssistantStatus(
      "working",
      "새 세션 하나만 먼저 열어뒀어요...!",
      `Bootstrapping "${firstTab.title}"`,
      nowMs,
    ),
  };
}

export function getActiveTab(state: WorkspaceState): WorkspaceTab | null {
  return getTabById(state, state.activeTabId) ?? state.tabs[0] ?? null;
}

export function getFocusedSession(state: WorkspaceState): TerminalSession | null {
  const activeTab = getActiveTab(state);

  if (activeTab === null) {
    return null;
  }

  const focusedSession = state.sessions[activeTab.focusedSessionId];

  if (focusedSession !== undefined) {
    return focusedSession;
  }

  const primarySessionId = getPrimarySessionId(activeTab);

  if (primarySessionId === null) {
    return null;
  }

  return state.sessions[primarySessionId] ?? null;
}

export function getVisibleSessions(state: WorkspaceState): TerminalSession[] {
  const activeTab = getActiveTab(state);

  if (activeTab === null) {
    return [];
  }

  return activeTab.sessionIds.flatMap((sessionId) => {
    const session = state.sessions[sessionId];
    return session === undefined ? [] : [session];
  });
}

export function getActivePaneSizes(state: WorkspaceState): number[] {
  return getActiveTab(state)?.paneSizes ?? [];
}

export function getAllSessionIds(state: WorkspaceState): string[] {
  return state.tabs.flatMap((tab) => tab.sessionIds);
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
  const nextActiveTab = getTabById(state, action.tabId);

  if (nextActiveTab === null) {
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

function focusSessionState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: "focusSession" }>,
): WorkspaceState {
  const tab = getTabById(state, action.tabId);

  if (tab === null || !tab.sessionIds.includes(action.sessionId)) {
    return state;
  }

  if (
    tab.focusedSessionId === action.sessionId &&
    state.activeTabId === action.tabId
  ) {
    return state;
  }

  return {
    ...state,
    activeTabId: action.tabId,
    tabs: state.tabs.map((candidateTab) =>
      candidateTab.id === action.tabId
        ? {
            ...candidateTab,
            focusedSessionId: action.sessionId,
          }
        : candidateTab,
    ),
  };
}

function renameTabState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: "renameTab" }>,
): WorkspaceState {
  const normalizedTitle = action.title.trim();
  const tabToUpdate = getTabById(state, action.tabId);

  if (tabToUpdate === null) {
    return state;
  }

  // 수동 편집에서 타이틀을 전부 지우면 잠금을 해제하고 캐싱된 터미널 타이틀로 복원한다.
  if (normalizedTitle.length === 0) {
    if (!tabToUpdate.isManuallyRenamed) {
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
        "이름 잠금 풀렷어요. 대표 세션 타이틀로 다시 따라갈게요...!",
        `Unlocked terminal title sync for "${restoredTitle}"`,
        action.nowMs,
        "happy",
      ),
    };
  }

  if (tabToUpdate.title === normalizedTitle) {
    return state;
  }

  return {
    ...state,
    tabs: state.tabs.map((tab) =>
      tab.id === action.tabId
        ? { ...tab, title: normalizedTitle, isManuallyRenamed: true }
        : tab,
    ),
    assistantStatus: createAssistantStatus(
      "completed",
      "탭 이름 바꿧어요. 더 알아보기 쉬워요...!",
      `Renamed "${tabToUpdate.title}" to "${normalizedTitle}"`,
      action.nowMs,
      "happy",
    ),
  };
}

function syncSessionTitleState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: "syncSessionTitle" }>,
): WorkspaceState {
  const normalizedTitle = action.title.trim();
  const sessionToUpdate = getSession(state, action.sessionId);

  if (sessionToUpdate === null || normalizedTitle.length === 0) {
    return state;
  }

  const owningTabIndex = getTabIndexBySessionId(state, action.sessionId);
  const owningTab =
    owningTabIndex >= 0 ? (state.tabs[owningTabIndex] ?? null) : null;
  const primarySessionId =
    owningTab !== null ? getPrimarySessionId(owningTab) : null;

  if (sessionToUpdate.title === normalizedTitle) {
    if (
      owningTab !== null &&
      primarySessionId === action.sessionId &&
      owningTab.terminalTitle !== normalizedTitle
    ) {
      return {
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.id === owningTab.id
            ? { ...tab, terminalTitle: normalizedTitle }
            : tab,
        ),
      };
    }

    return state;
  }

  const nextSessions = {
    ...state.sessions,
    [action.sessionId]: {
      ...sessionToUpdate,
      title: normalizedTitle,
    },
  };

  if (owningTab === null || primarySessionId !== action.sessionId) {
    return {
      ...state,
      sessions: nextSessions,
    };
  }

  const nextTab = syncTabWithPrimarySession(owningTab, nextSessions);

  if (owningTab.isManuallyRenamed) {
    return {
      ...state,
      sessions: nextSessions,
      tabs: state.tabs.map((tab) => (tab.id === owningTab.id ? nextTab : tab)),
    };
  }

  return {
    ...state,
    sessions: nextSessions,
    tabs: state.tabs.map((tab) => (tab.id === owningTab.id ? nextTab : tab)),
    assistantStatus: createAssistantStatus(
      "working",
      "터미널 타이틀을 탭 이름으로 동기화햇어요...!",
      `Renamed "${owningTab.title}" to "${normalizedTitle}"`,
      action.nowMs,
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
  const nextSession = createSession(state.nextSessionNumber, action.nowMs);
  const nextTab = createWorkspaceTab(state.nextTabNumber, nextSession);

  return {
    tabs: [...state.tabs, nextTab],
    sessions: {
      ...state.sessions,
      [nextSession.id]: nextSession,
    },
    activeTabId: nextTab.id,
    nextSessionNumber: state.nextSessionNumber + 1,
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

function createSessionInTabState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: "createSessionInTab" }>,
): WorkspaceState {
  const tab = getTabById(state, action.tabId);

  if (tab === null) {
    return state;
  }

  const nextSession = createSession(state.nextSessionNumber, action.nowMs);
  const nextTab = syncTabWithPrimarySession(
    {
      ...tab,
      focusedSessionId: nextSession.id,
      paneSizes: createBalancedPaneSizes(tab.sessionIds.length + 1),
      sessionIds: [...tab.sessionIds, nextSession.id],
    },
    {
      ...state.sessions,
      [nextSession.id]: nextSession,
    },
  );

  return {
    ...state,
    tabs: state.tabs.map((candidateTab) =>
      candidateTab.id === action.tabId ? nextTab : candidateTab,
    ),
    sessions: {
      ...state.sessions,
      [nextSession.id]: nextSession,
    },
    activeTabId: action.tabId,
    nextSessionNumber: state.nextSessionNumber + 1,
    assistantStatus: createAssistantStatus(
      "completed",
      "같은 탭에 세션 하나 더 붙엿어요. 이제 좀 분할기 냄새 나죠...!",
      `Bootstrapping "${nextSession.title}" in "${tab.title}"`,
      action.nowMs,
      "happy",
    ),
  };
}

function resizeActiveTabPaneState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: "resizePane" }>,
): WorkspaceState {
  const activeTab = getActiveTab(state);

  if (activeTab === null) {
    return state;
  }

  return {
    ...state,
    tabs: state.tabs.map((tab) =>
      tab.id === activeTab.id
        ? {
            ...tab,
            paneSizes: resizePaneSizes(
              activeTab.paneSizes,
              action.index,
              action.deltaRatio,
            ),
          }
        : tab,
    ),
  };
}

function closeFocusedSessionState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: "closeFocusedSession" }>,
): WorkspaceState {
  const tab = getTabById(state, action.tabId);

  if (tab === null) {
    return state;
  }

  return closeSessionState(
    state,
    tab.focusedSessionId,
    action.nowMs,
    action.reason,
  );
}

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState {
  if (action.type === "activateTab") {
    return activateTabState(state, action);
  }

  if (action.type === "createTab") {
    return createTabState(state, action);
  }

  if (action.type === "createSessionInTab") {
    return createSessionInTabState(state, action);
  }

  if (action.type === "closeFocusedSession") {
    return closeFocusedSessionState(state, action);
  }

  if (action.type === "closeSession") {
    return closeSessionState(
      state,
      action.sessionId,
      action.nowMs,
      action.reason,
    );
  }

  if (action.type === "focusSession") {
    return focusSessionState(state, action);
  }

  if (action.type === "renameTab") {
    return renameTabState(state, action);
  }

  if (action.type === "syncSessionTitle") {
    return syncSessionTitleState(state, action);
  }

  if (action.type === "reorderTab") {
    return reorderTabState(state, action);
  }

  return resizeActiveTabPaneState(state, action);
}
