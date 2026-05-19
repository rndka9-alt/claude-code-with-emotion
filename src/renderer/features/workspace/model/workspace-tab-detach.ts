import type {
  AssistantStatus,
  TerminalSession,
  WorkspaceState,
  WorkspaceTab,
} from "./workspace-state";
import { getTabSessionIds } from "./workspace-state";

export interface DetachedWorkspaceTabResult {
  detachedState: WorkspaceState;
  sourceState: WorkspaceState;
}

function createDetachAssistantStatus(
  line: string,
  currentTask: string,
  nowMs: number,
): AssistantStatus {
  return {
    visualState: "completed",
    emotion: "happy",
    line,
    currentTask,
    statusSinceMs: nowMs,
  };
}

function collectDetachedSessions(
  state: WorkspaceState,
  tab: WorkspaceTab,
): Record<string, TerminalSession> {
  const sessions: Record<string, TerminalSession> = {};

  for (const sessionId of getTabSessionIds(tab)) {
    const session = state.sessions[sessionId];

    if (session === undefined) {
      throw new Error(
        `Cannot detach workspace tab "${tab.id}" because session "${sessionId}" is missing.`,
      );
    }

    sessions[sessionId] = session;
  }

  return sessions;
}

function resolveNextActiveTabId(
  state: WorkspaceState,
  detachedTab: WorkspaceTab,
  detachedTabIndex: number,
  remainingTabs: WorkspaceTab[],
): string {
  if (
    state.activeTabId !== detachedTab.id &&
    remainingTabs.some((tab) => tab.id === state.activeTabId)
  ) {
    return state.activeTabId;
  }

  const fallbackTab =
    remainingTabs[Math.max(0, detachedTabIndex - 1)] ?? remainingTabs[0];

  if (fallbackTab === undefined) {
    throw new Error(
      "Cannot resolve an active tab after detaching a workspace tab.",
    );
  }

  return fallbackTab.id;
}

export function detachWorkspaceTab(
  state: WorkspaceState,
  tabId: string,
  nowMs: number,
): DetachedWorkspaceTabResult | null {
  const detachedTabIndex = state.tabs.findIndex((tab) => tab.id === tabId);

  if (detachedTabIndex < 0 || state.tabs.length <= 1) {
    return null;
  }

  const detachedTab = state.tabs[detachedTabIndex];

  if (detachedTab === undefined) {
    throw new Error(
      `Cannot detach workspace tab "${tabId}" because it is missing.`,
    );
  }

  const detachedSessionIds = getTabSessionIds(detachedTab);
  const detachedSessions = collectDetachedSessions(state, detachedTab);
  const remainingTabs = state.tabs.filter((tab) => tab.id !== detachedTab.id);
  const nextSessions = { ...state.sessions };

  for (const sessionId of detachedSessionIds) {
    delete nextSessions[sessionId];
  }

  return {
    sourceState: {
      ...state,
      tabs: remainingTabs,
      sessions: nextSessions,
      activeTabId: resolveNextActiveTabId(
        state,
        detachedTab,
        detachedTabIndex,
        remainingTabs,
      ),
      assistantStatus: createDetachAssistantStatus(
        "탭을 새 창으로 분리할 준비를 마쳣어요...!",
        `Detached "${detachedTab.title}"`,
        nowMs,
      ),
    },
    detachedState: {
      tabs: [detachedTab],
      sessions: detachedSessions,
      activeTabId: detachedTab.id,
      nextSessionNumber: state.nextSessionNumber,
      assistantStatus: createDetachAssistantStatus(
        "분리된 탭이에요. 새 창에서도 이어갈 수 잇어요...!",
        `Ready "${detachedTab.title}" in a detached workspace`,
        nowMs,
      ),
    },
  };
}
