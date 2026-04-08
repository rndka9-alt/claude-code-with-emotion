import { useEffect, useRef, useState } from "react";
import type { AssistantSemanticState } from "../../../../shared/assistant-status";

/**
 * 비활성 탭에서 "유저가 봐야 할" 상태로 전환되면 알림을 띄운다.
 * 탭을 활성화하거나 명시적으로 dismiss 하면 알림이 사라진다.
 */

const ATTENTION_STATES: ReadonlySet<AssistantSemanticState> = new Set([
  "waiting",
  "permission_wait",
  "completed",
  "error",
  "interrupted",
  "tool_failed",
]);

export interface TabNotifications {
  notifiedTabIds: ReadonlySet<string>;
  dismissNotification: (tabId: string) => void;
}

export function useTabNotifications(
  tabs: ReadonlyArray<{ id: string }>,
  activeTabId: string,
): TabNotifications {
  const [notifiedTabIds, setNotifiedTabIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  // 탭 활성화 시 해당 탭 알림 자동 제거
  useEffect(() => {
    setNotifiedTabIds((current) => {
      if (!current.has(activeTabId)) return current;
      const next = new Set(current);
      next.delete(activeTabId);
      return next;
    });
  }, [activeTabId]);

  // 모든 탭의 assistant status 구독
  useEffect(() => {
    const bridge = window.claudeApp?.assistantStatus;
    if (bridge === undefined) return;

    const unsubscribers = tabs.map((tab) =>
      bridge.onSnapshot({ sessionId: tab.id }, (snapshot) => {
        if (tab.id === activeTabIdRef.current) return;

        if (ATTENTION_STATES.has(snapshot.state)) {
          setNotifiedTabIds((current) => {
            if (current.has(tab.id)) return current;
            const next = new Set(current);
            next.add(tab.id);
            return next;
          });
        }
      }),
    );

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }, [tabs]);

  // 닫힌 탭의 stale 알림 정리
  useEffect(() => {
    const tabIdSet = new Set(tabs.map((tab) => tab.id));

    setNotifiedTabIds((current) => {
      let hasStale = false;

      for (const id of current) {
        if (!tabIdSet.has(id)) {
          hasStale = true;
          break;
        }
      }

      if (!hasStale) return current;

      const next = new Set<string>();

      for (const id of current) {
        if (tabIdSet.has(id)) next.add(id);
      }

      return next;
    });
  }, [tabs]);

  return {
    notifiedTabIds,
    dismissNotification: (tabId: string) => {
      setNotifiedTabIds((current) => {
        if (!current.has(tabId)) return current;
        const next = new Set(current);
        next.delete(tabId);
        return next;
      });
    },
  };
}
