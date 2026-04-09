import type {
  AssistantEmotionalState,
  AssistantSemanticState,
} from "../../../../shared/assistant-status";

export type SessionLifecycle = "bootstrapping" | "ready";
export type PaneSplitDirection = "horizontal" | "vertical";
export type PaneFocusDirection = "left" | "right" | "up" | "down";

export interface TerminalSession {
  id: string;
  title: string;
  cwd: string;
  command: string;
  lifecycle: SessionLifecycle;
  createdAtMs: number;
}

export interface WorkspacePaneNode {
  kind: "pane";
  id: string;
  sessionId: string;
}

export interface WorkspaceSplitNode {
  kind: "split";
  id: string;
  direction: PaneSplitDirection;
  children: [WorkspaceLayoutNode, WorkspaceLayoutNode];
  sizes: [number, number];
}

export type WorkspaceLayoutNode = WorkspacePaneNode | WorkspaceSplitNode;

export interface WorkspaceTab {
  id: string;
  // 사용자가 보는 탭 레이블. 수동 rename 이 걸리면 이 값이 우선이다.
  title: string;
  focusedPaneId: string;
  focusedSessionId: string;
  isManuallyRenamed: boolean;
  layout: WorkspaceLayoutNode;
  // 탭 레벨 알림과 기본 제목 sync 의 기준이 되는 대표 세션.
  primarySessionId: string;
  // 대표 세션이 마지막으로 올린 터미널 제목. 수동 rename 해도 별도로 유지한다.
  primarySessionTitle: string;
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
  nextPaneNumber: number;
  nextSessionNumber: number;
  nextSplitNumber: number;
  nextTabNumber: number;
  assistantStatus: AssistantStatus;
}

export type WorkspaceAction =
  | { type: "activateTab"; tabId: string; nowMs: number }
  | { type: "createTab"; nowMs: number }
  | {
      type: "splitPane";
      tabId: string;
      direction: PaneSplitDirection;
      nowMs: number;
    }
  | {
      type: "closePane";
      tabId: string;
      paneId: string;
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
      type: "closeTab";
      tabId: string;
      nowMs: number;
    }
  | {
      type: "focusPane";
      paneId: string;
      tabId: string;
    }
  | {
      type: "moveFocus";
      tabId: string;
      direction: PaneFocusDirection;
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
  | { type: "resizeSplit"; splitId: string; deltaRatio: number };

interface PaneRect {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

interface RemovePaneResult {
  layout: WorkspaceLayoutNode | null;
  removed: boolean;
  suggestedFocusPaneId: string | null;
}

const IMMEDIATE_EXIT_RELAUNCH_WINDOW_MS = 5_000;
const MIN_PANE_SIZE = 0.18;
const LAYOUT_EPSILON = 0.0001;

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

function createPaneNode(
  paneNumber: number,
  sessionId: string,
): WorkspacePaneNode {
  return {
    kind: "pane",
    id: `pane-${paneNumber}`,
    sessionId,
  };
}

function createWorkspaceTab(
  tabNumber: number,
  pane: WorkspacePaneNode,
  session: TerminalSession,
): WorkspaceTab {
  return {
    id: `tab-${tabNumber}`,
    title: session.title,
    focusedPaneId: pane.id,
    focusedSessionId: session.id,
    isManuallyRenamed: false,
    layout: pane,
    primarySessionId: session.id,
    primarySessionTitle: session.title,
  };
}

function createAssistantStatus(
  visualState: AssistantSemanticState,
  line: string,
  currentTask: string,
  nowMs: number,
  emotion?: AssistantEmotionalState,
): AssistantStatus {
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

function normalizeSplitSizes(
  sizes: readonly [number, number],
): [number, number] {
  const total = sizes[0] + sizes[1];

  if (total <= 0) {
    const balanced = createBalancedPaneSizes(2);
    return [balanced[0] ?? 0.5, balanced[1] ?? 0.5];
  }

  return [roundPaneSize(sizes[0] / total), roundPaneSize(sizes[1] / total)];
}

function getLayoutSessionIds(layout: WorkspaceLayoutNode): string[] {
  if (layout.kind === "pane") {
    return [layout.sessionId];
  }

  return [
    ...getLayoutSessionIds(layout.children[0]),
    ...getLayoutSessionIds(layout.children[1]),
  ];
}

export function getTabSessionIds(tab: WorkspaceTab): string[] {
  return getLayoutSessionIds(tab.layout);
}

function getPrimarySessionId(tab: WorkspaceTab): string | null {
  return tab.primarySessionId;
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
  return state.tabs.findIndex((tab) => getTabSessionIds(tab).includes(sessionId));
}

function findPaneById(
  layout: WorkspaceLayoutNode,
  paneId: string,
): WorkspacePaneNode | null {
  if (layout.kind === "pane") {
    return layout.id === paneId ? layout : null;
  }

  return (
    findPaneById(layout.children[0], paneId) ??
    findPaneById(layout.children[1], paneId)
  );
}

function findPaneBySessionId(
  layout: WorkspaceLayoutNode,
  sessionId: string,
): WorkspacePaneNode | null {
  if (layout.kind === "pane") {
    return layout.sessionId === sessionId ? layout : null;
  }

  return (
    findPaneBySessionId(layout.children[0], sessionId) ??
    findPaneBySessionId(layout.children[1], sessionId)
  );
}

function findFirstPane(layout: WorkspaceLayoutNode): WorkspacePaneNode {
  if (layout.kind === "pane") {
    return layout;
  }

  return findFirstPane(layout.children[0]);
}

function syncTabTitleWithPrimarySession(
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
      primarySessionTitle: primarySession.title,
    };
  }

  return {
    ...tab,
    title: primarySession.title,
    primarySessionTitle: primarySession.title,
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
  const replacementPane = createPaneNode(
    state.nextPaneNumber,
    replacementSession.id,
  );
  const replacementTab = createWorkspaceTab(
    state.nextTabNumber,
    replacementPane,
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
    nextPaneNumber: state.nextPaneNumber + 1,
    nextSessionNumber: state.nextSessionNumber + 1,
    nextSplitNumber: state.nextSplitNumber,
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

function removePaneFromLayout(
  layout: WorkspaceLayoutNode,
  paneId: string,
): RemovePaneResult {
  if (layout.kind === "pane") {
    if (layout.id !== paneId) {
      return {
        layout,
        removed: false,
        suggestedFocusPaneId: null,
      };
    }

    return {
      layout: null,
      removed: true,
      suggestedFocusPaneId: null,
    };
  }

  const firstChildResult = removePaneFromLayout(layout.children[0], paneId);

  if (firstChildResult.removed) {
    if (firstChildResult.layout === null) {
      const fallbackPane = findFirstPane(layout.children[1]);

      return {
        layout: layout.children[1],
        removed: true,
        suggestedFocusPaneId: fallbackPane.id,
      };
    }

    return {
      layout: {
        ...layout,
        children: [firstChildResult.layout, layout.children[1]],
      },
      removed: true,
      suggestedFocusPaneId: firstChildResult.suggestedFocusPaneId,
    };
  }

  const secondChildResult = removePaneFromLayout(layout.children[1], paneId);

  if (secondChildResult.removed) {
    if (secondChildResult.layout === null) {
      const fallbackPane = findFirstPane(layout.children[0]);

      return {
        layout: layout.children[0],
        removed: true,
        suggestedFocusPaneId: fallbackPane.id,
      };
    }

    return {
      layout: {
        ...layout,
        children: [layout.children[0], secondChildResult.layout],
      },
      removed: true,
      suggestedFocusPaneId: secondChildResult.suggestedFocusPaneId,
    };
  }

  return {
    layout,
    removed: false,
    suggestedFocusPaneId: null,
  };
}

function splitPaneInLayout(
  layout: WorkspaceLayoutNode,
  paneId: string,
  direction: PaneSplitDirection,
  splitId: string,
  nextPane: WorkspacePaneNode,
): WorkspaceLayoutNode {
  if (layout.kind === "pane") {
    if (layout.id !== paneId) {
      return layout;
    }

    return {
      kind: "split",
      id: splitId,
      direction,
      children: [layout, nextPane],
      sizes: [0.5, 0.5],
    };
  }

  const firstChild = splitPaneInLayout(
    layout.children[0],
    paneId,
    direction,
    splitId,
    nextPane,
  );

  if (firstChild !== layout.children[0]) {
    return {
      ...layout,
      children: [firstChild, layout.children[1]],
    };
  }

  const secondChild = splitPaneInLayout(
    layout.children[1],
    paneId,
    direction,
    splitId,
    nextPane,
  );

  if (secondChild !== layout.children[1]) {
    return {
      ...layout,
      children: [layout.children[0], secondChild],
    };
  }

  return layout;
}

function resizeSplitInLayout(
  layout: WorkspaceLayoutNode,
  splitId: string,
  deltaRatio: number,
): WorkspaceLayoutNode {
  if (layout.kind === "pane") {
    return layout;
  }

  if (layout.id === splitId) {
    return {
      ...layout,
      sizes: resizePaneSizes(layout.sizes, 0, deltaRatio),
    };
  }

  const firstChild = resizeSplitInLayout(layout.children[0], splitId, deltaRatio);

  if (firstChild !== layout.children[0]) {
    return {
      ...layout,
      children: [firstChild, layout.children[1]],
    };
  }

  const secondChild = resizeSplitInLayout(
    layout.children[1],
    splitId,
    deltaRatio,
  );

  if (secondChild !== layout.children[1]) {
    return {
      ...layout,
      children: [layout.children[0], secondChild],
    };
  }

  return layout;
}

function collectPaneRects(
  layout: WorkspaceLayoutNode,
  rects: Map<string, PaneRect>,
  left = 0,
  top = 0,
  width = 1,
  height = 1,
): void {
  if (layout.kind === "pane") {
    rects.set(layout.id, {
      left,
      top,
      right: left + width,
      bottom: top + height,
    });
    return;
  }

  const sizes = normalizeSplitSizes(layout.sizes);

  if (layout.direction === "horizontal") {
    const firstWidth = width * sizes[0];
    const secondWidth = width * sizes[1];

    collectPaneRects(layout.children[0], rects, left, top, firstWidth, height);
    collectPaneRects(
      layout.children[1],
      rects,
      left + firstWidth,
      top,
      secondWidth,
      height,
    );
    return;
  }

  const firstHeight = height * sizes[0];
  const secondHeight = height * sizes[1];

  collectPaneRects(layout.children[0], rects, left, top, width, firstHeight);
  collectPaneRects(
    layout.children[1],
    rects,
    left,
    top + firstHeight,
    width,
    secondHeight,
  );
}

function getAxisGap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): number {
  if (endA < startB) {
    return startB - endA;
  }

  if (endB < startA) {
    return startA - endB;
  }

  return 0;
}

function getRectCenterX(rect: PaneRect): number {
  return (rect.left + rect.right) / 2;
}

function getRectCenterY(rect: PaneRect): number {
  return (rect.top + rect.bottom) / 2;
}

function resolveAdjacentPaneId(
  layout: WorkspaceLayoutNode,
  focusedPaneId: string,
  direction: PaneFocusDirection,
): string | null {
  const rects = new Map<string, PaneRect>();

  collectPaneRects(layout, rects);

  const currentRect = rects.get(focusedPaneId);

  if (currentRect === undefined) {
    return null;
  }

  let bestCandidate:
    | {
        centerDistance: number;
        paneId: string;
        primaryGap: number;
        secondaryGap: number;
      }
    | null = null;

  for (const [paneId, rect] of rects.entries()) {
    if (paneId === focusedPaneId) {
      continue;
    }

    let primaryGap = Number.POSITIVE_INFINITY;
    let secondaryGap = Number.POSITIVE_INFINITY;
    let centerDistance = Number.POSITIVE_INFINITY;

    if (direction === "left") {
      if (rect.right > currentRect.left + LAYOUT_EPSILON) {
        continue;
      }

      primaryGap = currentRect.left - rect.right;
      secondaryGap = getAxisGap(
        currentRect.top,
        currentRect.bottom,
        rect.top,
        rect.bottom,
      );
      centerDistance = Math.abs(getRectCenterY(currentRect) - getRectCenterY(rect));
    }

    if (direction === "right") {
      if (rect.left + LAYOUT_EPSILON < currentRect.right) {
        continue;
      }

      primaryGap = rect.left - currentRect.right;
      secondaryGap = getAxisGap(
        currentRect.top,
        currentRect.bottom,
        rect.top,
        rect.bottom,
      );
      centerDistance = Math.abs(getRectCenterY(currentRect) - getRectCenterY(rect));
    }

    if (direction === "up") {
      if (rect.bottom > currentRect.top + LAYOUT_EPSILON) {
        continue;
      }

      primaryGap = currentRect.top - rect.bottom;
      secondaryGap = getAxisGap(
        currentRect.left,
        currentRect.right,
        rect.left,
        rect.right,
      );
      centerDistance = Math.abs(getRectCenterX(currentRect) - getRectCenterX(rect));
    }

    if (direction === "down") {
      if (rect.top + LAYOUT_EPSILON < currentRect.bottom) {
        continue;
      }

      primaryGap = rect.top - currentRect.bottom;
      secondaryGap = getAxisGap(
        currentRect.left,
        currentRect.right,
        rect.left,
        rect.right,
      );
      centerDistance = Math.abs(getRectCenterX(currentRect) - getRectCenterX(rect));
    }

    if (
      bestCandidate === null ||
      primaryGap < bestCandidate.primaryGap ||
      (primaryGap === bestCandidate.primaryGap &&
        secondaryGap < bestCandidate.secondaryGap) ||
      (primaryGap === bestCandidate.primaryGap &&
        secondaryGap === bestCandidate.secondaryGap &&
        centerDistance < bestCandidate.centerDistance)
    ) {
      bestCandidate = {
        paneId,
        primaryGap,
        secondaryGap,
        centerDistance,
      };
    }
  }

  return bestCandidate?.paneId ?? null;
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

  const paneToClose = findPaneBySessionId(tab.layout, sessionId);

  if (paneToClose === null) {
    return state;
  }

  const nextSessions = { ...state.sessions };
  delete nextSessions[sessionId];

  const removeResult = removePaneFromLayout(tab.layout, paneToClose.id);

  if (!removeResult.removed) {
    return state;
  }

  if (removeResult.layout === null) {
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

  const nextPrimaryPane = findFirstPane(removeResult.layout);
  const nextPrimarySessionId = nextPrimaryPane.sessionId;
  const fallbackFocusedPaneId =
    removeResult.suggestedFocusPaneId ?? nextPrimaryPane.id;
  const nextFocusedPaneId =
    tab.focusedPaneId !== paneToClose.id
      ? tab.focusedPaneId
      : fallbackFocusedPaneId;
  const nextFocusedPane = findPaneById(removeResult.layout, nextFocusedPaneId);
  const resolvedFocusedPane =
    nextFocusedPane ?? findPaneById(removeResult.layout, fallbackFocusedPaneId);

  if (resolvedFocusedPane === null) {
    return state;
  }

  const nextTab = syncTabTitleWithPrimarySession(
    {
      ...tab,
      focusedPaneId: resolvedFocusedPane.id,
      focusedSessionId: resolvedFocusedPane.sessionId,
      layout: removeResult.layout,
      primarySessionId: nextPrimarySessionId,
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
  const firstPane = createPaneNode(1, firstSession.id);
  const firstTab = createWorkspaceTab(1, firstPane, firstSession);

  return {
    tabs: [firstTab],
    sessions: {
      [firstSession.id]: firstSession,
    },
    activeTabId: firstTab.id,
    nextPaneNumber: 2,
    nextSessionNumber: 2,
    nextSplitNumber: 1,
    nextTabNumber: 2,
    assistantStatus: createAssistantStatus(
      "disconnected",
      "Claude 아직 미연결이에요. 준비되면 바로 붙을게요...!",
      "Waiting for Claude to start",
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

  return getTabSessionIds(activeTab).flatMap((sessionId) => {
    const session = state.sessions[sessionId];
    return session === undefined ? [] : [session];
  });
}

export function getAllSessionIds(state: WorkspaceState): string[] {
  return state.tabs.flatMap((tab) => getTabSessionIds(tab));
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
  paneSizes: readonly [number, number],
  index: number,
  deltaRatio: number,
): [number, number] {
  const currentSize = paneSizes[index];
  const nextSize = paneSizes[index + 1];

  if (currentSize === undefined || nextSize === undefined) {
    return [paneSizes[0], paneSizes[1]];
  }

  const minDelta = -(currentSize - MIN_PANE_SIZE);
  const maxDelta = nextSize - MIN_PANE_SIZE;
  const boundedDelta = Math.min(Math.max(deltaRatio, minDelta), maxDelta);

  if (boundedDelta === 0) {
    return [paneSizes[0], paneSizes[1]];
  }

  return normalizeSplitSizes([
    roundPaneSize(currentSize + boundedDelta),
    roundPaneSize(nextSize - boundedDelta),
  ]);
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

function focusPaneState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: "focusPane" }>,
): WorkspaceState {
  const tab = getTabById(state, action.tabId);

  if (tab === null) {
    return state;
  }

  const pane = findPaneById(tab.layout, action.paneId);

  if (pane === null) {
    return state;
  }

  if (tab.focusedPaneId === pane.id && state.activeTabId === action.tabId) {
    return state;
  }

  return {
    ...state,
    activeTabId: action.tabId,
    tabs: state.tabs.map((candidateTab) =>
      candidateTab.id === action.tabId
        ? {
            ...candidateTab,
            focusedPaneId: pane.id,
            focusedSessionId: pane.sessionId,
          }
        : candidateTab,
    ),
  };
}

function moveFocusState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: "moveFocus" }>,
): WorkspaceState {
  const tab = getTabById(state, action.tabId);

  if (tab === null) {
    return state;
  }

  const nextPaneId = resolveAdjacentPaneId(
    tab.layout,
    tab.focusedPaneId,
    action.direction,
  );

  if (nextPaneId === null) {
    return state;
  }

  return focusPaneState(state, {
    type: "focusPane",
    tabId: action.tabId,
    paneId: nextPaneId,
  });
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

  if (normalizedTitle.length === 0) {
    if (!tabToUpdate.isManuallyRenamed) {
      return state;
    }

    const restoredTitle = tabToUpdate.primarySessionTitle || tabToUpdate.title;

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
      owningTab.primarySessionTitle !== normalizedTitle
    ) {
      return {
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.id === owningTab.id
            ? { ...tab, primarySessionTitle: normalizedTitle }
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

  const nextTab = syncTabTitleWithPrimarySession(owningTab, nextSessions);

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
  const nextPane = createPaneNode(state.nextPaneNumber, nextSession.id);
  const nextTab = createWorkspaceTab(state.nextTabNumber, nextPane, nextSession);

  return {
    tabs: [...state.tabs, nextTab],
    sessions: {
      ...state.sessions,
      [nextSession.id]: nextSession,
    },
    activeTabId: nextTab.id,
    nextPaneNumber: state.nextPaneNumber + 1,
    nextSessionNumber: state.nextSessionNumber + 1,
    nextSplitNumber: state.nextSplitNumber,
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

function splitPaneState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: "splitPane" }>,
): WorkspaceState {
  const tab = getTabById(state, action.tabId);

  if (tab === null) {
    return state;
  }

  const nextSession = createSession(state.nextSessionNumber, action.nowMs);
  const nextPane = createPaneNode(state.nextPaneNumber, nextSession.id);
  const nextLayout = splitPaneInLayout(
    tab.layout,
    tab.focusedPaneId,
    action.direction,
    `split-${state.nextSplitNumber}`,
    nextPane,
  );

  if (nextLayout === tab.layout) {
    return state;
  }

  const nextTab = syncTabTitleWithPrimarySession(
    {
      ...tab,
      focusedPaneId: nextPane.id,
      focusedSessionId: nextSession.id,
      layout: nextLayout,
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
    nextPaneNumber: state.nextPaneNumber + 1,
    nextSessionNumber: state.nextSessionNumber + 1,
    nextSplitNumber: state.nextSplitNumber + 1,
    assistantStatus: createAssistantStatus(
      "completed",
      action.direction === "horizontal"
        ? "세션을 옆으로 갈랏어요. 작업대가 넓어졋다...!"
        : "세션을 아래로 갈랏어요. 층 분리 깔끔해요...!",
      `Bootstrapping "${nextSession.title}" in "${tab.title}"`,
      action.nowMs,
      "happy",
    ),
  };
}

function resizeSplitState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: "resizeSplit" }>,
): WorkspaceState {
  const activeTab = getActiveTab(state);

  if (activeTab === null) {
    return state;
  }

  const nextLayout = resizeSplitInLayout(
    activeTab.layout,
    action.splitId,
    action.deltaRatio,
  );

  if (nextLayout === activeTab.layout) {
    return state;
  }

  return {
    ...state,
    tabs: state.tabs.map((tab) =>
      tab.id === activeTab.id ? { ...tab, layout: nextLayout } : tab,
    ),
  };
}

function closePaneState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: "closePane" }>,
): WorkspaceState {
  const tab = getTabById(state, action.tabId);

  if (tab === null) {
    return state;
  }

  const pane = findPaneById(tab.layout, action.paneId);

  if (pane === null) {
    return state;
  }

  return closeSessionState(
    state,
    pane.sessionId,
    action.nowMs,
    action.reason,
  );
}

function closeTabState(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: "closeTab" }>,
): WorkspaceState {
  const tabIndex = state.tabs.findIndex((tab) => tab.id === action.tabId);

  if (tabIndex < 0) {
    return state;
  }

  const tab = state.tabs[tabIndex];

  if (tab === undefined) {
    return state;
  }

  const focusedSession =
    state.sessions[tab.focusedSessionId] ??
    state.sessions[tab.primarySessionId] ??
    null;

  if (focusedSession === null) {
    return state;
  }

  const nextSessions = { ...state.sessions };

  for (const sessionId of getTabSessionIds(tab)) {
    delete nextSessions[sessionId];
  }

  const remainingTabs = state.tabs.filter(
    (candidateTab) => candidateTab.id !== action.tabId,
  );

  if (remainingTabs.length === 0) {
    return createReplacementWorkspaceState(
      {
        ...state,
        sessions: nextSessions,
      },
      focusedSession,
      action.nowMs,
      "manual",
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
    assistantStatus: createAssistantStatus(
      "completed",
      "탭 하나 닫앗어요. 화면이 좀 더 단정해졋죠...!",
      `Closed tab "${tab.title}"`,
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

  if (action.type === "createTab") {
    return createTabState(state, action);
  }

  if (action.type === "splitPane") {
    return splitPaneState(state, action);
  }

  if (action.type === "closePane") {
    return closePaneState(state, action);
  }

  if (action.type === "closeSession") {
    return closeSessionState(
      state,
      action.sessionId,
      action.nowMs,
      action.reason,
    );
  }

  if (action.type === "closeTab") {
    return closeTabState(state, action);
  }

  if (action.type === "focusPane") {
    return focusPaneState(state, action);
  }

  if (action.type === "moveFocus") {
    return moveFocusState(state, action);
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

  return resizeSplitState(state, action);
}
