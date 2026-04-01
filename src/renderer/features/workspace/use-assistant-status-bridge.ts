import { useEffect, useState } from 'react';
import type { AssistantStatusSnapshot } from '../../../shared/assistant-status';

export function useAssistantStatusBridge(
  fallbackSnapshot: AssistantStatusSnapshot,
): AssistantStatusSnapshot {
  const bridge = window.claudeApp?.assistantStatus;
  const [snapshot, setSnapshot] = useState<AssistantStatusSnapshot>(
    fallbackSnapshot,
  );

  useEffect(() => {
    if (bridge === undefined) {
      return;
    }

    let isDisposed = false;

    void bridge.getSnapshot().then((nextSnapshot) => {
      if (!isDisposed) {
        setSnapshot(nextSnapshot);
      }
    });

    const unsubscribe = bridge.onSnapshot((nextSnapshot) => {
      setSnapshot(nextSnapshot);
    });

    return () => {
      isDisposed = true;
      unsubscribe();
    };
  }, [bridge]);

  useEffect(() => {
    if (bridge === undefined) {
      setSnapshot((currentSnapshot) => {
        if (
          currentSnapshot.state === fallbackSnapshot.state &&
          currentSnapshot.line === fallbackSnapshot.line &&
          currentSnapshot.currentTask === fallbackSnapshot.currentTask &&
          currentSnapshot.updatedAtMs === fallbackSnapshot.updatedAtMs &&
          currentSnapshot.intensity === fallbackSnapshot.intensity &&
          currentSnapshot.source === fallbackSnapshot.source
        ) {
          return currentSnapshot;
        }

        return fallbackSnapshot;
      });
    }
  }, [
    bridge,
    fallbackSnapshot.currentTask,
    fallbackSnapshot.intensity,
    fallbackSnapshot.line,
    fallbackSnapshot.source,
    fallbackSnapshot.state,
    fallbackSnapshot.updatedAtMs,
  ]);

  return snapshot;
}
