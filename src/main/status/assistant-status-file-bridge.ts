import fs from 'node:fs';
import path from 'node:path';
import type {
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

function parseAssistantStatusUpdate(value: unknown): AssistantStatusUpdate | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const state = value.state;
  const line = value.line;
  const currentTask = value.currentTask;
  const durationMs = value.durationMs;
  const intensity = value.intensity;

  if (
    typeof state !== 'string' ||
    !isSemanticState(state) ||
    typeof line !== 'string'
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
    durationMs !== undefined &&
    typeof durationMs !== 'number'
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

  if (currentTask !== undefined) {
    update.currentTask = currentTask;
  }

  if (durationMs !== undefined) {
    update.durationMs = durationMs;
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
          `parsed update state=${update.state} line=${update.line} task=${update.currentTask ?? ''}`,
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
