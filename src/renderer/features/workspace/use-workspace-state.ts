import { useReducer } from 'react';
import { createInitialWorkspaceState, workspaceReducer } from './model';
import { useWorkspaceKeyboardShortcuts } from './use-workspace-keyboard-shortcuts';
import { useWorkspaceTerminalExitSubscription } from './use-workspace-terminal-exit-subscription';

export interface WorkspaceViewModel {
  state: ReturnType<typeof createInitialWorkspaceState>;
  activateTab: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  createTab: () => void;
  reorderTab: (tabId: string, destinationIndex: number) => void;
  resizePane: (index: number, deltaRatio: number) => void;
  updateTabTitle: (
    tabId: string,
    title: string,
    source: 'manual' | 'terminal',
  ) => void;
}

export function useWorkspaceState(): WorkspaceViewModel {
  const [state, dispatch] = useReducer(
    workspaceReducer,
    Date.now(),
    createInitialWorkspaceState,
  );
  useWorkspaceTerminalExitSubscription(dispatch);
  useWorkspaceKeyboardShortcuts(state, dispatch);

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
    reorderTab: (tabId: string, destinationIndex: number) => {
      dispatch({ type: 'reorderTab', tabId, destinationIndex, nowMs: Date.now() });
    },
    resizePane: (index: number, deltaRatio: number) => {
      dispatch({ type: 'resizePane', index, deltaRatio });
    },
    updateTabTitle: (tabId, title, source) => {
      dispatch({ type: 'updateTabTitle', tabId, title, nowMs: Date.now(), source });
    },
  };
}
