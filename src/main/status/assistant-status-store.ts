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
  // overlay 감정이 구독자한테 한 번도 안 나간 채로 state 훅에 지워지는 걸 막는 플래그.
  // PreToolUse → applyVisualOverlay → PostToolUse 가 같은 throttle 창에 몰릴 때,
  // 그 사이에 세팅된 감정은 trailing emit 에 실려나갈 자격을 한 번은 보장받아야 한다.
  private overlayEmotionPendingEmit = false;
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

    // 새 훅 상태 이벤트가 들어오면 이전 오버레이 감정은 유통기한이 끝난다.
    // 감정은 깜빡이는 신호, 상태는 흐르는 강이니 다음 state 가 오는 순간 오버레이 감정은
    // 자리를 비켜줘야 state 전용 에셋이 다시 나올 수 있다. delete 로 지워야
    // applyOverlay 의 `!== undefined` 체크가 "오버레이 없음" 으로 읽는다.
    //
    // 단, 감정이 아직 구독자한테 한 번도 안 나갓다면 (pending) 보호해야 한다.
    // MCP set_visual_overlay 호출이 PreToolUse·PostToolUse state 훅에 샌드위치처럼
    // 끼이는 구조라, 같은 throttle 창에 세팅된 감정을 여기서 지워버리면 trailing emit
    // 전에 증발해서 패널에 한 번도 못 뜬다.
    const overlayEmotionBefore = this.visualOverlay.emotion;
    const hadOverlayEmotion = overlayEmotionBefore !== undefined;
    const action = !hadOverlayEmotion
      ? "no-op"
      : this.overlayEmotionPendingEmit
        ? "protect"
        : "delete";
    if (!this.overlayEmotionPendingEmit) {
      delete this.visualOverlay.emotion;
    }
    this.logEvent?.(
      `applyUpdate state=${update.state} source=${source} overlayEmotionBefore=${overlayEmotionBefore ?? (hadOverlayEmotion ? "null" : "none")} pending=${this.overlayEmotionPendingEmit} action=${action}`,
    );

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
    this.logSupersededSnapshotIfPending(source);

    if (update.emotion !== undefined) {
      this.visualOverlay.emotion = update.emotion;
      // null 은 "오버레이 비우기" 라 보호할 이유가 없다. 실제 감정 키가 들어왓을 때만
      // pending 을 세워 다음 state 훅의 delete 로부터 이 한 번의 노출을 지켜준다.
      this.overlayEmotionPendingEmit = update.emotion !== null;
    }

    if (update.line !== undefined) {
      this.visualOverlay.line = update.line;
    }

    this.logEvent?.(
      `applyVisualOverlay source=${source} emotion=${update.emotion === undefined ? "untouched" : (update.emotion ?? "null")} line=${update.line === undefined ? "untouched" : JSON.stringify(update.line)} pending=${this.overlayEmotionPendingEmit}`,
    );

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
      `emit state=${snapshot.state} emotion=${snapshot.emotion ?? "null"} source=${snapshot.source} pendingWas=${this.overlayEmotionPendingEmit}`,
    );
    // 감정이 방금 구독자한테 나갓으니 더 보호할 필요 없다. 다음 state 훅은
    // 평소처럼 이 감정을 지워서 state 전용 에셋이 나올 차례를 돌려준다.
    this.overlayEmotionPendingEmit = false;
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

  private clearStateThrottleTimer(): void {
    if (this.stateThrottleTimer !== null) {
      clearTimeout(this.stateThrottleTimer);
      this.stateThrottleTimer = null;
    }
  }
}
