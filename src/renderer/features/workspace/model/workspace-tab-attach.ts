import type {
  AssistantStatus,
  TerminalSession,
  WorkspaceState,
  WorkspaceTab,
} from "./workspace-state";
import { getTabSessionIds } from "./workspace-state";
import { detachWorkspaceTab } from "./workspace-tab-detach";

export interface PreparedWorkspaceTabAttach {
  attachedState: WorkspaceState;
  sourceState: WorkspaceState | null;
}

function createAttachAssistantStatus(
  tabCount: number,
  nowMs: number,
): AssistantStatus {
  return {
    visualState: "completed",
    emotion: "happy",
    line:
      tabCount === 1
        ? "탭을 이 창에 다시 붙엿어요...!"
        : "탭들을 이 창에 다시 붙엿어요...!",
    currentTask:
      tabCount === 1
        ? "Attached a detached workspace tab"
        : `Attached ${tabCount} detached workspace tabs`,
    statusSinceMs: nowMs,
  };
}

function assertNoDuplicateTabIds(
  state: WorkspaceState,
  attachedTabs: ReadonlyArray<WorkspaceTab>,
): void {
  const existingTabIds = new Set(state.tabs.map((tab) => tab.id));

  for (const tab of attachedTabs) {
    if (existingTabIds.has(tab.id)) {
      throw new Error(
        `Cannot attach workspace tab "${tab.id}" because it already exists.`,
      );
    }
  }
}

function collectAttachedSessions(
  state: WorkspaceState,
  attachedState: WorkspaceState,
): Record<string, TerminalSession> {
  const sessions: Record<string, TerminalSession> = {};

  for (const tab of attachedState.tabs) {
    for (const sessionId of getTabSessionIds(tab)) {
      if (state.sessions[sessionId] !== undefined) {
        throw new Error(
          `Cannot attach workspace session "${sessionId}" because it already exists.`,
        );
      }

      const session = attachedState.sessions[sessionId];

      if (session === undefined) {
        throw new Error(
          `Cannot attach workspace tab "${tab.id}" because session "${sessionId}" is missing.`,
        );
      }

      sessions[sessionId] = session;
    }
  }

  return sessions;
}

function collectTabSessions(
  state: WorkspaceState,
  tab: WorkspaceTab,
): Record<string, TerminalSession> {
  const sessions: Record<string, TerminalSession> = {};

  for (const sessionId of getTabSessionIds(tab)) {
    const session = state.sessions[sessionId];

    if (session === undefined) {
      throw new Error(
        `Cannot attach workspace tab "${tab.id}" because session "${sessionId}" is missing.`,
      );
    }

    sessions[sessionId] = session;
  }

  return sessions;
}

function resolveAttachedActiveTabId(attachedState: WorkspaceState): string {
  if (attachedState.tabs.length === 0) {
    throw new Error("Cannot attach an empty workspace state.");
  }

  if (attachedState.tabs.some((tab) => tab.id === attachedState.activeTabId)) {
    return attachedState.activeTabId;
  }

  throw new Error(
    `Cannot attach workspace state because active tab "${attachedState.activeTabId}" is missing.`,
  );
}

export function attachWorkspaceState(
  state: WorkspaceState,
  attachedState: WorkspaceState,
  nowMs: number,
): WorkspaceState {
  assertNoDuplicateTabIds(state, attachedState.tabs);

  const attachedSessions = collectAttachedSessions(state, attachedState);
  const attachedActiveTabId = resolveAttachedActiveTabId(attachedState);

  return {
    ...state,
    tabs: [...state.tabs, ...attachedState.tabs],
    sessions: {
      ...state.sessions,
      ...attachedSessions,
    },
    activeTabId: attachedActiveTabId,
    nextSessionNumber: Math.max(
      state.nextSessionNumber,
      attachedState.nextSessionNumber,
    ),
    assistantStatus: createAttachAssistantStatus(
      attachedState.tabs.length,
      nowMs,
    ),
  };
}

export function prepareWorkspaceTabAttach(
  state: WorkspaceState,
  tabId: string,
  nowMs: number,
): PreparedWorkspaceTabAttach | null {
  const detachedResult = detachWorkspaceTab(state, tabId, nowMs);

  if (detachedResult !== null) {
    return {
      attachedState: detachedResult.detachedState,
      sourceState: detachedResult.sourceState,
    };
  }

  if (state.tabs.length !== 1) {
    return null;
  }

  const tab = state.tabs[0];

  if (tab === undefined || tab.id !== tabId) {
    return null;
  }

  return {
    attachedState: {
      tabs: [tab],
      sessions: collectTabSessions(state, tab),
      activeTabId: tab.id,
      nextSessionNumber: state.nextSessionNumber,
      assistantStatus: createAttachAssistantStatus(1, nowMs),
    },
    sourceState: null,
  };
}
