import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

interface JsonRpcMessage {
  id?: number;
  method?: string;
  result?: unknown;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readLatestOverlayEvent(
  queueDir: string,
): Record<string, unknown> {
  const files = fs
    .readdirSync(queueDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  for (let i = files.length - 1; i >= 0; i--) {
    const fileName = files[i] as string;
    const event: unknown = JSON.parse(
      fs.readFileSync(path.join(queueDir, fileName), "utf8"),
    );

    if (isObjectRecord(event) && event.type === "overlay") {
      return event;
    }
  }

  throw new Error("No overlay event found in queue directory");
}

function readSetVisualOverlayEmotionEnum(response: JsonRpcMessage): string[] {
  if (!isObjectRecord(response.result)) {
    throw new Error("Expected MCP tools/list result to be an object");
  }

  const tools = response.result.tools;

  if (!Array.isArray(tools)) {
    throw new Error("Expected MCP tools/list result to contain tools");
  }

  const setVisualOverlayTool = tools.find((tool) => {
    return (
      isObjectRecord(tool) &&
      typeof tool.name === "string" &&
      tool.name === "set_visual_overlay"
    );
  });

  if (!isObjectRecord(setVisualOverlayTool)) {
    throw new Error("Expected set_visual_overlay tool definition");
  }

  const inputSchema = setVisualOverlayTool.inputSchema;

  if (!isObjectRecord(inputSchema) || !isObjectRecord(inputSchema.properties)) {
    throw new Error("Expected input schema properties");
  }

  const emotionProperty = inputSchema.properties.emotion;

  if (
    !isObjectRecord(emotionProperty) ||
    !Array.isArray(emotionProperty.enum)
  ) {
    throw new Error(
      "Expected emotion enum on set_visual_overlay input schema",
    );
  }

  return emotionProperty.enum.filter((value): value is string => {
    return typeof value === "string";
  });
}

function readToolNames(response: JsonRpcMessage): string[] {
  if (!isObjectRecord(response.result)) {
    throw new Error("Expected MCP tools/list result to be an object");
  }

  const tools = response.result.tools;

  if (!Array.isArray(tools)) {
    throw new Error("Expected MCP tools/list result to contain tools");
  }

  return tools.flatMap((tool) => {
    if (
      typeof tool === "object" &&
      tool !== null &&
      typeof tool.name === "string"
    ) {
      return [tool.name];
    }

    return [];
  });
}

function encodeMessage(message: object): string {
  const json = JSON.stringify(message);

  return `Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`;
}

function decodeMessages(buffer: Buffer): {
  messages: JsonRpcMessage[];
  remainder: Buffer;
} {
  const messages: JsonRpcMessage[] = [];
  let remainder = buffer;

  while (true) {
    const headerEndIndex = remainder.indexOf("\r\n\r\n");

    if (headerEndIndex === -1) {
      return { messages, remainder };
    }

    const headerText = remainder.subarray(0, headerEndIndex).toString("utf8");
    const contentLengthMatch = headerText.match(/Content-Length:\s*(\d+)/i);

    if (contentLengthMatch === null) {
      return { messages, remainder: Buffer.alloc(0) };
    }

    const contentLength = Number(contentLengthMatch[1]);
    const messageStartIndex = headerEndIndex + 4;
    const messageEndIndex = messageStartIndex + contentLength;

    if (remainder.length < messageEndIndex) {
      return { messages, remainder };
    }

    const messageText = remainder
      .subarray(messageStartIndex, messageEndIndex)
      .toString("utf8");

    messages.push(JSON.parse(messageText));
    remainder = remainder.subarray(messageEndIndex);
  }
}

async function invokeMcpServer(
  requests: object[],
  env: NodeJS.ProcessEnv,
): Promise<JsonRpcMessage[]> {
  const child = spawn("node", ["./bin/claude-visual-mcp"], {
    cwd: process.cwd(),
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const collectedMessages: JsonRpcMessage[] = [];

  await new Promise<void>((resolve, reject) => {
    let stdoutBuffer: ReturnType<typeof decodeMessages>["remainder"] =
      Buffer.alloc(0);

    child.stdout.on("data", (chunk) => {
      stdoutBuffer = Buffer.concat([stdoutBuffer, chunk]);
      const decoded = decodeMessages(stdoutBuffer);

      stdoutBuffer = decoded.remainder;
      collectedMessages.push(...decoded.messages);

      if (collectedMessages.length >= requests.length) {
        child.kill();
        resolve();
      }
    });
    child.stderr.on("data", (chunk) => {
      reject(new Error(chunk.toString("utf8")));
    });
    child.on("exit", () => {
      if (collectedMessages.length >= requests.length) {
        resolve();
      } else {
        reject(new Error("MCP server exited before all responses arrived."));
      }
    });

    for (const request of requests) {
      child.stdin.write(encodeMessage(request));
    }
  });

  return collectedMessages;
}

describe("claude-visual-mcp", () => {
  it("lists only the currently mapped emotion presets plus neutral", async () => {
    const catalogFilePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "claude-visual-mcp-catalog-")),
      "visual-assets.json",
    );
    const eventQueueDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "claude-visual-mcp-queue-"),
    );

    fs.writeFileSync(
      catalogFilePath,
      JSON.stringify({
        version: 1,
        assets: [
          {
            id: "asset-sad",
            kind: "image",
            label: "Sad Fox",
            path: "/tmp/sad.png",
          },
        ],
        mappings: [
          {
            assetId: "asset-sad",
            emotion: "sad",
          },
        ],
        stateLines: [],
      }),
      "utf8",
    );

    const responses = await invokeMcpServer(
      [
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "test",
              version: "0.0.0",
            },
          },
        },
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {},
        },
      ],
      {
        ...process.env,
        CLAUDE_WITH_EMOTION_VISUAL_ASSET_CATALOG_FILE: catalogFilePath,
        CLAUDE_WITH_EMOTION_EVENT_QUEUE_DIR: eventQueueDir,
      },
    );
    const toolsListResponse = responses.find((response) => response.id === 2);

    if (toolsListResponse === undefined) {
      throw new Error("Expected a tools/list response");
    }

    expect(readSetVisualOverlayEmotionEnum(toolsListResponse)).toEqual([
      "neutral",
      "sad",
    ]);
    expect(readToolNames(toolsListResponse)).toEqual(
      expect.arrayContaining([
        "get_available_visual_options",
        "set_visual_overlay",
      ]),
    );
  });

  it("writes an emotion overlay through the merged tool call", async () => {
    const catalogFilePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "claude-visual-mcp-catalog-")),
      "visual-assets.json",
    );
    const eventQueueDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "claude-visual-mcp-queue-"),
    );

    fs.writeFileSync(
      catalogFilePath,
      JSON.stringify({
        version: 1,
        assets: [
          {
            id: "asset-happy",
            kind: "image",
            label: "Happy Fox",
            path: "/tmp/happy.png",
          },
        ],
        mappings: [
          {
            assetId: "asset-happy",
            emotion: "happy",
          },
        ],
        stateLines: [],
      }),
      "utf8",
    );

    await invokeMcpServer(
      [
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "test",
              version: "0.0.0",
            },
          },
        },
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "set_visual_overlay",
            arguments: {
              emotion: "happy",
            },
          },
        },
      ],
      {
        ...process.env,
        CLAUDE_WITH_EMOTION_VISUAL_ASSET_CATALOG_FILE: catalogFilePath,
        CLAUDE_WITH_EMOTION_EVENT_QUEUE_DIR: eventQueueDir,
      },
    );

    const event = readLatestOverlayEvent(eventQueueDir);
    expect(event.type).toBe("overlay");
    expect(event.emotion).toBe("happy");
  });

  it("writes and clears a visual line through the merged tool", async () => {
    const catalogFilePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "claude-visual-mcp-catalog-")),
      "visual-assets.json",
    );
    const eventQueueDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "claude-visual-mcp-queue-"),
    );

    fs.writeFileSync(
      catalogFilePath,
      JSON.stringify({
        version: 1,
        assets: [],
        mappings: [],
        stateLines: [],
      }),
      "utf8",
    );

    await invokeMcpServer(
      [
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "test",
              version: "0.0.0",
            },
          },
        },
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "set_visual_overlay",
            arguments: {
              line: "문제를 좀 더 파볼게요!",
            },
          },
        },
      ],
      {
        ...process.env,
        CLAUDE_WITH_EMOTION_VISUAL_ASSET_CATALOG_FILE: catalogFilePath,
        CLAUDE_WITH_EMOTION_EVENT_QUEUE_DIR: eventQueueDir,
      },
    );

    const setEvent = readLatestOverlayEvent(eventQueueDir);
    expect(setEvent.type).toBe("overlay");
    expect(setEvent.line).toBe("문제를 좀 더 파볼게요!");

    await invokeMcpServer(
      [
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "test",
              version: "0.0.0",
            },
          },
        },
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "set_visual_overlay",
            arguments: {
              line: null,
            },
          },
        },
      ],
      {
        ...process.env,
        CLAUDE_WITH_EMOTION_VISUAL_ASSET_CATALOG_FILE: catalogFilePath,
        CLAUDE_WITH_EMOTION_EVENT_QUEUE_DIR: eventQueueDir,
      },
    );

    const clearEvent = readLatestOverlayEvent(eventQueueDir);
    expect(clearEvent.type).toBe("overlay");
    expect(clearEvent.line).toBeNull();
  });

  it("updates emotion and line together in one overlay call", async () => {
    const catalogFilePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "claude-visual-mcp-catalog-")),
      "visual-assets.json",
    );
    const eventQueueDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "claude-visual-mcp-queue-"),
    );

    fs.writeFileSync(
      catalogFilePath,
      JSON.stringify({
        version: 1,
        assets: [
          {
            id: "asset-happy",
            kind: "image",
            label: "Happy Fox",
            path: "/tmp/happy.png",
          },
        ],
        mappings: [
          {
            assetId: "asset-happy",
            emotion: "happy",
          },
        ],
        stateLines: [],
      }),
      "utf8",
    );

    await invokeMcpServer(
      [
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "test",
              version: "0.0.0",
            },
          },
        },
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "set_visual_overlay",
            arguments: {
              emotion: "happy",
              line: "둘 다 간다!",
            },
          },
        },
      ],
      {
        ...process.env,
        CLAUDE_WITH_EMOTION_VISUAL_ASSET_CATALOG_FILE: catalogFilePath,
        CLAUDE_WITH_EMOTION_EVENT_QUEUE_DIR: eventQueueDir,
      },
    );

    const event = readLatestOverlayEvent(eventQueueDir);
    expect(event.type).toBe("overlay");
    expect(event.emotion).toBe("happy");
    expect(event.line).toBe("둘 다 간다!");
  });

  it("creates separate queue events when fields are updated independently", async () => {
    const catalogFilePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "claude-visual-mcp-catalog-")),
      "visual-assets.json",
    );
    const eventQueueDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "claude-visual-mcp-queue-"),
    );

    fs.writeFileSync(
      catalogFilePath,
      JSON.stringify({
        version: 1,
        assets: [
          {
            id: "asset-happy",
            kind: "image",
            label: "Happy Fox",
            path: "/tmp/happy.png",
          },
        ],
        mappings: [
          {
            assetId: "asset-happy",
            emotion: "happy",
          },
        ],
        stateLines: [],
      }),
      "utf8",
    );

    await invokeMcpServer(
      [
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "test",
              version: "0.0.0",
            },
          },
        },
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "set_visual_overlay",
            arguments: {
              emotion: "happy",
            },
          },
        },
      ],
      {
        ...process.env,
        CLAUDE_WITH_EMOTION_VISUAL_ASSET_CATALOG_FILE: catalogFilePath,
        CLAUDE_WITH_EMOTION_EVENT_QUEUE_DIR: eventQueueDir,
      },
    );

    await invokeMcpServer(
      [
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "test",
              version: "0.0.0",
            },
          },
        },
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "set_visual_overlay",
            arguments: {
              line: "나중에 왓지만 별개 이벤트",
            },
          },
        },
      ],
      {
        ...process.env,
        CLAUDE_WITH_EMOTION_VISUAL_ASSET_CATALOG_FILE: catalogFilePath,
        CLAUDE_WITH_EMOTION_EVENT_QUEUE_DIR: eventQueueDir,
      },
    );

    // Each MCP tool call produces its own queue event file.
    const files = fs
      .readdirSync(eventQueueDir)
      .filter((f) => f.endsWith(".json"))
      .sort();

    expect(files.length).toBeGreaterThanOrEqual(2);

    const overlayEvents = files
      .map((f) =>
        JSON.parse(
          fs.readFileSync(path.join(eventQueueDir, f), "utf8"),
        ) as Record<string, unknown>,
      )
      .filter((e) => e.type === "overlay");

    expect(overlayEvents).toHaveLength(2);
    expect(overlayEvents[0]?.emotion).toBe("happy");
    expect(overlayEvents[1]?.line).toBe("나중에 왓지만 별개 이벤트");
  });
});
