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

  it("keeps overlay emotion alive across state changes while TTL is active", () => {
    vi.useFakeTimers();
    try {
      const store = new AssistantStatusStore(2_000);

      store.applyUpdate(
        { state: "working", line: "Base" },
        "assistant-command",
      );
      store.applyVisualOverlay({ emotion: "happy" }, "visual-overlay");

      expect(store.getSnapshot().emotion).toBe("happy");

      // TTL 안에서 state 가 바뀌어도 감정은 살아남는다
      vi.advanceTimersByTime(AssistantStatusStore.STATE_THROTTLE_MS);

      store.applyUpdate(
        { state: "waiting", line: "Next" },
        "assistant-command",
      );

      expect(store.getSnapshot().state).toBe("waiting");
      expect(store.getSnapshot().emotion).toBe("happy");
    } finally {
      vi.useRealTimers();
    }
  });

  it("auto-clears emotion after TTL expires", () => {
    vi.useFakeTimers();
    try {
      const store = new AssistantStatusStore(2_000);
      const emitted: Array<{ state: string; emotion: string | null }> = [];
      store.subscribe((snapshot) => {
        emitted.push({ state: snapshot.state, emotion: snapshot.emotion });
      });

      store.applyUpdate(
        { state: "working", line: "Base" },
        "assistant-command",
      );
      store.applyVisualOverlay({ emotion: "happy" }, "visual-overlay");

      // leading emit (working) + overlay 는 throttle 창 안에서 큐잉
      expect(emitted).toEqual([{ state: "working", emotion: null }]);

      vi.advanceTimersByTime(AssistantStatusStore.STATE_THROTTLE_MS);

      // trailing emit 에서 감정 포함 상태가 나감
      expect(emitted).toEqual([
        { state: "working", emotion: null },
        { state: "working", emotion: "happy" },
      ]);

      // TTL 만료 시점까지 나머지 시간을 전진
      vi.advanceTimersByTime(
        AssistantStatusStore.EMOTION_TTL_MS -
          AssistantStatusStore.STATE_THROTTLE_MS,
      );

      // TTL 만료 → 감정 자동 클리어, state 전용 에셋 복귀
      // TTL 타이머가 scheduleThrottledEmit 을 타므로 throttle 간격 뒤에 나감
      vi.advanceTimersByTime(AssistantStatusStore.STATE_THROTTLE_MS);

      const last = emitted[emitted.length - 1];
      expect(last?.emotion).toBeNull();
      expect(last?.state).toBe("working");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps an overlay emotion visible for the full TTL after the throttled emit lands", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      const store = new AssistantStatusStore(2_500);
      const emitted: Array<{ atMs: number; emotion: string | null }> = [];
      store.subscribe((snapshot) => {
        emitted.push({ atMs: Date.now(), emotion: snapshot.emotion });
      });

      // T=0 에 base state 가 먼저 emit 되고, 직후 emotion overlay 가 들어와도
      // 실제 화면 반영은 trailing emit(T=1000) 에 일어난다.
      store.applyUpdate(
        { state: "working", line: "Base" },
        "assistant-command",
      );
      store.applyVisualOverlay({ emotion: "happy" }, "visual-overlay");

      expect(emitted).toEqual([{ atMs: 0, emotion: null }]);

      vi.advanceTimersByTime(AssistantStatusStore.STATE_THROTTLE_MS);

      expect(emitted).toEqual([
        { atMs: 0, emotion: null },
        {
          atMs: AssistantStatusStore.STATE_THROTTLE_MS,
          emotion: "happy",
        },
      ]);

      // visible 후 3초가 아직 안 찼으니 사라지면 안 됨
      vi.advanceTimersByTime(AssistantStatusStore.EMOTION_TTL_MS - 1);
      expect(emitted[emitted.length - 1]).toEqual({
        atMs: AssistantStatusStore.STATE_THROTTLE_MS,
        emotion: "happy",
      });

      vi.advanceTimersByTime(1);

      expect(emitted[emitted.length - 1]).toEqual({
        atMs:
          AssistantStatusStore.STATE_THROTTLE_MS +
          AssistantStatusStore.EMOTION_TTL_MS,
        emotion: null,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves emotion across multiple state changes within TTL window", () => {
    vi.useFakeTimers();
    try {
      const store = new AssistantStatusStore(9_000);
      const emitted: Array<{ state: string; emotion: string | null }> = [];
      store.subscribe((snapshot) => {
        emitted.push({ state: snapshot.state, emotion: snapshot.emotion });
      });

      // T=0: leading emit [working, null], overlay curious 세팅 (TTL 3초, T=3000에 만료)
      store.applyUpdate(
        { state: "working", line: "tool start" },
        "assistant-command",
      );
      store.applyVisualOverlay({ emotion: "curious" }, "visual-overlay");
      store.applyUpdate(
        { state: "thinking", line: "back to thinking" },
        "assistant-command",
      );

      expect(emitted).toEqual([{ state: "working", emotion: null }]);

      // T=1000: trailing edge — 감정이 TTL 안이라 살아남음
      vi.advanceTimersByTime(AssistantStatusStore.STATE_THROTTLE_MS);

      expect(emitted).toEqual([
        { state: "working", emotion: null },
        { state: "thinking", emotion: "curious" },
      ]);

      // T=2000: 또 다른 state 변경 — TTL 아직 안 끝남 (3000 > 2000)
      vi.advanceTimersByTime(AssistantStatusStore.STATE_THROTTLE_MS);
      store.applyUpdate(
        { state: "waiting", line: "done" },
        "assistant-command",
      );

      // T=2000 시점에서 sinceLastEmit=1000>=1000 이라 즉시 emit, 감정 살아잇음
      expect(emitted[emitted.length - 1]).toEqual({
        state: "waiting",
        emotion: "curious",
      });

      // T=3000+: TTL 만료 → 감정 자동 클리어
      vi.advanceTimersByTime(AssistantStatusStore.EMOTION_TTL_MS);
      vi.advanceTimersByTime(AssistantStatusStore.STATE_THROTTLE_MS);

      const last = emitted[emitted.length - 1];
      expect(last?.emotion).toBeNull();
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

  it("resets TTL when a new emotion replaces an existing one", () => {
    vi.useFakeTimers();
    try {
      const store = new AssistantStatusStore(2_000);

      store.applyUpdate(
        { state: "working", line: "Base" },
        "assistant-command",
      );
      store.applyVisualOverlay({ emotion: "happy" }, "visual-overlay");

      // TTL 의 절반 시점에서 새 감정으로 교체
      vi.advanceTimersByTime(AssistantStatusStore.EMOTION_TTL_MS / 2);
      store.applyVisualOverlay({ emotion: "excited" }, "visual-overlay");

      expect(store.getSnapshot().emotion).toBe("excited");

      // 원래 TTL 이 만료댓을 시점에도 새 감정은 살아잇어야 함
      vi.advanceTimersByTime(AssistantStatusStore.EMOTION_TTL_MS / 2);
      expect(store.getSnapshot().emotion).toBe("excited");

      // 새 TTL 이 만료대면 비로소 사라짐
      vi.advanceTimersByTime(AssistantStatusStore.EMOTION_TTL_MS / 2);
      // 만료 후 emit 이 throttle 타므로 한 틱 더
      vi.advanceTimersByTime(AssistantStatusStore.STATE_THROTTLE_MS);

      expect(store.getSnapshot().emotion).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears emotion immediately when neutral is set (no TTL)", () => {
    const store = new AssistantStatusStore(2_000);

    store.applyUpdate(
      { state: "working", line: "Base" },
      "assistant-command",
    );
    store.applyVisualOverlay({ emotion: "happy" }, "visual-overlay");

    expect(store.getSnapshot().emotion).toBe("happy");

    store.applyVisualOverlay({ emotion: "neutral" }, "visual-overlay");

    // neutral 은 TTL 없이 즉시 반영
    expect(store.getSnapshot().emotion).toBe("neutral");
  });
});
