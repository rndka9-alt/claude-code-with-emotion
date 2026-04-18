import fs from "node:fs";
import path from "node:path";
import type {
  AssistantEmotionalState,
  AssistantStatusUpdate,
  AssistantVisualOverlayUpdate,
} from "../../shared/assistant-status";
import { AssistantStatusStore } from "./assistant-status-store";

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const SEMANTIC_STATES: ReadonlySet<string> = new Set([
  "disconnected",
  "thinking",
  "working",
  "waiting",
  "permission_wait",
  "tool_failed",
  "compacting",
  "completed",
  "error",
]);

const EMOTIONAL_STATES: ReadonlySet<string> = new Set<AssistantEmotionalState>([
  "angry",
  "annoyed",
  "bored",
  "confused",
  "contemptuous",
  "crying",
  "curious",
  "dumbfounded",
  "embarrassed",
  "excited",
  "exhausted",
  "happy",
  "laughing",
  "nervous",
  "neutral",
  "proud",
  "sad",
  "scared",
  "serious",
  "shy",
  "smile",
  "smirk",
  "smug",
  "surprised",
]);

function isEmotionalState(value: string): value is AssistantEmotionalState {
  return EMOTIONAL_STATES.has(value);
}

function parseStatusPayload(
  value: Record<string, unknown>,
): AssistantStatusUpdate | null {
  const { state, emotion, line, currentTask, activityLabel, intensity } = value;

  if (
    typeof state !== "string" ||
    !SEMANTIC_STATES.has(state) ||
    typeof line !== "string"
  ) {
    return null;
  }

  if (
    emotion !== undefined &&
    (typeof emotion !== "string" || !isEmotionalState(emotion))
  ) {
    return null;
  }

  if (currentTask !== undefined && typeof currentTask !== "string") {
    return null;
  }

  if (activityLabel !== undefined && typeof activityLabel !== "string") {
    return null;
  }

  if (
    intensity !== undefined &&
    intensity !== "low" &&
    intensity !== "medium" &&
    intensity !== "high"
  ) {
    return null;
  }

  const update: AssistantStatusUpdate = {
    state: state as AssistantStatusUpdate["state"],
    line,
  };

  if (emotion !== undefined && emotion !== "neutral") {
    update.emotion = emotion as AssistantEmotionalState;
  }

  if (currentTask !== undefined) {
    update.currentTask = currentTask;
  }

  if (activityLabel !== undefined) {
    update.activityLabel = activityLabel;
  }

  if (
    intensity === "low" ||
    intensity === "medium" ||
    intensity === "high"
  ) {
    update.intensity = intensity;
  }

  return update;
}

function parseOverlayPayload(
  value: Record<string, unknown>,
): AssistantVisualOverlayUpdate | null {
  const { emotion, line } = value;
  const update: AssistantVisualOverlayUpdate = {};

  if (emotion !== undefined) {
    if (emotion === null) {
      update.emotion = null;
    } else if (typeof emotion === "string" && isEmotionalState(emotion)) {
      update.emotion = emotion === "neutral" ? null : emotion;
    } else {
      return null;
    }
  }

  if (line !== undefined) {
    if (line === null) {
      update.line = null;
    } else if (typeof line === "string") {
      update.line = line;
    } else {
      return null;
    }
  }

  return update;
}

const POLL_INTERVAL_MS = 500;

export class AssistantEventQueueBridge {
  private watcher: fs.FSWatcher | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private processing = false;

  constructor(
    private readonly queueDir: string,
    private readonly statusStore: AssistantStatusStore,
    private readonly logEvent?: (message: string) => void,
  ) {}

  start(): void {
    fs.mkdirSync(this.queueDir, { recursive: true });

    this.logEvent?.(`queue watch start dir=${this.queueDir}`);

    this.watcher = fs.watch(this.queueDir, () => {
      this.drainQueue();
    });

    this.pollTimer = setInterval(() => {
      this.drainQueue();
    }, POLL_INTERVAL_MS);

    this.drainQueue();
  }

  stop(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    this.watcher?.close();
    this.watcher = null;
  }

  private drainQueue(): void {
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      this.processAvailableEvents();
    } finally {
      this.processing = false;
    }
  }

  private processAvailableEvents(): void {
    let entries: string[];

    try {
      entries = fs.readdirSync(this.queueDir);
    } catch {
      return;
    }

    const jsonFiles = entries
      .filter((name) => name.endsWith(".json"))
      .sort();

    if (jsonFiles.length === 0) {
      return;
    }

    for (const fileName of jsonFiles) {
      const filePath = path.join(this.queueDir, fileName);

      this.processEventFile(filePath, fileName);
    }
  }

  private processEventFile(filePath: string, fileName: string): void {
    let fileContents: string;

    try {
      fileContents = fs.readFileSync(filePath, "utf8").trim();
    } catch {
      this.logEvent?.(`read failed file=${fileName}`);
      return;
    }

    try {
      fs.unlinkSync(filePath);
    } catch {
      this.logEvent?.(`unlink failed file=${fileName}`);
      return;
    }

    if (fileContents.length === 0) {
      return;
    }

    try {
      const parsed: unknown = JSON.parse(fileContents);

      if (!isObjectRecord(parsed)) {
        this.logEvent?.(`malformed event file=${fileName}`);
        return;
      }

      const eventType = parsed.type;

      if (eventType === "status") {
        const update = parseStatusPayload(parsed);

        if (update !== null) {
          this.logEvent?.(
            `status event state=${update.state} emotion=${update.emotion ?? "none"} file=${fileName}`,
          );
          this.statusStore.applyUpdate(update, "assistant-command");
        } else {
          this.logEvent?.(
            `invalid status payload file=${fileName}`,
          );
        }
      } else if (eventType === "overlay") {
        const update = parseOverlayPayload(parsed);

        if (update !== null) {
          this.logEvent?.(
            `overlay event emotion=${update.emotion === undefined ? "untouched" : (update.emotion ?? "null")} line=${update.line === undefined ? "untouched" : JSON.stringify(update.line)} file=${fileName}`,
          );
          this.statusStore.applyVisualOverlay(
            update,
            "assistant-visual-overlay",
          );
        } else {
          this.logEvent?.(
            `invalid overlay payload file=${fileName}`,
          );
        }
      } else {
        this.logEvent?.(
          `unknown event type=${String(eventType)} file=${fileName}`,
        );
      }
    } catch {
      this.logEvent?.(`json parse failed file=${fileName}`);
    }
  }
}
