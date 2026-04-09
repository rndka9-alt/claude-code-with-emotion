import {
  createDefaultAssistantStatusSnapshot,
  type AssistantStatusSnapshot,
  type AssistantStatusUpdate,
  type AssistantVisualOverlayUpdate,
} from "../../shared/assistant-status";

type SnapshotListener = (snapshot: AssistantStatusSnapshot) => void;

export class AssistantStatusStore {
  static readonly STATE_THROTTLE_MS = 1_000;
  // 감정 에셋이 화면에 머무는 최소 보장 시간. TTL 동안은 state 변경이 와도 감정이
  // 살아남고, 만료대면 타이머가 알아서 정리해 state 전용 에셋이 복귀한다.
  static readonly EMOTION_TTL_MS = 3_000;

  private baseSnapshot: AssistantStatusSnapshot;
  private currentSnapshot: AssistantStatusSnapshot;
  private readonly listeners = new Set<SnapshotListener>();
  private stateThrottleTimer: NodeJS.Timeout | null = null;
  private lastEmitMs = Number.NEGATIVE_INFINITY;
  private visualOverlay: AssistantVisualOverlayUpdate = {};
  private emotionTtlTimer: NodeJS.Timeout | null = null;
  private readonly logEvent: ((message: string) => void) | undefined;

  constructor(
    nowMs: number = Date.now(),
    logEvent?: (message: string) => void,
  ) {
    const initialSnapshot = createDefaultAssistantStatusSnapshot(nowMs);
    this.baseSnapshot = initialSnapshot;
    this.currentSnapshot = initialSnapshot;
    this.logEvent = logEvent;
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
    this.logSupersededSnapshotIfPending(source);

    // 감정은 TTL 타이머가 전담 관리한다. state 훅은 감정을 건드리지 않는다.
    // TTL 안에 잇는 감정은 state 변경에 관계없이 살아남고,
    // TTL 이 만료대면 타이머가 알아서 정리해 state 전용 에셋이 복귀한다.
    this.logEvent?.(
      `applyUpdate state=${update.state} source=${source} overlayEmotion=${this.visualOverlay.emotion ?? "none"} emotionTtl=${this.emotionTtlTimer !== null ? "active" : "expired"}`,
    );

    const nextSnapshot = this.normalizeUpdate(update, source);

    this.baseSnapshot = nextSnapshot;
    this.currentSnapshot = this.applyOverlay(nextSnapshot, source);

    this.scheduleThrottledEmit();
  }

  applyVisualOverlay(
    update: AssistantVisualOverlayUpdate,
    source: string,
  ): void {
    this.logSupersededSnapshotIfPending(source);

    if (update.emotion !== undefined) {
      this.visualOverlay.emotion = update.emotion;
      this.clearEmotionTtlTimer();

      // 실제 감정 프리셋이 들어오면 TTL 타이머를 건다. TTL 동안 state 가 바뀌어도
      // 감정은 살아남아서 state+emotion 조합 에셋 또는 emotion 전용 에셋이 나온다.
      // null·neutral 은 "오버레이 비우기" 라 TTL 없이 즉시 반영한다.
      if (update.emotion !== null && update.emotion !== "neutral") {
        const ttlDelayMs =
          AssistantStatusStore.EMOTION_TTL_MS +
          this.getNextEmitDelayMs(Date.now());
        this.emotionTtlTimer = setTimeout(() => {
          this.emotionTtlTimer = null;
          this.expireEmotion();
        }, ttlDelayMs);
      }
    }

    if (update.line !== undefined) {
      this.visualOverlay.line = update.line;
    }

    this.logEvent?.(
      `applyVisualOverlay source=${source} emotion=${update.emotion === undefined ? "untouched" : (update.emotion ?? "null")} line=${update.line === undefined ? "untouched" : JSON.stringify(update.line)} ttl=${this.emotionTtlTimer !== null ? "active" : "none"}`,
    );

    this.currentSnapshot = this.applyOverlay(this.baseSnapshot, source);
    this.scheduleThrottledEmit();
  }

  dispose(): void {
    this.clearStateThrottleTimer();
    this.clearEmotionTtlTimer();
    this.listeners.clear();
  }

  private normalizeUpdate(
    update: AssistantStatusUpdate,
    source: string,
  ): AssistantStatusSnapshot {
    return {
      activityLabel: update.activityLabel ?? this.currentSnapshot.activityLabel,
      // currentSnapshot.emotion 은 오버레이까지 얹힌 값이라 폴백으로 쓰면 감정이 base 에
      // 스탬프처럼 복사대 영원히 남는다. base 는 훅이 직접 준 감정만 담고, 오버레이는
      // applyOverlay 에서만 얹어야 "다음 state 에서 감정 만료" 흐름이 성립한다.
      emotion: update.emotion ?? null,
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
    const snapshot = this.currentSnapshot;
    for (const listener of this.listeners) {
      listener(snapshot);
    }
    this.logEvent?.(
      `emit state=${snapshot.state} emotion=${snapshot.emotion ?? "null"} source=${snapshot.source} emotionTtl=${this.emotionTtlTimer !== null ? "active" : "expired"}`,
    );
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

  private getNextEmitDelayMs(nowMs: number): number {
    const sinceLastEmit = nowMs - this.lastEmitMs;

    if (sinceLastEmit >= AssistantStatusStore.STATE_THROTTLE_MS) {
      return 0;
    }

    return AssistantStatusStore.STATE_THROTTLE_MS - sinceLastEmit;
  }

  private logSupersededSnapshotIfPending(nextSource: string): void {
    // pending timer 가 있는데 새 update 가 들어오면, 아직 emit 되지 못한 currentSnapshot 은
    // 곧 덮어쓰여서 구독자에게 한 번도 안 나간 채 사라진다. 그 "증발한 프레임" 이 무엇이엇는지
    // 로그로 남겨야 왜 특정 감정 에셋이 화면에 안 떳는지 추적할 수 있다.
    if (this.stateThrottleTimer === null || this.logEvent === undefined) {
      return;
    }

    const snapshot = this.currentSnapshot;
    this.logEvent(
      `throttle skip pending state=${snapshot.state} emotion=${snapshot.emotion ?? "none"} line=${JSON.stringify(snapshot.line)} source=${snapshot.source} superseded-by=${nextSource}`,
    );
  }

  private expireEmotion(): void {
    delete this.visualOverlay.emotion;
    this.logEvent?.("expireEmotion ttl-expired");
    this.currentSnapshot = this.applyOverlay(
      this.baseSnapshot,
      "emotion-ttl-expire",
    );
    this.scheduleThrottledEmit();
  }

  private clearStateThrottleTimer(): void {
    if (this.stateThrottleTimer !== null) {
      clearTimeout(this.stateThrottleTimer);
      this.stateThrottleTimer = null;
    }
  }

  private clearEmotionTtlTimer(): void {
    if (this.emotionTtlTimer !== null) {
      clearTimeout(this.emotionTtlTimer);
      this.emotionTtlTimer = null;
    }
  }
}
