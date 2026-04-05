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

  it("expires the overlay emotion after trailing emit delivers it and the next hook state arrives", () => {
    vi.useFakeTimers();
    try {
      const store = new AssistantStatusStore(2_000);

      store.applyUpdate(
        { state: "working", line: "Base" },
        "assistant-command",
      );
      store.applyVisualOverlay({ emotion: "happy" }, "visual-overlay");

      expect(store.getSnapshot().emotion).toBe("happy");

      // 감정 overlay 는 trailing emit 으로 구독자에게 한 번 전달댄 뒤에야 만료대야 한다.
      // 그래야 MCP overlay 호출이 PreToolUse·PostToolUse 훅 사이에 끼여도 감정이
      // 최소 한 번은 패널에 뜨고, 그 뒤 state 전용 에셋이 나올 자리를 내준다.
      vi.advanceTimersByTime(AssistantStatusStore.STATE_THROTTLE_MS);

      store.applyUpdate(
        { state: "waiting", line: "Next" },
        "assistant-command",
      );

      expect(store.getSnapshot().state).toBe("waiting");
      expect(store.getSnapshot().emotion).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves an overlay emotion set between state updates within the same throttle window", () => {
    vi.useFakeTimers();
    try {
      const store = new AssistantStatusStore(9_000);
      const emitted: Array<{ state: string; emotion: string | null }> = [];
      store.subscribe((snapshot) => {
        emitted.push({ state: snapshot.state, emotion: snapshot.emotion });
      });

      // MCP set_visual_overlay 호출 시나리오: PreToolUse → applyVisualOverlay → PostToolUse 가
      // 같은 throttle 창에 몰리면, 예전엔 감정이 trailing emit 전에 증발해서 패널에 한 번도 못
      // 떳엇다. pending 플래그가 그 창 안의 감정을 지켜주는지 검증한다.
      store.applyUpdate(
        { state: "working", line: "tool start" },
        "assistant-command",
      );
      store.applyVisualOverlay({ emotion: "curious" }, "visual-overlay");
      store.applyUpdate(
        { state: "thinking", line: "back to thinking" },
        "assistant-command",
      );

      // 창 여는 leading emit 만 나가고 감정은 아직 보류
      expect(emitted).toEqual([{ state: "working", emotion: null }]);

      vi.advanceTimersByTime(AssistantStatusStore.STATE_THROTTLE_MS);

      // trailing edge 에서 마지막 state + 창 안에서 세팅된 감정이 한 쌍으로 나간다
      expect(emitted).toEqual([
        { state: "working", emotion: null },
        { state: "thinking", emotion: "curious" },
      ]);

      // 한 번 노출댄 뒤엔 다음 state 훅에서 정상적으로 만료댄다
      vi.advanceTimersByTime(AssistantStatusStore.STATE_THROTTLE_MS);
      store.applyUpdate(
        { state: "waiting", line: "done" },
        "assistant-command",
      );

      expect(emitted).toEqual([
        { state: "working", emotion: null },
        { state: "thinking", emotion: "curious" },
        { state: "waiting", emotion: null },
      ]);
    } finally {
      vi.useRealTimers();
    }
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
      store.applyUpdate({ state: "waiting", line: "C" }, "test");

      // leading edge 만 바로 emit 대고 중간 갱신은 버퍼링
      expect(emitted).toEqual(["thinking"]);

      vi.advanceTimersByTime(AssistantStatusStore.STATE_THROTTLE_MS);

      // trailing edge 에서 마지막 상태만 emit
      expect(emitted).toEqual(["thinking", "waiting"]);
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
      store.applyUpdate({ state: "waiting", line: "C" }, "test");
      expect(emitted).toEqual(["thinking", "working"]);

      // 직전 emit 으로부터 STATE_THROTTLE_MS 가 채워질 때 발사대야 함
      vi.advanceTimersByTime(AssistantStatusStore.STATE_THROTTLE_MS - 100);
      expect(emitted).toEqual(["thinking", "working", "waiting"]);
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
