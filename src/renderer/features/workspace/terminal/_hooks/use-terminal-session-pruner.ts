import { useEffect, useRef } from "react";
import type { SessionTab } from "../../model";
import { disposeTerminalSessionsExcept } from "../terminal-session-registry";

export function useTerminalSessionPruner(tabs: SessionTab[]): void {
  const previousSessionIdsRef = useRef<string[]>(tabs.map((tab) => tab.id));

  useEffect(() => {
    const nextSessionIds = tabs.map((tab) => tab.id);
    const previousSessionIds = previousSessionIdsRef.current;

    if (
      previousSessionIds.length === nextSessionIds.length &&
      previousSessionIds.every(
        (sessionId, index) => sessionId === nextSessionIds[index],
      )
    ) {
      return;
    }

    disposeTerminalSessionsExcept(nextSessionIds);
    previousSessionIdsRef.current = nextSessionIds;
  }, [tabs]);
}
