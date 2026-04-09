import { useEffect, useRef } from "react";
import { disposeTerminalSessionsExcept } from "../terminal-session-registry";

export function useTerminalSessionPruner(sessionIds: string[]): void {
  const previousSessionIdsRef = useRef<string[]>(sessionIds);

  useEffect(() => {
    const nextSessionIds = sessionIds;
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
  }, [sessionIds]);
}
