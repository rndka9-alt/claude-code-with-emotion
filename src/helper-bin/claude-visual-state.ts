import fs from "node:fs";
import { writeQueueEvent } from "./lib/event-queue-writer";
import {
  describeVisualMcpRuntimeSources,
  resolveVisualMcpRuntime,
} from "./lib/claude-visual-mcp-state";

// overlay 큐 이벤트의 페이로드. emotion/line 은 string(설정) 또는 null(해제) 이며,
// 키 자체가 없으면 해당 축을 건드리지 않는다.
interface VisualOverlayArgs {
  emotion?: string | null;
  line?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readOverlayValue(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return undefined;
}

function appendTrace(message: string): void {
  const traceFilePath = resolveVisualMcpRuntime().traceFilePath;

  if (typeof traceFilePath !== "string" || traceFilePath.length === 0) {
    return;
  }

  const line = `[${new Date().toISOString()}] [claude-visual-state-helper] ${message}\n`;

  try {
    fs.appendFileSync(traceFilePath, line, "utf8");
  } catch {
    // Ignore trace write failures inside the terminal helper.
  }
}

function parseArgs(argv: string[]): VisualOverlayArgs {
  const first = argv[0];

  if (
    argv.length === 1 &&
    typeof first === "string" &&
    first.trim().startsWith("{")
  ) {
    const parsed: unknown = JSON.parse(first);

    if (isRecord(parsed)) {
      const result: VisualOverlayArgs = {};
      const emotion = readOverlayValue(parsed.emotion);
      const line = readOverlayValue(parsed.line);

      if (emotion !== undefined) {
        result.emotion = emotion;
      }

      if (line !== undefined) {
        result.line = line;
      }

      return result;
    }

    return {};
  }

  const result: VisualOverlayArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];

    if (typeof key !== "string" || !key.startsWith("--")) {
      continue;
    }

    if (key === "--clear-line") {
      result.line = null;
      continue;
    }

    if (key === "--reset") {
      result.emotion = null;
      result.line = null;
      continue;
    }

    const value = argv[index + 1];

    if (value === undefined) {
      continue;
    }

    if (key === "--emotion") {
      result.emotion = value === "neutral" ? null : value;
      index += 1;
    } else if (key === "--line") {
      result.line = value;
      index += 1;
    }
  }

  return result;
}

async function main(): Promise<void> {
  const runtime = resolveVisualMcpRuntime();
  const sources = describeVisualMcpRuntimeSources();
  const eventQueueDir = runtime.eventQueueDir;
  const queueExists =
    typeof eventQueueDir === "string" &&
    eventQueueDir.length > 0 &&
    fs.existsSync(eventQueueDir);

  appendTrace(
    `resolved runtime provider=${runtime.assistantProviderId || "<missing>"} providerSource=${sources.assistantProviderIdSource} eventQueueDir=${eventQueueDir || "<missing>"} eventQueueDirSource=${sources.eventQueueDirSource} queueExists=${queueExists} stateFile=${sources.stateFilePath}`,
  );

  if (typeof eventQueueDir !== "string" || eventQueueDir.length === 0) {
    appendTrace("missing event queue dir; refusing visual overlay write");
    console.error("Event queue directory must be set.");
    process.exit(1);
  }

  const payload = parseArgs(process.argv.slice(2));

  if (payload.emotion === undefined && payload.line === undefined) {
    console.error(
      "Usage: claude-visual-state --emotion <emotion> [--line <line>] [--clear-line] [--reset]",
    );
    process.exit(1);
  }

  appendTrace(
    `writing visual overlay emotion=${payload.emotion ?? "none"} line=${payload.line ?? ""}`,
  );

  writeQueueEvent(eventQueueDir, { type: "overlay", ...payload });
  appendTrace(`wrote visual overlay queue=${eventQueueDir}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
