import { useEffect, useReducer, useRef } from "react";
import {
  attachWorkspaceState,
  createInitialWorkspaceState,
  detachWorkspaceTab,
  getAllSessionIds,
  getTabSessionIds,
  prepareWorkspaceTabAttach,
  type PaneSplitDirection,
  type WorkspaceState,
  workspaceReducer,
} from "../model";
import type { WorkspaceWindowScreenPoint } from "../../../../shared/workspace-window-bridge";
import {
  useTerminalSessionPruner,
  useWorkspaceTerminalExitSubscription,
} from "../terminal";
import { useWorkspaceKeyboardShortcuts } from "./use-workspace-keyboard-shortcuts";

export interface WorkspaceViewModel {
  state: WorkspaceState;
  activateTab: (tabId: string) => void;
  closePane: (tabId: string, paneId: string, sessionId: string) => void;
  closeTab: (tabId: string) => void;
  createTab: () => void;
  detachTab: (
    tabId: string,
    screenPoint?: WorkspaceWindowScreenPoint,
  ) => Promise<boolean>;
  focusPane: (tabId: string, paneId: string) => void;
  reorderTab: (tabId: string, destinationIndex: number) => void;
  renameTab: (tabId: string, title: string) => void;
  resizeSplit: (splitId: string, deltaRatio: number) => void;
  splitPane: (tabId: string, direction: PaneSplitDirection) => void;
  syncSessionTitle: (sessionId: string, title: string) => void;
}

function resolveInitialWorkspaceState(nowMs: number): WorkspaceState {
  return (
    window.claudeApp?.initialWorkspaceState ??
    createInitialWorkspaceState(nowMs)
  );
}

export function useWorkspaceState(): WorkspaceViewModel {
  const [state, dispatch] = useReducer(
    workspaceReducer,
    Date.now(),
    resolveInitialWorkspaceState,
  );
  const stateRef = useRef(state);

  stateRef.current = state;
  useWorkspaceTerminalExitSubscription(dispatch);
  useWorkspaceKeyboardShortcuts(state, dispatch);
  useTerminalSessionPruner(getAllSessionIds(state));

  // 다른 창에서 넘어온 탭 묶음을 현재 workspace state에 병합하는 렌더러 수신 지점.
  useEffect(() => {
    const workspaceWindowsBridge = window.claudeApp?.workspaceWindows;

    if (workspaceWindowsBridge === undefined) {
      return;
    }

    return workspaceWindowsBridge.onAttachWorkspaceState((request) => {
      dispatch({
        type: "replaceState",
        state: attachWorkspaceState(
          stateRef.current,
          request.attachedWorkspaceState,
          Date.now(),
        ),
      });
    });
  }, []);

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
    detachTab: async (
      tabId: string,
      screenPoint?: WorkspaceWindowScreenPoint,
    ) => {
      const nowMs = Date.now();
      const currentState = stateRef.current;
      const workspaceWindowsBridge = window.claudeApp?.workspaceWindows;

      if (workspaceWindowsBridge === undefined) {
        throw new Error("Workspace window bridge is unavailable.");
      }

      if (screenPoint !== undefined) {
        const attachResult = prepareWorkspaceTabAttach(
          currentState,
          tabId,
          nowMs,
        );

        if (attachResult !== null) {
          const didAttach =
            await workspaceWindowsBridge.attachWorkspaceStateToWindowAtPoint({
              attachedWorkspaceState: attachResult.attachedState,
              screenPoint,
            });

          if (didAttach) {
            if (attachResult.sourceState === null) {
              await workspaceWindowsBridge.closeCurrentWorkspaceWindow();
            } else {
              dispatch({
                type: "replaceState",
                state: attachResult.sourceState,
              });
            }

            return true;
          }
        }
      }

      const result = detachWorkspaceTab(currentState, tabId, nowMs);

      if (result === null) {
        return false;
      }

      await workspaceWindowsBridge.openDetachedWorkspaceWindow({
        initialWorkspaceState: result.detachedState,
      });
      dispatch({ type: "replaceState", state: result.sourceState });

      return true;
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
