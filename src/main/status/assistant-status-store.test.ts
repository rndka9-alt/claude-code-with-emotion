import { AssistantStatusStore } from "./assistant-status-store";

describe("AssistantStatusStore", () => {
  it("stores non-expiring updates as the new base snapshot", () => {
    const store = new AssistantStatusStore(1_000);

    store.applyUpdate(
      {
        emotion: "sad",
        state: "working",
        line: "Building pane layout",
        currentTask: "Resizing panes",
      },
      "test",
    );

    expect(store.getSnapshot().state).toBe("working");
    expect(store.getSnapshot().emotion).toBe("sad");
    expect(store.getSnapshot().currentTask).toBe("Resizing panes");
    expect(store.getSnapshot().activityLabel).toBe("연결 대기 중");
  });

  it("lets a visual overlay emotion sit on top of the semantic base state", () => {
    const store = new AssistantStatusStore(3_000);

    store.applyUpdate(
      {
        state: "working",
        line: "Base state",
        currentTask: "Normal work",
      },
      "assistant-command",
    );
    store.applyVisualOverlay(
      {
        emotion: "happy",
      },
      "visual-overlay",
    );

    expect(store.getSnapshot().state).toBe("working");
    expect(store.getSnapshot().emotion).toBe("happy");
    expect(store.getSnapshot().source).toBe("visual-overlay");
    expect(store.getSnapshot().overlayLine).toBeNull();

    store.applyVisualOverlay(
      {
        emotion: null,
      },
      "visual-overlay",
    );

    expect(store.getSnapshot().emotion).toBeNull();
    expect(store.getSnapshot().line).toBe("Base state");
  });

  it("throttles rapid state emits and flushes the latest one on the trailing edge", async () => {
    vi.useFakeTimers();
    try {
      const store = new AssistantStatusStore(5_000);
      const emitted: string[] = [];
      store.subscribe((snapshot) => {
        emitted.push(snapshot.state);
      });

      store.applyUpdate({ state: "thinking", line: "A" }, "test");
      store.applyUpdate({ state: "working", line: "B" }, "test");
      store.applyUpdate({ state: "responding", line: "C" }, "test");

      // leading edge 만 바로 emit 대고 중간 갱신은 버퍼링
      expect(emitted).toEqual(["thinking"]);

      vi.advanceTimersByTime(AssistantStatusStore.STATE_THROTTLE_MS);

      // trailing edge 에서 마지막 상태만 emit
      expect(emitted).toEqual(["thinking", "responding"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the minimum gap after a trailing emit", () => {
    vi.useFakeTimers();
    try {
      const store = new AssistantStatusStore(7_000);
      const emitted: string[] = [];
      store.subscribe((snapshot) => {
        emitted.push(snapshot.state);
      });

      store.applyUpdate({ state: "thinking", line: "A" }, "test");
      store.applyUpdate({ state: "working", line: "B" }, "test");

      vi.advanceTimersByTime(AssistantStatusStore.STATE_THROTTLE_MS);

      // leading + trailing 까지 발사댐
      expect(emitted).toEqual(["thinking", "working"]);

      // trailing 직후 바로 들어온 변경은 leading 으로 즉시 터지면 안 댐
      vi.advanceTimersByTime(100);
      store.applyUpdate({ state: "responding", line: "C" }, "test");
      expect(emitted).toEqual(["thinking", "working"]);

      // 직전 emit 으로부터 STATE_THROTTLE_MS 가 채워질 때 발사대야 함
      vi.advanceTimersByTime(AssistantStatusStore.STATE_THROTTLE_MS - 100);
      expect(emitted).toEqual(["thinking", "working", "responding"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shares the throttle window between state and visual overlay emits", async () => {
    vi.useFakeTimers();
    try {
      const store = new AssistantStatusStore(6_000);
      const emitted: Array<{ state: string; emotion: string | null }> = [];
      store.subscribe((snapshot) => {
        emitted.push({ state: snapshot.state, emotion: snapshot.emotion });
      });

      store.applyUpdate({ state: "thinking", line: "A" }, "test");
      store.applyUpdate({ state: "working", line: "B" }, "test");
      store.applyVisualOverlay({ emotion: "happy" }, "overlay");

      // throttle 창이 열려있는 동안엔 leading emit 만 나가고 overlay 도 큐잉댐
      expect(emitted).toEqual([{ state: "thinking", emotion: null }]);

      vi.advanceTimersByTime(AssistantStatusStore.STATE_THROTTLE_MS);

      // trailing edge 에서 최신 state + emotion 을 한 번에 flush
      expect(emitted).toEqual([
        { state: "thinking", emotion: null },
        { state: "working", emotion: "happy" },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("lets a visual overlay line sit above the hook-driven activity label", () => {
    const store = new AssistantStatusStore(4_000);

    store.applyUpdate(
      {
        state: "thinking",
        line: "Base hook line",
        activityLabel: "자료를 찾는 중",
        currentTask: "Finding docs",
      },
      "assistant-command",
    );
    store.applyVisualOverlay(
      {
        line: "문제를 좀 더 파볼게요!",
      },
      "visual-overlay",
    );

    expect(store.getSnapshot().line).toBe("문제를 좀 더 파볼게요!");
    expect(store.getSnapshot().overlayLine).toBe("문제를 좀 더 파볼게요!");
    expect(store.getSnapshot().activityLabel).toBe("자료를 찾는 중");

    store.applyVisualOverlay(
      {
        line: null,
      },
      "visual-overlay",
    );

    expect(store.getSnapshot().line).toBe("Base hook line");
    expect(store.getSnapshot().overlayLine).toBeNull();
  });
});
