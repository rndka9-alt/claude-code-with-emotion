import { act, renderHook } from "@testing-library/react";
import {
  createDefaultAssistantStatusSnapshot,
  type AssistantSemanticState,
  type AssistantStatusSnapshot,
} from "../../../../../shared/assistant-status";
import { useTabNotifications } from "./use-tab-notifications";

function installFakeAssistantStatusBridge(): {
  emit: (sessionId: string, state: AssistantSemanticState) => void;
  subscribedSessionIds: () => string[];
} {
  const listenersBySessionId = new Map<
    string,
    Set<(snapshot: AssistantStatusSnapshot) => void>
  >();

  Object.defineProperty(window, "claudeApp", {
    configurable: true,
    value: {
      assistantStatus: {
        getSnapshot: () =>
          Promise.resolve(createDefaultAssistantStatusSnapshot(0)),
        onSnapshot: (
          request: { sessionId: string },
          listener: (snapshot: AssistantStatusSnapshot) => void,
        ) => {
          const listeners =
            listenersBySessionId.get(request.sessionId) ?? new Set();

          listeners.add(listener);
          listenersBySessionId.set(request.sessionId, listeners);

          return () => {
            listeners.delete(listener);
          };
        },
      },
    },
  });

  return {
    emit: (sessionId, state) => {
      const snapshot: AssistantStatusSnapshot = {
        ...createDefaultAssistantStatusSnapshot(0),
        state,
      };

      for (const listener of listenersBySessionId.get(sessionId) ?? []) {
        listener(snapshot);
      }
    },
    subscribedSessionIds: () => [...listenersBySessionId.keys()],
  };
}

describe("useTabNotifications", () => {
  it("subscribes every session of every tab, not just the primary one", () => {
    const bridge = installFakeAssistantStatusBridge();
    const tabs = [
      { id: "tab-1", notificationSessionIds: ["session-1a", "session-1b"] },
      { id: "tab-2", notificationSessionIds: ["session-2a"] },
    ];

    renderHook(() => useTabNotifications(tabs, "tab-2"));

    expect(bridge.subscribedSessionIds()).toEqual([
      "session-1a",
      "session-1b",
      "session-2a",
    ]);
  });

  it("notifies an inactive tab when a secondary pane session needs attention", () => {
    const bridge = installFakeAssistantStatusBridge();
    const tabs = [
      { id: "tab-1", notificationSessionIds: ["session-1a", "session-1b"] },
      { id: "tab-2", notificationSessionIds: ["session-2a"] },
    ];
    const { result } = renderHook(() => useTabNotifications(tabs, "tab-2"));

    act(() => {
      bridge.emit("session-1b", "permission_wait");
    });

    expect(result.current.notifiedTabIds.has("tab-1")).toBe(true);
  });

  it("does not notify the active tab even when its session needs attention", () => {
    const bridge = installFakeAssistantStatusBridge();
    const tabs = [
      { id: "tab-1", notificationSessionIds: ["session-1a", "session-1b"] },
      { id: "tab-2", notificationSessionIds: ["session-2a"] },
    ];
    const { result } = renderHook(() => useTabNotifications(tabs, "tab-2"));

    act(() => {
      bridge.emit("session-2a", "error");
    });

    expect(result.current.notifiedTabIds.has("tab-2")).toBe(false);
  });

  it("clears the notification when dismissed", () => {
    const bridge = installFakeAssistantStatusBridge();
    const tabs = [
      { id: "tab-1", notificationSessionIds: ["session-1a", "session-1b"] },
      { id: "tab-2", notificationSessionIds: ["session-2a"] },
    ];
    const { result } = renderHook(() => useTabNotifications(tabs, "tab-2"));

    act(() => {
      bridge.emit("session-1a", "completed");
    });
    expect(result.current.notifiedTabIds.has("tab-1")).toBe(true);

    act(() => {
      result.current.dismissNotification("tab-1");
    });
    expect(result.current.notifiedTabIds.has("tab-1")).toBe(false);
  });
});
