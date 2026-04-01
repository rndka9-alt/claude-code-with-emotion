import {
  createDefaultAssistantStatusSnapshot,
  type AssistantStatusSnapshot,
  type AssistantStatusUpdate,
  type AssistantVisualOverlayUpdate,
} from '../../shared/assistant-status';

type SnapshotListener = (snapshot: AssistantStatusSnapshot) => void;

export class AssistantStatusStore {
  private baseSnapshot: AssistantStatusSnapshot;
  private currentSnapshot: AssistantStatusSnapshot;
  private readonly listeners = new Set<SnapshotListener>();
  private revertTimer: NodeJS.Timeout | null = null;
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
    this.emit();
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
  }

  dispose(): void {
    this.clearRevertTimer();
    this.listeners.clear();
  }

  private normalizeUpdate(
    update: AssistantStatusUpdate,
    source: string,
  ): AssistantStatusSnapshot {
    return {
      emotion: update.emotion ?? this.currentSnapshot.emotion,
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
    return {
      ...snapshot,
      emotion:
        this.visualOverlay.emotion !== undefined
          ? this.visualOverlay.emotion
          : snapshot.emotion,
      line:
        this.visualOverlay.line !== undefined
          ? this.visualOverlay.line ?? snapshot.line
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
}
