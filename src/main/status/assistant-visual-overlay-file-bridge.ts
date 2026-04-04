import fs from "node:fs";
import path from "node:path";
import type {
  AssistantEmotionalState,
  AssistantVisualOverlayUpdate,
} from "../../shared/assistant-status";
import { AssistantStatusStore } from "./assistant-status-store";

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

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

function parseAssistantVisualOverlayUpdate(
  value: unknown,
): AssistantVisualOverlayUpdate | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const emotion = value.emotion;
  const line = value.line;
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

export class AssistantVisualOverlayFileBridge {
  private watcher: fs.FSWatcher | null = null;
  private readTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly overlayFilePath: string,
    private readonly statusStore: AssistantStatusStore,
    private readonly logEvent?: (message: string) => void,
  ) {}

  start(): void {
    fs.mkdirSync(path.dirname(this.overlayFilePath), { recursive: true });

    if (!fs.existsSync(this.overlayFilePath)) {
      fs.writeFileSync(this.overlayFilePath, "", "utf8");
    }

    this.logEvent?.(`watch start path=${this.overlayFilePath}`);

    this.watcher = fs.watch(this.overlayFilePath, () => {
      this.logEvent?.("watch event received");
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
      this.readOverlayFile();
    }, 30);
  }

  private readOverlayFile(): void {
    const fileContents = fs.readFileSync(this.overlayFilePath, "utf8").trim();

    if (fileContents.length === 0) {
      this.logEvent?.("read ignored empty payload");
      return;
    }

    this.logEvent?.(`read payload=${fileContents}`);

    try {
      const parsed: unknown = JSON.parse(fileContents);
      const update = parseAssistantVisualOverlayUpdate(parsed);

      if (update !== null) {
        this.logEvent?.(
          `parsed overlay emotion=${update.emotion ?? "none"} line=${update.line ?? ""}`,
        );
        this.statusStore.applyVisualOverlay(update, "assistant-visual-overlay");
      } else {
        this.logEvent?.(
          "parsed payload but it did not match AssistantVisualOverlayUpdate",
        );
      }
    } catch {
      this.logEvent?.("malformed assistant-visual-overlay payload ignored");
    }
  }
}
