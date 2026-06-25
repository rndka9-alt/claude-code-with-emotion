import fs from "node:fs";
import { ENV_KEYS } from "../shared/env-keys";
import { collectAvailableVisualOptions } from "../shared/visual-assets";
import { writeQueueEvent } from "./lib/event-queue-writer";

// status 큐 이벤트의 페이로드. flag(--task → currentTask 등)로 들어오거나
// JSON 한 덩어리로 들어온다.
interface StatusArgs {
  activityLabel?: string;
  assistantProviderId?: string;
  currentTask?: string;
  emotion?: string;
  intensity?: string;
  line?: string;
  state?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function appendTrace(message: string): void {
  const traceFilePath = process.env[ENV_KEYS.TRACE_FILE];

  if (typeof traceFilePath !== "string" || traceFilePath.length === 0) {
    return;
  }

  const line = `[${new Date().toISOString()}] [claude-status-helper] ${message}\n`;

  try {
    fs.appendFileSync(traceFilePath, line, "utf8");
  } catch {
    // Ignore trace write failures inside the terminal helper.
  }
}

function readStringField(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];

  return typeof value === "string" ? value : undefined;
}

function readStatusArgsFromRecord(record: Record<string, unknown>): StatusArgs {
  const result: StatusArgs = {};

  for (const key of [
    "state",
    "emotion",
    "line",
    "currentTask",
    "activityLabel",
    "intensity",
    "assistantProviderId",
  ] as const) {
    const value = readStringField(record, key);

    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result;
}

function parseArgs(argv: string[]): StatusArgs {
  const first = argv[0];

  if (
    argv.length === 1 &&
    typeof first === "string" &&
    first.trim().startsWith("{")
  ) {
    const parsed: unknown = JSON.parse(first);

    return isRecord(parsed) ? readStatusArgsFromRecord(parsed) : {};
  }

  const result: StatusArgs = {};

  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];

    if (typeof key !== "string" || !key.startsWith("--") || value === undefined) {
      continue;
    }

    if (key === "--state") {
      result.state = value;
    } else if (key === "--emotion") {
      result.emotion = value;
    } else if (key === "--line") {
      result.line = value;
    } else if (key === "--task") {
      result.currentTask = value;
    } else if (key === "--activity") {
      result.activityLabel = value;
    } else if (key === "--intensity") {
      result.intensity = value;
    } else if (key === "--provider") {
      result.assistantProviderId = value;
    }
  }

  return result;
}

function printAvailableVisualOptions(): void {
  const catalogFilePath = process.env[ENV_KEYS.VISUAL_ASSET_CATALOG_FILE];

  if (typeof catalogFilePath !== "string" || catalogFilePath.length === 0) {
    process.stdout.write('{"states":[],"emotions":[],"emotionDescriptions":{}}\n');
    return;
  }

  try {
    const text = fs.readFileSync(catalogFilePath, "utf8");
    const parsed: unknown = JSON.parse(text);
    const providerId =
      process.env[ENV_KEYS.ASSISTANT_PROVIDER_ID] === "codex"
        ? "codex"
        : "claude";

    process.stdout.write(
      `${JSON.stringify(collectAvailableVisualOptions(parsed, providerId))}\n`,
    );
  } catch {
    process.stdout.write('{"states":[],"emotions":[],"emotionDescriptions":{}}\n');
  }
}

function main(): void {
  if (process.argv.includes("--list-visual-options")) {
    printAvailableVisualOptions();
    return;
  }

  const eventQueueDir = process.env[ENV_KEYS.EVENT_QUEUE_DIR];

  if (typeof eventQueueDir !== "string" || eventQueueDir.length === 0) {
    console.error(`${ENV_KEYS.EVENT_QUEUE_DIR} is not set.`);
    process.exit(1);
  }

  const payload = parseArgs(process.argv.slice(2));

  if (typeof payload.state !== "string" || typeof payload.line !== "string") {
    console.error(
      "Usage: claude-status --state <state> [--emotion <emotion>] --line <line> [--task <task>] [--intensity <low|medium|high>] [--list-visual-options]",
    );
    process.exit(1);
  }

  appendTrace(
    `writing status state=${payload.state} emotion=${payload.emotion ?? "none"} line=${payload.line} activity=${payload.activityLabel ?? ""} task=${payload.currentTask ?? ""}`,
  );
  writeQueueEvent(eventQueueDir, { type: "status", ...payload });
}

main();
