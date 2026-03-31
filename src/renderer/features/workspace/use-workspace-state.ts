import { useEffect, useReducer, useState } from 'react';
import {
  createInitialWorkspaceState,
  formatElapsedLabel,
  getActiveTab,
  workspaceReducer,
} from './model';

export interface WorkspaceViewModel {
  activeTabTitle: string;
  activeTaskElapsedLabel: string;
  appElapsedLabel: string;
  state: ReturnType<typeof createInitialWorkspaceState>;
  activateTab: (tabId: string) => void;
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

  const activeTab = getActiveTab(state);
  const activeTabTitle = activeTab !== null ? activeTab.title : 'No active session';
  const activeTaskElapsedLabel = formatElapsedLabel(
    nowMs - state.assistantStatus.statusSinceMs,
  );
  const appElapsedLabel = formatElapsedLabel(
    activeTab !== null ? nowMs - activeTab.createdAtMs : 0,
  );

  return {
    activeTabTitle,
    activeTaskElapsedLabel,
    appElapsedLabel,
    state,
    activateTab: (tabId: string) => {
      dispatch({ type: 'activateTab', tabId, nowMs: Date.now() });
    },
    createTab: () => {
      dispatch({ type: 'createTab', nowMs: Date.now() });
    },
    resizePane: (index: number, deltaRatio: number) => {
      dispatch({ type: 'resizePane', index, deltaRatio });
    },
  };
}
