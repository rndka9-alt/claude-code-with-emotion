import {
  createDefaultAssistantStatusSnapshot,
  type AssistantStatusSnapshot,
  type AssistantStatusUpdate,
  type AssistantVisualOverlayUpdate,
} from '../../shared/assistant-status';

type SnapshotListener = (snapshot: AssistantStatusSnapshot) => void;

export class AssistantStatusStore {
  static readonly STATE_THROTTLE_MS = 700;

  private baseSnapshot: AssistantStatusSnapshot;
  private currentSnapshot: AssistantStatusSnapshot;
  private readonly listeners = new Set<SnapshotListener>();
  private revertTimer: NodeJS.Timeout | null = null;
  private stateThrottleTimer: NodeJS.Timeout | null = null;
  private hasPendingStateEmit = false;
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

    if (typeof update.durationMs === 'number' && update.durationMs > 0) {
      this.currentSnapshot = this.applyOverlay(nextSnapshot, source);
      this.emit();
      this.clearRevertTimer();
      this.revertTimer = setTimeout(() => {
        this.currentSnapshot = this.applyOverlay(
          {
            ...this.baseSnapshot,
            updatedAtMs: Date.now(),
          },
          source,
        );
        this.emit();
        this.revertTimer = null;
      }, update.durationMs);

      return;
    }

    this.clearRevertTimer();
    this.baseSnapshot = nextSnapshot;
    this.currentSnapshot = this.applyOverlay(nextSnapshot, source);

    // 상태 변경이 너무 빠르게 반복대면 패널 라벨이 휙휙 바뀌어 읽기 힘들어서
    // 0.7s leading+trailing throttle 을 건다. baseSnapshot 은 계속 갱신하니까
    // throttle 창 안에 감정(visualOverlay) 이벤트가 오면 그쪽 emit 이 최신 상태를
    // 자연스럽게 실어 내보내준다.
    if (this.stateThrottleTimer === null) {
      this.emit();
      this.hasPendingStateEmit = false;
      this.stateThrottleTimer = setTimeout(() => {
        this.stateThrottleTimer = null;
        if (this.hasPendingStateEmit) {
          this.hasPendingStateEmit = false;
          this.emit();
        }
      }, AssistantStatusStore.STATE_THROTTLE_MS);
    } else {
      this.hasPendingStateEmit = true;
    }
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
    this.emit();
    // 감정 이벤트가 최신 baseSnapshot 을 이미 실어 내보냈으니 trailing emit 취소
    this.hasPendingStateEmit = false;
  }

  dispose(): void {
    this.clearRevertTimer();
    this.clearStateThrottleTimer();
    this.listeners.clear();
  }

  private normalizeUpdate(
    update: AssistantStatusUpdate,
    source: string,
  ): AssistantStatusSnapshot {
    return {
      activityLabel:
        update.activityLabel ?? this.currentSnapshot.activityLabel,
      emotion: update.emotion ?? this.currentSnapshot.emotion,
      overlayLine: this.currentSnapshot.overlayLine,
      state: update.state,
      line: update.line,
      currentTask:
        update.currentTask ?? this.currentSnapshot.currentTask,
      updatedAtMs: Date.now(),
      intensity: update.intensity ?? 'medium',
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

  private clearRevertTimer(): void {
    if (this.revertTimer !== null) {
      clearTimeout(this.revertTimer);
      this.revertTimer = null;
    }
  }

  private clearStateThrottleTimer(): void {
    if (this.stateThrottleTimer !== null) {
      clearTimeout(this.stateThrottleTimer);
      this.stateThrottleTimer = null;
    }
    this.hasPendingStateEmit = false;
  }
}
