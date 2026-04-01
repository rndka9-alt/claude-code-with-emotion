import { useEffect, useReducer, useState } from 'react';
import {
  createInitialWorkspaceState,
  formatElapsedLabel,
  getActiveTab,
  workspaceReducer,
} from './model';

export interface WorkspaceViewModel {
  appElapsedLabel: string;
  state: ReturnType<typeof createInitialWorkspaceState>;
  activateTab: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  createTab: () => void;
  resizePane: (index: number, deltaRatio: number) => void;
}

export function useWorkspaceState(): WorkspaceViewModel {
  const [state, dispatch] = useReducer(
    workspaceReducer,
    Date.now(),
    createInitialWorkspaceState,
  );
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

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

  const activeTab = getActiveTab(state);
  const appElapsedLabel = formatElapsedLabel(
    activeTab !== null ? nowMs - activeTab.createdAtMs : 0,
  );

  return {
    appElapsedLabel,
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
    resizePane: (index: number, deltaRatio: number) => {
      dispatch({ type: 'resizePane', index, deltaRatio });
    },
  };
}
