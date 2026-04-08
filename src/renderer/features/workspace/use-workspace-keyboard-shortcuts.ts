import { useEffect, type Dispatch } from "react";
import type { WorkspaceAction, WorkspaceState } from "./model";
import {
  getSessionNavigationDirection,
  shouldCreateSessionShortcut,
  shouldUseCloseSessionShortcut,
} from "./terminal";

export function useWorkspaceKeyboardShortcuts(
  state: WorkspaceState,
  dispatch: Dispatch<WorkspaceAction>,
): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (shouldCreateSessionShortcut(event)) {
        event.preventDefault();
        dispatch({ type: "createTab", nowMs: Date.now() });
        return;
      }

      const navigationDirection = getSessionNavigationDirection(event);

      if (navigationDirection !== null) {
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
          navigationDirection === "previous"
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

      if (state.tabs.length <= 1) {
        return;
      }

      event.preventDefault();
      const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId);

      if (activeTab === undefined) {
        return;
      }

      const terminalsBridge = window.claudeApp?.terminals;

      if (terminalsBridge !== undefined) {
        void terminalsBridge.closeSession({ sessionId: activeTab.id });
      }

      dispatch({
        type: "closeTab",
        tabId: activeTab.id,
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
