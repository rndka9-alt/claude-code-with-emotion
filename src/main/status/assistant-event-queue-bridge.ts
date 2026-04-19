import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type {
  AssistantStatusUpdate,
  AssistantVisualOverlayUpdate,
} from "../../shared/assistant-status";
import { AssistantStatusStore } from "./assistant-status-store";

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const emotionalStateSchema = z.enum([
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

const statusPayloadSchema = z
  .object({
    state: z.enum([
      "disconnected",
      "thinking",
      "working",
      "waiting",
      "permission_wait",
      "tool_failed",
      "compacting",
      "completed",
      "error",
    ]),
    line: z.string(),
    emotion: emotionalStateSchema.optional(),
    currentTask: z.string().optional(),
    activityLabel: z.string().optional(),
    intensity: z.enum(["low", "medium", "high"]).optional(),
  })
  .transform((parsed): AssistantStatusUpdate => {
    const update: AssistantStatusUpdate = {
      state: parsed.state,
      line: parsed.line,
    };
    if (parsed.emotion !== undefined && parsed.emotion !== "neutral") {
      update.emotion = parsed.emotion;
    }
    if (parsed.currentTask !== undefined) {
      update.currentTask = parsed.currentTask;
    }
    if (parsed.activityLabel !== undefined) {
      update.activityLabel = parsed.activityLabel;
    }
    if (parsed.intensity !== undefined) {
      update.intensity = parsed.intensity;
    }
    return update;
  });

const overlayPayloadSchema = z
  .object({
    emotion: emotionalStateSchema.nullable().optional(),
    line: z.string().nullable().optional(),
  })
  .transform((parsed): AssistantVisualOverlayUpdate => {
    const update: AssistantVisualOverlayUpdate = {};
    if (parsed.emotion !== undefined) {
      update.emotion =
        parsed.emotion === null || parsed.emotion === "neutral"
          ? null
          : parsed.emotion;
    }
    if (parsed.line !== undefined) {
      update.line = parsed.line;
    }
    return update;
  });

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
        const result = statusPayloadSchema.safeParse(parsed);

        if (result.success) {
          this.logEvent?.(
            `status event state=${result.data.state} emotion=${result.data.emotion ?? "none"} file=${fileName}`,
          );
          this.statusStore.applyUpdate(result.data, "assistant-command");
        } else {
          this.logEvent?.(
            `invalid status payload file=${fileName}`,
          );
        }
      } else if (eventType === "overlay") {
        const result = overlayPayloadSchema.safeParse(parsed);

        if (result.success) {
          this.logEvent?.(
            `overlay event emotion=${result.data.emotion === undefined ? "untouched" : (result.data.emotion ?? "null")} line=${result.data.line === undefined ? "untouched" : JSON.stringify(result.data.line)} file=${fileName}`,
          );
          this.statusStore.applyVisualOverlay(
            result.data,
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
