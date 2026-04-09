import { act, render, screen } from "@testing-library/react";
import type { AssistantStatusSnapshot } from "../../../../shared/assistant-status";
import { createDefaultAssistantStatusSnapshot } from "../../../../shared/assistant-status";
import { useAssistantStatusStream } from "./use-assistant-status-stream";

function createSnapshot(
  updatedAtMs: number,
  overrides: Partial<AssistantStatusSnapshot> = {},
): AssistantStatusSnapshot {
  return {
    ...createDefaultAssistantStatusSnapshot(updatedAtMs),
    currentTask: `Task @ ${updatedAtMs}`,
    line: `Line @ ${updatedAtMs}`,
    updatedAtMs,
    ...overrides,
  };
}

async function flushSnapshotTasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

function TestHarness(props: {
  fallbackSnapshot: AssistantStatusSnapshot;
  focusedSessionId: string | null;
  sessionIds: string[];
}) {
  const { activeSnapshot } = useAssistantStatusStream(
    props.sessionIds,
    props.focusedSessionId,
    props.fallbackSnapshot,
  );

  return <div role="status">{activeSnapshot.currentTask}</div>;
}

describe("useAssistantStatusStream", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps background session snapshots warm for instant focus switches", async () => {
    const listeners = new Map<string, (snapshot: AssistantStatusSnapshot) => void>();
    const baseSnapshots: Record<string, AssistantStatusSnapshot> = {
      "session-1": createSnapshot(10, { currentTask: "Focus one" }),
      "session-2": createSnapshot(20, { currentTask: "Focus two" }),
    };

    Object.defineProperty(window, "claudeApp", {
      configurable: true,
      value: {
        assistantStatus: {
          getSnapshot: vi.fn(({ sessionId }) =>
            Promise.resolve(baseSnapshots[sessionId]),
          ),
          onSnapshot: vi.fn(({ sessionId }, listener) => {
            listeners.set(sessionId, listener);
            return () => {
              listeners.delete(sessionId);
            };
          }),
        },
      },
    });

    const { rerender } = render(
      <TestHarness
        fallbackSnapshot={createSnapshot(5, { currentTask: "fallback" })}
        focusedSessionId="session-1"
        sessionIds={["session-1", "session-2"]}
      />,
    );

    await flushSnapshotTasks();

    expect(screen.getByRole("status")).toHaveTextContent("Focus one");

    act(() => {
      listeners.get("session-2")?.(
        createSnapshot(30, {
          currentTask: "Background session warmed",
        }),
      );
      vi.advanceTimersByTime(96);
    });

    rerender(
      <TestHarness
        fallbackSnapshot={createSnapshot(5, { currentTask: "fallback" })}
        focusedSessionId="session-2"
        sessionIds={["session-1", "session-2"]}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Background session warmed",
    );
  });

  it("applies trailing throttle to live snapshot updates", async () => {
    const listeners = new Map<string, (snapshot: AssistantStatusSnapshot) => void>();

    Object.defineProperty(window, "claudeApp", {
      configurable: true,
      value: {
        assistantStatus: {
          getSnapshot: vi.fn(({ sessionId }) =>
            Promise.resolve(
              createSnapshot(10, { currentTask: `${sessionId} initial` }),
            ),
          ),
          onSnapshot: vi.fn(({ sessionId }, listener) => {
            listeners.set(sessionId, listener);
            return () => {
              listeners.delete(sessionId);
            };
          }),
        },
      },
    });

    render(
      <TestHarness
        fallbackSnapshot={createSnapshot(5, { currentTask: "fallback" })}
        focusedSessionId="session-1"
        sessionIds={["session-1"]}
      />,
    );

    await flushSnapshotTasks();

    expect(screen.getByRole("status")).toHaveTextContent("session-1 initial");

    act(() => {
      listeners.get("session-1")?.(
        createSnapshot(20, { currentTask: "first burst" }),
      );
      listeners.get("session-1")?.(
        createSnapshot(21, { currentTask: "second burst" }),
      );
      vi.advanceTimersByTime(95);
    });

    expect(screen.getByRole("status")).toHaveTextContent("session-1 initial");

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.getByRole("status")).toHaveTextContent("second burst");
  });

  it("does not let an older disconnected app snapshot overwrite a newer pending fallback", async () => {
    Object.defineProperty(window, "claudeApp", {
      configurable: true,
      value: {
        assistantStatus: {
          getSnapshot: vi.fn(() =>
            Promise.resolve(
              createSnapshot(10, {
                source: "app",
                state: "disconnected",
                currentTask: "old disconnected",
              }),
            ),
          ),
          onSnapshot: vi.fn(() => () => {}),
        },
      },
    });

    render(
      <TestHarness
        fallbackSnapshot={createSnapshot(20, {
          source: "workspace-launch-pending",
          state: "working",
          currentTask: "launch pending",
        })}
        focusedSessionId="session-1"
        sessionIds={["session-1"]}
      />,
    );

    await flushSnapshotTasks();

    expect(screen.getByRole("status")).toHaveTextContent("launch pending");
  });
});
