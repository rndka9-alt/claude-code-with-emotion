import { useEffect, useRef, useState } from "react";
import type { AssistantStatusSnapshot } from "../../../../shared/assistant-status";

const STATUS_STREAM_THROTTLE_MS = 96;

function areSnapshotsEqual(
  left: AssistantStatusSnapshot,
  right: AssistantStatusSnapshot,
): boolean {
  return (
    left.activityLabel === right.activityLabel &&
    left.currentTask === right.currentTask &&
    left.emotion === right.emotion &&
    left.intensity === right.intensity &&
    left.line === right.line &&
    left.overlayLine === right.overlayLine &&
    left.source === right.source &&
    left.state === right.state &&
    left.updatedAtMs === right.updatedAtMs
  );
}

export interface AssistantStatusStreamResult {
  activeSnapshot: AssistantStatusSnapshot;
  snapshotsBySessionId: Readonly<Record<string, AssistantStatusSnapshot>>;
}

export function useAssistantStatusStream(
  sessionIds: string[],
  focusedSessionId: string | null,
  fallbackSnapshot: AssistantStatusSnapshot,
): AssistantStatusStreamResult {
  const bridge = window.claudeApp?.assistantStatus;
  const [snapshotsBySessionId, setSnapshotsBySessionId] = useState<
    Record<string, AssistantStatusSnapshot>
  >(() => {
    if (focusedSessionId === null) {
      return {};
    }

    return {
      [focusedSessionId]: fallbackSnapshot,
    };
  });
  const trailingSnapshotRef = useRef<Map<string, AssistantStatusSnapshot>>(
    new Map(),
  );
  const throttleTimerIdsRef = useRef<Map<string, number>>(new Map());
  const sessionIdsKey = sessionIds.join("\0");

  useEffect(() => {
    if (focusedSessionId === null) {
      return;
    }

    setSnapshotsBySessionId((current) => {
      const existingSnapshot = current[focusedSessionId];

      if (
        existingSnapshot !== undefined &&
        existingSnapshot.updatedAtMs > fallbackSnapshot.updatedAtMs
      ) {
        return current;
      }

      if (
        existingSnapshot !== undefined &&
        areSnapshotsEqual(existingSnapshot, fallbackSnapshot)
      ) {
        return current;
      }

      return {
        ...current,
        [focusedSessionId]: fallbackSnapshot,
      };
    });
  }, [fallbackSnapshot, focusedSessionId]);

  useEffect(() => {
    const activeSessionIdSet = new Set(sessionIds);

    setSnapshotsBySessionId((current) => {
      let didChange = false;
      const nextSnapshots: Record<string, AssistantStatusSnapshot> = {};

      for (const [sessionId, snapshot] of Object.entries(current)) {
        if (!activeSessionIdSet.has(sessionId)) {
          didChange = true;
          continue;
        }

        nextSnapshots[sessionId] = snapshot;
      }

      return didChange ? nextSnapshots : current;
    });

    for (const [sessionId, timerId] of throttleTimerIdsRef.current.entries()) {
      if (activeSessionIdSet.has(sessionId)) {
        continue;
      }

      window.clearTimeout(timerId);
      throttleTimerIdsRef.current.delete(sessionId);
      trailingSnapshotRef.current.delete(sessionId);
    }
  }, [sessionIdsKey]);

  useEffect(() => {
    if (bridge === undefined || sessionIds.length === 0) {
      return;
    }

    let isDisposed = false;

    function commitSnapshot(
      sessionId: string,
      snapshot: AssistantStatusSnapshot,
    ): void {
      setSnapshotsBySessionId((current) => {
        const existingSnapshot = current[sessionId];

        if (
          existingSnapshot !== undefined &&
          areSnapshotsEqual(existingSnapshot, snapshot)
        ) {
          return current;
        }

        return {
          ...current,
          [sessionId]: snapshot,
        };
      });
    }

    function scheduleSnapshot(
      sessionId: string,
      snapshot: AssistantStatusSnapshot,
    ): void {
      trailingSnapshotRef.current.set(sessionId, snapshot);

      if (throttleTimerIdsRef.current.has(sessionId)) {
        return;
      }

      const timerId = window.setTimeout(() => {
        throttleTimerIdsRef.current.delete(sessionId);
        const nextSnapshot = trailingSnapshotRef.current.get(sessionId);

        if (nextSnapshot !== undefined) {
          trailingSnapshotRef.current.delete(sessionId);
          commitSnapshot(sessionId, nextSnapshot);
        }
      }, STATUS_STREAM_THROTTLE_MS);

      throttleTimerIdsRef.current.set(sessionId, timerId);
    }

    const unsubscribers = sessionIds.map((sessionId) => {
      void bridge.getSnapshot({ sessionId }).then((snapshot) => {
        if (isDisposed) {
          return;
        }

        commitSnapshot(sessionId, snapshot);
      });

      return bridge.onSnapshot({ sessionId }, (snapshot) => {
        scheduleSnapshot(sessionId, snapshot);
      });
    });

    return () => {
      isDisposed = true;

      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }, [bridge, sessionIdsKey]);

  useEffect(() => {
    return () => {
      for (const timerId of throttleTimerIdsRef.current.values()) {
        window.clearTimeout(timerId);
      }

      throttleTimerIdsRef.current.clear();
      trailingSnapshotRef.current.clear();
    };
  }, []);

  return {
    activeSnapshot:
      (focusedSessionId !== null
        ? snapshotsBySessionId[focusedSessionId]
        : undefined) ?? fallbackSnapshot,
    snapshotsBySessionId,
  };
}
