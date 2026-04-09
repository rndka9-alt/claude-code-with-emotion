import { useReducer } from "react";
import { createInitialWorkspaceState, workspaceReducer } from "../model";
import {
  useTerminalSessionPruner,
  useWorkspaceTerminalExitSubscription,
} from "../terminal";
import { useWorkspaceKeyboardShortcuts } from "./use-workspace-keyboard-shortcuts";

export interface WorkspaceViewModel {
  state: ReturnType<typeof createInitialWorkspaceState>;
  activateTab: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  createTab: () => void;
  createSessionInTab: (tabId: string) => void;
  focusSession: (tabId: string, sessionId: string) => void;
  reorderTab: (tabId: string, destinationIndex: number) => void;
  resizePane: (index: number, deltaRatio: number) => void;
  renameTab: (tabId: string, title: string) => void;
  syncSessionTitle: (sessionId: string, title: string) => void;
}

export function useWorkspaceState(): WorkspaceViewModel {
  const [state, dispatch] = useReducer(
    workspaceReducer,
    Date.now(),
    createInitialWorkspaceState,
  );
  useWorkspaceTerminalExitSubscription(dispatch);
  useWorkspaceKeyboardShortcuts(state, dispatch);
  useTerminalSessionPruner(state.tabs.flatMap((tab) => tab.sessionIds));

  return {
    state,
    activateTab: (tabId: string) => {
      dispatch({ type: "activateTab", tabId, nowMs: Date.now() });
    },
    closeTab: (tabId: string) => {
      const tab = state.tabs.find((candidateTab) => candidateTab.id === tabId);

      if (tab === undefined) {
        return;
      }

      const terminalsBridge = window.claudeApp?.terminals;

      if (terminalsBridge !== undefined) {
        void terminalsBridge.closeSession({
          sessionId: tab.focusedSessionId,
        });
      }

      dispatch({
        type: "closeFocusedSession",
        tabId,
        nowMs: Date.now(),
        reason: "manual",
      });
    },
    createTab: () => {
      dispatch({ type: "createTab", nowMs: Date.now() });
    },
    createSessionInTab: (tabId: string) => {
      dispatch({
        type: "createSessionInTab",
        tabId,
        nowMs: Date.now(),
      });
    },
    focusSession: (tabId: string, sessionId: string) => {
      dispatch({
        type: "focusSession",
        tabId,
        sessionId,
      });
    },
    reorderTab: (tabId: string, destinationIndex: number) => {
      dispatch({
        type: "reorderTab",
        tabId,
        destinationIndex,
        nowMs: Date.now(),
      });
    },
    resizePane: (index: number, deltaRatio: number) => {
      dispatch({ type: "resizePane", index, deltaRatio });
    },
    renameTab: (tabId, title) => {
      dispatch({
        type: "renameTab",
        tabId,
        title,
        nowMs: Date.now(),
      });
    },
    syncSessionTitle: (sessionId, title) => {
      dispatch({
        type: "syncSessionTitle",
        sessionId,
        title,
        nowMs: Date.now(),
      });
    },
  };
}
