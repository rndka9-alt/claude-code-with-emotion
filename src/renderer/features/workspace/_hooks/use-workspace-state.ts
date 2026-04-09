import { useReducer } from "react";
import {
  createInitialWorkspaceState,
  getAllSessionIds,
  getTabSessionIds,
  type PaneSplitDirection,
  workspaceReducer,
} from "../model";
import {
  useTerminalSessionPruner,
  useWorkspaceTerminalExitSubscription,
} from "../terminal";
import { useWorkspaceKeyboardShortcuts } from "./use-workspace-keyboard-shortcuts";

export interface WorkspaceViewModel {
  state: ReturnType<typeof createInitialWorkspaceState>;
  activateTab: (tabId: string) => void;
  closePane: (tabId: string, paneId: string, sessionId: string) => void;
  closeTab: (tabId: string) => void;
  createTab: () => void;
  focusPane: (tabId: string, paneId: string) => void;
  reorderTab: (tabId: string, destinationIndex: number) => void;
  renameTab: (tabId: string, title: string) => void;
  resizeSplit: (splitId: string, deltaRatio: number) => void;
  splitPane: (tabId: string, direction: PaneSplitDirection) => void;
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
  useTerminalSessionPruner(getAllSessionIds(state));

  return {
    state,
    activateTab: (tabId: string) => {
      dispatch({ type: "activateTab", tabId, nowMs: Date.now() });
    },
    closePane: (tabId, paneId, sessionId) => {
      const terminalsBridge = window.claudeApp?.terminals;

      if (terminalsBridge !== undefined) {
        void terminalsBridge.closeSession({ sessionId });
      }

      dispatch({
        type: "closePane",
        tabId,
        paneId,
        nowMs: Date.now(),
        reason: "manual",
      });
    },
    closeTab: (tabId: string) => {
      const tab = state.tabs.find((candidateTab) => candidateTab.id === tabId);

      if (tab === undefined) {
        return;
      }

      const terminalsBridge = window.claudeApp?.terminals;

      if (terminalsBridge !== undefined) {
        for (const sessionId of getTabSessionIds(tab)) {
          void terminalsBridge.closeSession({ sessionId });
        }
      }

      dispatch({
        type: "closeTab",
        tabId,
        nowMs: Date.now(),
      });
    },
    createTab: () => {
      dispatch({ type: "createTab", nowMs: Date.now() });
    },
    focusPane: (tabId: string, paneId: string) => {
      dispatch({
        type: "focusPane",
        tabId,
        paneId,
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
    renameTab: (tabId, title) => {
      dispatch({
        type: "renameTab",
        tabId,
        title,
        nowMs: Date.now(),
      });
    },
    resizeSplit: (splitId, deltaRatio) => {
      dispatch({ type: "resizeSplit", splitId, deltaRatio });
    },
    splitPane: (tabId, direction) => {
      dispatch({
        type: "splitPane",
        tabId,
        direction,
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
