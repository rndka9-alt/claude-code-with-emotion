import { useEffect, type Dispatch } from 'react';
import type { WorkspaceAction, WorkspaceState } from './model';
import {
  shouldCreateSessionShortcut,
  shouldUseCloseSessionShortcut,
} from './terminal-keyboard';

export function useWorkspaceKeyboardShortcuts(
  state: WorkspaceState,
  dispatch: Dispatch<WorkspaceAction>,
): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (shouldCreateSessionShortcut(event)) {
        event.preventDefault();
        dispatch({ type: 'createTab', nowMs: Date.now() });
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
        type: 'closeTab',
        tabId: activeTab.id,
        nowMs: Date.now(),
        reason: 'manual',
      });
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [dispatch, state.activeTabId, state.tabs]);
}
