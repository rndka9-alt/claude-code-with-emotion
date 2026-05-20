import { useEffect, type Dispatch } from "react";
import {
  getTabSessionIds,
  type WorkspaceAction,
  type WorkspaceState,
} from "../model";
import {
  getPaneNavigationDirection,
  getSplitPaneDirection,
  getTabNavigationDirection,
  shouldCreateTabShortcut,
  shouldUseCloseSessionShortcut,
} from "../terminal";

function wouldCloseLastSession(
  state: WorkspaceState,
  closingSessionId: string,
): boolean {
  const remainingSessionIds = state.tabs.flatMap((tab) =>
    getTabSessionIds(tab).filter((sessionId) => sessionId !== closingSessionId),
  );

  return remainingSessionIds.length === 0;
}

export function useWorkspaceKeyboardShortcuts(
  state: WorkspaceState,
  dispatch: Dispatch<WorkspaceAction>,
): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (shouldCreateTabShortcut(event)) {
        event.preventDefault();
        dispatch({ type: "createTab", nowMs: Date.now() });
        return;
      }

      const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId);

      if (activeTab === undefined) {
        return;
      }

      const splitDirection = getSplitPaneDirection(event);

      if (splitDirection !== null) {
        event.preventDefault();
        dispatch({
          type: "splitPane",
          tabId: activeTab.id,
          direction: splitDirection,
          nowMs: Date.now(),
        });
        return;
      }

      const paneNavigationDirection = getPaneNavigationDirection(event);

      if (paneNavigationDirection !== null) {
        event.preventDefault();
        dispatch({
          type: "moveFocus",
          tabId: activeTab.id,
          direction: paneNavigationDirection,
        });
        return;
      }

      const tabNavigationDirection = getTabNavigationDirection(event);

      if (tabNavigationDirection !== null) {
        if (state.tabs.length <= 1) {
          return;
        }

        const activeTabIndex = state.tabs.findIndex(
          (tab) => tab.id === state.activeTabId,
        );

        if (activeTabIndex < 0) {
          return;
        }

        event.preventDefault();
        const nextTabIndex =
          tabNavigationDirection === "previous"
            ? (activeTabIndex - 1 + state.tabs.length) % state.tabs.length
            : (activeTabIndex + 1) % state.tabs.length;
        const nextTab = state.tabs[nextTabIndex];

        if (nextTab === undefined) {
          return;
        }

        dispatch({
          type: "activateTab",
          tabId: nextTab.id,
          nowMs: Date.now(),
        });
        return;
      }

      if (!shouldUseCloseSessionShortcut(event)) {
        return;
      }

      event.preventDefault();
      const terminalsBridge = window.claudeApp?.terminals;
      const workspaceWindowsBridge = window.claudeApp?.workspaceWindows;

      if (
        workspaceWindowsBridge !== undefined &&
        wouldCloseLastSession(state, activeTab.focusedSessionId)
      ) {
        if (terminalsBridge !== undefined) {
          void terminalsBridge.closeSession({
            sessionId: activeTab.focusedSessionId,
          });
        }

        void workspaceWindowsBridge.closeCurrentWorkspaceWindow();
        return;
      }

      if (terminalsBridge !== undefined) {
        void terminalsBridge.closeSession({
          sessionId: activeTab.focusedSessionId,
        });
      }

      dispatch({
        type: "closePane",
        tabId: activeTab.id,
        paneId: activeTab.focusedPaneId,
        nowMs: Date.now(),
        reason: "manual",
      });
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dispatch, state.activeTabId, state.tabs]);
}
