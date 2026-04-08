import { useEffect, type Dispatch } from "react";
import type { WorkspaceAction } from "../model";

export function useWorkspaceTerminalExitSubscription(
  dispatch: Dispatch<WorkspaceAction>,
): void {
  useEffect(() => {
    const terminalsBridge = window.claudeApp?.terminals;

    if (terminalsBridge === undefined) {
      return;
    }

    return terminalsBridge.onExit((event) => {
      dispatch({
        type: "closeTab",
        tabId: event.sessionId,
        nowMs: Date.now(),
        reason: "exit",
      });
    });
  }, [dispatch]);
}
