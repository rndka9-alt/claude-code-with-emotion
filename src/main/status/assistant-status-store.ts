import {
  createDefaultAssistantStatusSnapshot,
  type AssistantStatusSnapshot,
  type AssistantStatusUpdate,
  type AssistantVisualOverlayUpdate,
} from "../../shared/assistant-status";

type SnapshotListener = (snapshot: AssistantStatusSnapshot) => void;

export class AssistantStatusStore {
  static readonly STATE_THROTTLE_MS = 1_000;

  private baseSnapshot: AssistantStatusSnapshot;
  private currentSnapshot: AssistantStatusSnapshot;
  private readonly listeners = new Set<SnapshotListener>();
  private stateThrottleTimer: NodeJS.Timeout | null = null;
  private lastEmitMs = Number.NEGATIVE_INFINITY;
  private visualOverlay: AssistantVisualOverlayUpdate = {};

  constructor(nowMs: number = Date.now()) {
    const initialSnapshot = createDefaultAssistantStatusSnapshot(nowMs);
    this.baseSnapshot = initialSnapshot;
    this.currentSnapshot = initialSnapshot;
  }

  getSnapshot(): AssistantStatusSnapshot {
    return this.currentSnapshot;
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  applyUpdate(update: AssistantStatusUpdate, source: string): void {
    const nextSnapshot = this.normalizeUpdate(update, source);

    this.baseSnapshot = nextSnapshot;
    this.currentSnapshot = this.applyOverlay(nextSnapshot, source);

    // 상태 변경이 너무 빠르게 반복대면 패널 라벨이 휙휙 바뀌어 읽기 힘들어서
    // emit 간 간격을 STATE_THROTTLE_MS 이상으로 강제한다. state·emotion 이
    // 같은 창을 공유하니 창 안에 들어온 갱신들은 모두 currentSnapshot 에
    // 누적댓다가 예약된 trailing emit 때 최신 상태로 한 번에 나간다.
    this.scheduleThrottledEmit();
  }

  applyVisualOverlay(
    update: AssistantVisualOverlayUpdate,
    source: string,
  ): void {
    if (update.emotion !== undefined) {
      this.visualOverlay.emotion = update.emotion;
    }

    if (update.line !== undefined) {
      this.visualOverlay.line = update.line;
    }

    this.currentSnapshot = this.applyOverlay(this.baseSnapshot, source);
    // emotion 이벤트도 state 와 같은 throttle 창을 공유해야, state<->emotion 이
    // 번갈아 들어올 때 한쪽으로 throttle 이 뚫려 패널이 휙휙 바뀌는 걸 막는다.
    this.scheduleThrottledEmit();
  }

  dispose(): void {
    this.clearStateThrottleTimer();
    this.listeners.clear();
  }

  private normalizeUpdate(
    update: AssistantStatusUpdate,
    source: string,
  ): AssistantStatusSnapshot {
    return {
      activityLabel: update.activityLabel ?? this.currentSnapshot.activityLabel,
      emotion: update.emotion ?? this.currentSnapshot.emotion,
      overlayLine: this.currentSnapshot.overlayLine,
      state: update.state,
      line: update.line,
      currentTask: update.currentTask ?? this.currentSnapshot.currentTask,
      updatedAtMs: Date.now(),
      intensity: update.intensity ?? "medium",
      source,
    };
  }

  private applyOverlay(
    snapshot: AssistantStatusSnapshot,
    source: string,
  ): AssistantStatusSnapshot {
    const nextOverlayLine =
      this.visualOverlay.line !== undefined
        ? this.visualOverlay.line
        : snapshot.overlayLine;

    return {
      ...snapshot,
      emotion:
        this.visualOverlay.emotion !== undefined
          ? this.visualOverlay.emotion
          : snapshot.emotion,
      overlayLine: nextOverlayLine ?? null,
      line:
        nextOverlayLine !== undefined && nextOverlayLine !== null
          ? nextOverlayLine
          : snapshot.line,
      updatedAtMs: Date.now(),
      source,
    };
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.currentSnapshot);
    }
  }

  private scheduleThrottledEmit(): void {
    // 연이은 emit 사이 간격을 항상 STATE_THROTTLE_MS 이상으로 보장한다.
    // 이전 구현은 trailing emit 직후 타이머를 풀어버려서, 바로 뒤에 들어온
    // 변경이 leading edge 로 즉시 터지며 1초 간격이 무너지는 문제가 잇엇다.
    if (this.stateThrottleTimer !== null) {
      // 이미 trailing emit 이 예약대잇다. 변경은 currentSnapshot 에 반영댓으니
      // 예약된 timer 가 깨어날 때 최신 값을 알아서 실어간다.
      return;
    }

    const now = Date.now();
    const sinceLastEmit = now - this.lastEmitMs;

    if (sinceLastEmit >= AssistantStatusStore.STATE_THROTTLE_MS) {
      this.emit();
      this.lastEmitMs = now;
      return;
    }

    const delay = AssistantStatusStore.STATE_THROTTLE_MS - sinceLastEmit;
    this.stateThrottleTimer = setTimeout(() => {
      this.stateThrottleTimer = null;
      this.emit();
      this.lastEmitMs = Date.now();
    }, delay);
  }

  private clearStateThrottleTimer(): void {
    if (this.stateThrottleTimer !== null) {
      clearTimeout(this.stateThrottleTimer);
      this.stateThrottleTimer = null;
    }
  }
}
