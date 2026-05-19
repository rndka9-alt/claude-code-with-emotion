import fs from "node:fs";
import path from "node:path";
import type { AssistantVisualOverlayUpdate } from "../../shared/assistant-status";
import { isVisualEmotionPresetId } from "../../shared/visual-presets";
import { AssistantStatusStore } from "./assistant-status-store";

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
    } else if (
      typeof emotion === "string" &&
      isVisualEmotionPresetId(emotion)
    ) {
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
    let fileContents: string;
    try {
      fileContents = fs.readFileSync(this.overlayFilePath, "utf8").trim();
    } catch {
      // 세션 종료 등으로 파일이 이미 삭제된 경우 watch 이벤트가 뒤늦게 도착할 수 있음
      this.logEvent?.("overlay file missing, skipping read");
      return;
    }

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
