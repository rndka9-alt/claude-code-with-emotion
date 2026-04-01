import { useEffect, useReducer } from 'react';
import { createInitialWorkspaceState, workspaceReducer } from './model';
import {
  shouldCreateSessionShortcut,
  shouldUseCloseSessionShortcut,
} from './terminal-keyboard';

export interface WorkspaceViewModel {
  state: ReturnType<typeof createInitialWorkspaceState>;
  activateTab: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  createTab: () => void;
  reorderTab: (tabId: string, targetTabId: string) => void;
  resizePane: (index: number, deltaRatio: number) => void;
}

export function useWorkspaceState(): WorkspaceViewModel {
  const [state, dispatch] = useReducer(
    workspaceReducer,
    Date.now(),
    createInitialWorkspaceState,
  );

  useEffect(() => {
    const terminalsBridge = window.claudeApp?.terminals;

    if (terminalsBridge === undefined) {
      return;
    }

    return terminalsBridge.onExit((event) => {
      dispatch({
        type: 'closeTab',
        tabId: event.sessionId,
        nowMs: Date.now(),
        reason: 'exit',
      });
    });
  }, []);

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
  }, [state.activeTabId, state.tabs]);

  return {
    state,
    activateTab: (tabId: string) => {
      dispatch({ type: 'activateTab', tabId, nowMs: Date.now() });
    },
    closeTab: (tabId: string) => {
      const terminalsBridge = window.claudeApp?.terminals;

      if (terminalsBridge !== undefined) {
        void terminalsBridge.closeSession({ sessionId: tabId });
      }

      dispatch({ type: 'closeTab', tabId, nowMs: Date.now(), reason: 'manual' });
    },
    createTab: () => {
      dispatch({ type: 'createTab', nowMs: Date.now() });
    },
    reorderTab: (tabId: string, targetTabId: string) => {
      dispatch({ type: 'reorderTab', tabId, targetTabId, nowMs: Date.now() });
    },
    resizePane: (index: number, deltaRatio: number) => {
      dispatch({ type: 'resizePane', index, deltaRatio });
    },
  };
}
