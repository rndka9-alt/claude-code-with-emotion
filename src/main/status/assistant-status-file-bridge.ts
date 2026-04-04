import fs from 'node:fs';
import path from 'node:path';
import type {
  AssistantEmotionalState,
  AssistantSemanticState,
  AssistantStatusUpdate,
} from '../../shared/assistant-status';
import { AssistantStatusStore } from './assistant-status-store';

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSemanticState(value: string): value is AssistantSemanticState {
  return (
    value === 'disconnected' ||
    value === 'idle' ||
    value === 'thinking' ||
    value === 'working' ||
    value === 'responding' ||
    value === 'waiting' ||
    value === 'surprised' ||
    value === 'sad' ||
    value === 'happy' ||
    value === 'error'
  );
}

const EMOTIONAL_STATES: ReadonlySet<string> = new Set<AssistantEmotionalState>([
  'angry', 'annoyed', 'bored', 'confused', 'contemptuous',
  'crying', 'curious', 'dumbfounded', 'embarrassed', 'excited',
  'exhausted', 'happy', 'laughing', 'nervous', 'neutral',
  'proud', 'sad', 'scared', 'serious', 'shy',
  'smile', 'smirk', 'smug', 'surprised',
]);

function isEmotionalState(value: string): value is AssistantEmotionalState {
  return EMOTIONAL_STATES.has(value);
}

function parseAssistantStatusUpdate(value: unknown): AssistantStatusUpdate | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const state = value.state;
  const emotion = value.emotion;
  const line = value.line;
  const currentTask = value.currentTask;
  const activityLabel = value.activityLabel;
  const intensity = value.intensity;

  if (
    typeof state !== 'string' ||
    !isSemanticState(state) ||
    typeof line !== 'string'
  ) {
    return null;
  }

  if (
    emotion !== undefined &&
    (typeof emotion !== 'string' || !isEmotionalState(emotion))
  ) {
    return null;
  }

  if (
    currentTask !== undefined &&
    typeof currentTask !== 'string'
  ) {
    return null;
  }

  if (
    activityLabel !== undefined &&
    typeof activityLabel !== 'string'
  ) {
    return null;
  }

  if (
    intensity !== undefined &&
    intensity !== 'low' &&
    intensity !== 'medium' &&
    intensity !== 'high'
  ) {
    return null;
  }

  const update: AssistantStatusUpdate = {
    state,
    line,
  };

  if (emotion !== undefined && emotion !== 'neutral') {
    update.emotion = emotion;
  }

  if (currentTask !== undefined) {
    update.currentTask = currentTask;
  }

  if (activityLabel !== undefined) {
    update.activityLabel = activityLabel;
  }

  if (intensity !== undefined) {
    update.intensity = intensity;
  }

  return update;
}

export class AssistantStatusFileBridge {
  private watcher: fs.FSWatcher | null = null;
  private readTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly statusFilePath: string,
    private readonly statusStore: AssistantStatusStore,
    private readonly logEvent?: (message: string) => void,
  ) {}

  start(): void {
    fs.mkdirSync(path.dirname(this.statusFilePath), { recursive: true });

    if (!fs.existsSync(this.statusFilePath)) {
      fs.writeFileSync(this.statusFilePath, '', 'utf8');
    }

    this.logEvent?.(`watch start path=${this.statusFilePath}`);

    this.watcher = fs.watch(this.statusFilePath, () => {
      this.logEvent?.('watch event received');
      this.scheduleRead();
    });
  }

  stop(): void {
    if (this.readTimer !== null) {
      clearTimeout(this.readTimer);
      this.readTimer = null;
    }

    this.watcher?.close();
    this.watcher = null;
  }

  private scheduleRead(): void {
    if (this.readTimer !== null) {
      clearTimeout(this.readTimer);
    }

    this.readTimer = setTimeout(() => {
      this.readTimer = null;
      this.readStatusFile();
    }, 30);
  }

  private readStatusFile(): void {
    const fileContents = fs.readFileSync(this.statusFilePath, 'utf8').trim();

    if (fileContents.length === 0) {
      this.logEvent?.('read ignored empty payload');
      return;
    }

    this.logEvent?.(`read payload=${fileContents}`);

    try {
      const parsed: unknown = JSON.parse(fileContents);
      const update = parseAssistantStatusUpdate(parsed);

      if (update !== null) {
        this.logEvent?.(
          `parsed update state=${update.state} emotion=${update.emotion ?? 'none'} line=${update.line} activity=${update.activityLabel ?? ''} task=${update.currentTask ?? ''}`,
        );
        this.statusStore.applyUpdate(update, 'assistant-command');
      } else {
        this.logEvent?.('parsed payload but it did not match AssistantStatusUpdate');
      }
    } catch {
      this.logEvent?.('malformed assistant-status payload ignored');
    }
  }
}
