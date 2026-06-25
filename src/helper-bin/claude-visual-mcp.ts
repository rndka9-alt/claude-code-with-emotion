import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createVisualPromptHints } from "./lib/claude-visual-mcp-prompts";
import {
  createVisualMcpChildEnv,
  describeVisualMcpRuntimeSources,
  resolveVisualMcpRuntime,
} from "./lib/claude-visual-mcp-state";

const SERVER_NAME = "claude-code-with-emotion-visuals";
const SERVER_VERSION = "0.1.0";
const helperDir = __dirname;
const nodeRuntimePath = process.execPath;
// 번들 후 이 entry 는 bin/ 에 놓이고 형제 헬퍼(claude-status, claude-visual-state)도 같은 bin/ 에 있다.
const statusHelperPath = path.join(helperDir, "claude-status");
const visualStateHelperPath = path.join(helperDir, "claude-visual-state");

interface AvailableVisualOptions {
  emotionDescriptions: Record<string, unknown>;
  emotions: string[];
  states: string[];
}

interface ToolTextContent {
  text: string;
  type: "text";
}

interface ToolResult {
  content: ToolTextContent[];
  isError?: boolean;
}

type TransportMode = "content-length" | "jsonl";

let inputBuffer = Buffer.alloc(0);
let negotiatedProtocolVersion = "2024-11-05";
let transportMode: TransportMode = "content-length";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function emptyVisualOptions(): AvailableVisualOptions {
  return {
    states: [],
    emotions: [],
    emotionDescriptions: {},
  };
}

function appendTrace(message: string): void {
  const traceFilePath = resolveVisualMcpRuntime().traceFilePath;

  if (typeof traceFilePath !== "string" || traceFilePath.length === 0) {
    return;
  }

  const line = `[${new Date().toISOString()}] [claude-visual-mcp] ${message}\n`;

  try {
    fs.appendFileSync(traceFilePath, line, "utf8");
  } catch {
    // Ignore trace write failures inside the MCP helper.
  }
}

function sendMessage(message: Record<string, unknown>): void {
  const json = JSON.stringify(message);
  const contentLength = Buffer.byteLength(json, "utf8");

  appendTrace(
    `send message transport=${transportMode} keys=${Object.keys(message).join(",")} bytes=${contentLength}`,
  );

  if (transportMode === "jsonl") {
    process.stdout.write(`${json}\n`);
    return;
  }

  process.stdout.write(`Content-Length: ${contentLength}\r\n\r\n${json}`);
}

function sendSuccess(id: unknown, result: unknown): void {
  sendMessage({
    jsonrpc: "2.0",
    id,
    result,
  });
}

function sendError(id: unknown, code: number, message: string): void {
  sendMessage({
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
    },
  });
}

function readAvailableVisualOptions(): AvailableVisualOptions {
  const runtime = resolveVisualMcpRuntime();

  if (runtime.visualAssetCatalogFilePath.length === 0) {
    appendTrace("visual options unavailable catalogPath=missing");
    return emptyVisualOptions();
  }

  const result = spawnSync(
    nodeRuntimePath,
    [statusHelperPath, "--list-visual-options"],
    {
      cwd: process.cwd(),
      env: createVisualMcpChildEnv(process.env),
      encoding: "utf8",
    },
  );

  if (result.status !== 0) {
    appendTrace(
      `visual options helper failed status=${result.status ?? "null"} stderr=${JSON.stringify(result.stderr ?? "")}`,
    );
    return emptyVisualOptions();
  }

  try {
    const parsed: unknown = JSON.parse(result.stdout.trim());

    if (
      isRecord(parsed) &&
      Array.isArray(parsed.states) &&
      Array.isArray(parsed.emotions)
    ) {
      // emotionDescriptions 는 구버전 helper 호환을 위해 업스면 빈 객체로 폴백.
      const descriptions = parsed.emotionDescriptions;
      const emotionDescriptions = isRecord(descriptions) ? descriptions : {};

      return {
        states: parsed.states,
        emotions: parsed.emotions,
        emotionDescriptions,
      };
    }
  } catch {
    // Fall through to the empty response.
  }

  return emptyVisualOptions();
}

function createToolsListResult(): { tools: Record<string, unknown>[] } {
  const runtime = resolveVisualMcpRuntime();

  if (runtime.eventQueueDir.length === 0) {
    const sources = describeVisualMcpRuntimeSources();

    appendTrace(
      `tools/list hiding visual tools eventQueueDir=missing source=${sources.eventQueueDirSource} stateFile=${sources.stateFilePath}`,
    );
    return {
      tools: [],
    };
  }

  const availableOptions = readAvailableVisualOptions();
  const emotionEnum = ["neutral", ...availableOptions.emotions];
  const promptHints = createVisualPromptHints();

  return {
    tools: [
      {
        name: "set_visual_overlay",
        description: promptHints.overlaySelectionPrompt,
        inputSchema: {
          type: "object",
          properties: {
            emotion: {
              type: "string",
              enum: emotionEnum,
            },
            line: {
              type: ["string", "null"],
              minLength: 1,
              maxLength: 80,
            },
          },
          additionalProperties: false,
        },
      },
    ],
  };
}

function callVisualOverlayTool(argumentsObject: unknown): ToolResult {
  const runtime = resolveVisualMcpRuntime();
  const sources = describeVisualMcpRuntimeSources();

  appendTrace(
    `set_visual_overlay requested eventQueueDir=${runtime.eventQueueDir || "<missing>"} eventQueueDirSource=${sources.eventQueueDirSource} stateFile=${sources.stateFilePath} provider=${runtime.assistantProviderId || "<missing>"}`,
  );

  if (!isRecord(argumentsObject)) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: "Provide at least one of emotion or line.",
        },
      ],
    };
  }

  const hasEmotion = Object.prototype.hasOwnProperty.call(
    argumentsObject,
    "emotion",
  );
  const hasLine = Object.prototype.hasOwnProperty.call(argumentsObject, "line");

  if (!hasEmotion && !hasLine) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: "Provide at least one of emotion or line.",
        },
      ],
    };
  }

  const payload: { emotion?: string | null; line?: string | null } = {};

  if (hasEmotion) {
    const availableOptions = readAvailableVisualOptions();
    const allowedEmotions = new Set(["neutral", ...availableOptions.emotions]);
    const emotion = argumentsObject.emotion;

    if (typeof emotion !== "string" || !allowedEmotions.has(emotion)) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Unsupported emotion: ${
              typeof emotion === "string" ? emotion : "missing"
            }`,
          },
        ],
      };
    }

    // "neutral" 은 클라이언트가 emotion overlay 를 끄고 싶다는 뜻이므로 null 로 저장.
    payload.emotion = emotion === "neutral" ? null : emotion;
  }

  if (hasLine) {
    const line = argumentsObject.line;

    if (line === null) {
      payload.line = null;
    } else if (typeof line === "string") {
      const trimmed = line.trim();

      if (trimmed.length === 0) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Missing line text.",
            },
          ],
        };
      }

      payload.line = trimmed;
    } else {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Line must be a string or null.",
          },
        ],
      };
    }
  }

  const result = spawnSync(
    nodeRuntimePath,
    [visualStateHelperPath, JSON.stringify(payload)],
    {
      cwd: process.cwd(),
      env: createVisualMcpChildEnv(process.env),
      encoding: "utf8",
    },
  );

  if (result.status !== 0) {
    appendTrace(
      `set_visual_overlay helper failed status=${result.status ?? "null"} stderr=${JSON.stringify(result.stderr ?? "")} stdout=${JSON.stringify(result.stdout ?? "")}`,
    );
    return {
      isError: true,
      content: [
        {
          type: "text",
          text:
            result.stderr || result.stdout || "Failed to write visual overlay",
        },
      ],
    };
  }

  // 매 턴 호출되는 도구라 응답 페이로드를 최소화한다. 실제 overlay 변경은 이벤트 큐로 전달되므로
  // 도구 응답에는 성공 여부만 싣는다.
  return {
    content: [
      {
        type: "text",
        text: '{"ok":true}',
      },
    ],
  };
}

function handleRequest(message: unknown): void {
  if (!isRecord(message)) {
    appendTrace("ignore non-object request");
    return;
  }

  const id = Object.prototype.hasOwnProperty.call(message, "id")
    ? message.id
    : null;
  const method = typeof message.method === "string" ? message.method : null;

  appendTrace(
    `handle request id=${id === null ? "none" : String(id)} method=${method ?? "none"}`,
  );

  if (method === null) {
    if (id !== null) {
      sendError(id, -32600, "Invalid request");
    }
    return;
  }

  if (method === "notifications/initialized") {
    return;
  }

  if (method === "initialize") {
    const params = message.params;
    const requestedProtocolVersion =
      isRecord(params) && typeof params.protocolVersion === "string"
        ? params.protocolVersion
        : negotiatedProtocolVersion;

    negotiatedProtocolVersion = requestedProtocolVersion;

    sendSuccess(id, {
      protocolVersion: negotiatedProtocolVersion,
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: SERVER_NAME,
        version: SERVER_VERSION,
      },
    });
    return;
  }

  if (method === "tools/list") {
    sendSuccess(id, createToolsListResult());
    return;
  }

  if (method === "tools/call") {
    const params = message.params;
    const toolName =
      isRecord(params) && typeof params.name === "string" ? params.name : null;
    const argumentsObject = isRecord(params) ? params.arguments : null;

    if (toolName === "set_visual_overlay") {
      sendSuccess(id, callVisualOverlayTool(argumentsObject));
      return;
    }

    sendError(id, -32601, `Unknown tool: ${toolName ?? "missing"}`);
    return;
  }

  if (id !== null) {
    sendError(id, -32601, `Method not found: ${method}`);
  }
}

function processInputBuffer(): void {
  while (true) {
    if (transportMode === "jsonl") {
      const newlineIndex = inputBuffer.indexOf("\n");

      if (newlineIndex === -1) {
        return;
      }

      const messageText = inputBuffer
        .subarray(0, newlineIndex)
        .toString("utf8")
        .trim();

      inputBuffer = inputBuffer.subarray(newlineIndex + 1);

      if (messageText.length === 0) {
        continue;
      }

      appendTrace(`decoded jsonl message chars=${messageText.length}`);

      try {
        handleRequest(JSON.parse(messageText));
      } catch (error) {
        appendTrace(
          `jsonl parse error=${error instanceof Error ? error.message : String(error)}`,
        );
        sendError(
          null,
          -32700,
          error instanceof Error ? error.message : "Parse error",
        );
      }

      continue;
    }

    const crlfHeaderEndIndex = inputBuffer.indexOf("\r\n\r\n");
    const lfHeaderEndIndex = inputBuffer.indexOf("\n\n");
    let headerEndIndex = -1;
    let headerDelimiterLength = 0;

    if (
      crlfHeaderEndIndex !== -1 &&
      (lfHeaderEndIndex === -1 || crlfHeaderEndIndex <= lfHeaderEndIndex)
    ) {
      headerEndIndex = crlfHeaderEndIndex;
      headerDelimiterLength = 4;
    } else if (lfHeaderEndIndex !== -1) {
      headerEndIndex = lfHeaderEndIndex;
      headerDelimiterLength = 2;
    }

    if (headerEndIndex === -1) {
      return;
    }

    const headerText = inputBuffer.subarray(0, headerEndIndex).toString("utf8");
    const contentLengthMatch = headerText.match(/Content-Length:\s*(\d+)/i);

    if (contentLengthMatch === null) {
      inputBuffer = Buffer.alloc(0);
      return;
    }

    const contentLength = Number(contentLengthMatch[1]);
    const messageStartIndex = headerEndIndex + headerDelimiterLength;
    const messageEndIndex = messageStartIndex + contentLength;

    if (inputBuffer.length < messageEndIndex) {
      return;
    }

    const messageText = inputBuffer
      .subarray(messageStartIndex, messageEndIndex)
      .toString("utf8");

    inputBuffer = inputBuffer.subarray(messageEndIndex);
    appendTrace(`decoded message bytes=${contentLength}`);

    try {
      handleRequest(JSON.parse(messageText));
    } catch (error) {
      appendTrace(
        `parse error=${error instanceof Error ? error.message : String(error)}`,
      );
      sendError(
        null,
        -32700,
        error instanceof Error ? error.message : "Parse error",
      );
    }
  }
}

appendTrace(`server start pid=${process.pid} cwd=${process.cwd()}`);
{
  const runtime = resolveVisualMcpRuntime();
  const sources = describeVisualMcpRuntimeSources();

  appendTrace(
    `runtime resolved provider=${runtime.assistantProviderId || "<missing>"} providerSource=${sources.assistantProviderIdSource} eventQueueDir=${runtime.eventQueueDir || "<missing>"} eventQueueDirSource=${sources.eventQueueDirSource} traceSource=${sources.traceFilePathSource} catalog=${runtime.visualAssetCatalogFilePath || "<missing>"} catalogSource=${sources.visualAssetCatalogFilePathSource} stateFile=${sources.stateFilePath}`,
  );
}
process.stdin.on("data", (chunk: Buffer) => {
  appendTrace(`stdin chunk bytes=${chunk.length}`);
  appendTrace(`stdin chunk preview=${JSON.stringify(chunk.toString("utf8"))}`);

  if (
    inputBuffer.length === 0 &&
    !chunk.toString("utf8").startsWith("Content-Length:")
  ) {
    transportMode = "jsonl";
    appendTrace("detected jsonl transport");
  }

  inputBuffer = Buffer.concat([inputBuffer, chunk]);
  processInputBuffer();
});
process.stdin.on("end", () => {
  appendTrace("stdin end");
});
process.on("exit", (code) => {
  appendTrace(`process exit code=${code}`);
});
process.on("uncaughtException", (error) => {
  appendTrace(
    `uncaughtException=${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
  );
});
process.on("unhandledRejection", (reason) => {
  appendTrace(
    `unhandledRejection=${reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)}`,
  );
});

process.stdin.resume();
