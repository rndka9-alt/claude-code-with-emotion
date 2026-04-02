import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

interface JsonRpcMessage {
  id?: number;
  method?: string;
  result?: unknown;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readSetVisualEmotionEnum(response: JsonRpcMessage): string[] {
  if (!isObjectRecord(response.result)) {
    throw new Error('Expected MCP tools/list result to be an object');
  }

  const tools = response.result.tools;

  if (!Array.isArray(tools)) {
    throw new Error('Expected MCP tools/list result to contain tools');
  }

  const setVisualEmotionTool = tools.find((tool) => {
    return (
      isObjectRecord(tool) &&
      typeof tool.name === 'string' &&
      tool.name === 'set_visual_emotion'
    );
  });

  if (!isObjectRecord(setVisualEmotionTool)) {
    throw new Error('Expected set_visual_emotion tool definition');
  }

  const inputSchema = setVisualEmotionTool.inputSchema;

  if (!isObjectRecord(inputSchema) || !isObjectRecord(inputSchema.properties)) {
    throw new Error('Expected input schema properties');
  }

  const emotionProperty = inputSchema.properties.emotion;

  if (!isObjectRecord(emotionProperty) || !Array.isArray(emotionProperty.enum)) {
    throw new Error('Expected emotion enum on set_visual_emotion input schema');
  }

  return emotionProperty.enum.filter((value): value is string => {
    return typeof value === 'string';
  });
}

function readToolNames(response: JsonRpcMessage): string[] {
  if (!isObjectRecord(response.result)) {
    throw new Error('Expected MCP tools/list result to be an object');
  }

  const tools = response.result.tools;

  if (!Array.isArray(tools)) {
    throw new Error('Expected MCP tools/list result to contain tools');
  }

  return tools.flatMap((tool) => {
    if (
      typeof tool === 'object' &&
      tool !== null &&
      typeof tool.name === 'string'
    ) {
      return [tool.name];
    }

    return [];
  });
}

function encodeMessage(message: object): string {
  const json = JSON.stringify(message);

  return `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
}

function decodeMessages(buffer: Buffer): {
  messages: JsonRpcMessage[];
  remainder: Buffer;
} {
  const messages: JsonRpcMessage[] = [];
  let remainder = buffer;

  while (true) {
    const headerEndIndex = remainder.indexOf('\r\n\r\n');

    if (headerEndIndex === -1) {
      return { messages, remainder };
    }

    const headerText = remainder.subarray(0, headerEndIndex).toString('utf8');
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
      .toString('utf8');

    messages.push(JSON.parse(messageText));
    remainder = remainder.subarray(messageEndIndex);
  }
}

async function invokeMcpServer(
  requests: object[],
  env: NodeJS.ProcessEnv,
): Promise<JsonRpcMessage[]> {
  const child = spawn('node', ['./bin/claude-visual-mcp'], {
    cwd: process.cwd(),
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const collectedMessages: JsonRpcMessage[] = [];

  await new Promise<void>((resolve, reject) => {
    let stdoutBuffer: ReturnType<typeof decodeMessages>['remainder'] =
      Buffer.alloc(0);

    child.stdout.on('data', (chunk) => {
      stdoutBuffer = Buffer.concat([stdoutBuffer, chunk]);
      const decoded = decodeMessages(stdoutBuffer);

      stdoutBuffer = decoded.remainder;
      collectedMessages.push(...decoded.messages);

      if (collectedMessages.length >= requests.length) {
        child.kill();
        resolve();
      }
    });
    child.stderr.on('data', (chunk) => {
      reject(new Error(chunk.toString('utf8')));
    });
    child.on('exit', () => {
      if (collectedMessages.length >= requests.length) {
        resolve();
      } else {
        reject(new Error('MCP server exited before all responses arrived.'));
      }
    });

    for (const request of requests) {
      child.stdin.write(encodeMessage(request));
    }
  });

  return collectedMessages;
}

describe('claude-visual-mcp', () => {
  it('lists only the currently mapped emotion presets plus neutral', async () => {
    const catalogFilePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'claude-visual-mcp-catalog-')),
      'visual-assets.json',
    );
    const overlayFilePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'claude-visual-mcp-overlay-')),
      'overlay.json',
    );

    fs.writeFileSync(
      catalogFilePath,
      JSON.stringify({
        version: 1,
        assets: [
          {
            id: 'asset-sad',
            kind: 'image',
            label: 'Sad Fox',
            path: '/tmp/sad.png',
          },
        ],
        mappings: [
          {
            assetId: 'asset-sad',
            emotion: 'sad',
          },
        ],
        stateLines: [],
      }),
      'utf8',
    );

    const responses = await invokeMcpServer(
      [
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'test',
              version: '0.0.0',
            },
          },
        },
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {},
        },
      ],
      {
        ...process.env,
        CLAUDE_WITH_EMOTION_VISUAL_ASSET_CATALOG_FILE: catalogFilePath,
        CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE: overlayFilePath,
      },
    );
    const toolsListResponse = responses.find((response) => response.id === 2);

    if (toolsListResponse === undefined) {
      throw new Error('Expected a tools/list response');
    }

    expect(readSetVisualEmotionEnum(toolsListResponse)).toEqual([
      'neutral',
      'sad',
    ]);
    expect(readToolNames(toolsListResponse)).toEqual(
      expect.arrayContaining([
        'get_available_visual_options',
        'set_visual_emotion',
        'set_visual_line',
        'clear_visual_line',
      ]),
    );
  });

  it('writes an emotion overlay through the tool call', async () => {
    const catalogFilePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'claude-visual-mcp-catalog-')),
      'visual-assets.json',
    );
    const overlayFilePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'claude-visual-mcp-overlay-')),
      'overlay.json',
    );

    fs.writeFileSync(
      catalogFilePath,
      JSON.stringify({
        version: 1,
        assets: [
          {
            id: 'asset-happy',
            kind: 'image',
            label: 'Happy Fox',
            path: '/tmp/happy.png',
          },
        ],
        mappings: [
          {
            assetId: 'asset-happy',
            emotion: 'happy',
          },
        ],
        stateLines: [],
      }),
      'utf8',
    );

    await invokeMcpServer(
      [
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'test',
              version: '0.0.0',
            },
          },
        },
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'set_visual_emotion',
            arguments: {
              emotion: 'happy',
            },
          },
        },
      ],
      {
        ...process.env,
        CLAUDE_WITH_EMOTION_VISUAL_ASSET_CATALOG_FILE: catalogFilePath,
        CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE: overlayFilePath,
      },
    );

    expect(JSON.parse(fs.readFileSync(overlayFilePath, 'utf8'))).toEqual({
      emotion: 'happy',
    });
  });

  it('writes and clears a visual line through MCP tools', async () => {
    const catalogFilePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'claude-visual-mcp-catalog-')),
      'visual-assets.json',
    );
    const overlayFilePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'claude-visual-mcp-overlay-')),
      'overlay.json',
    );

    fs.writeFileSync(
      catalogFilePath,
      JSON.stringify({
        version: 1,
        assets: [],
        mappings: [],
        stateLines: [],
      }),
      'utf8',
    );

    await invokeMcpServer(
      [
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'test',
              version: '0.0.0',
            },
          },
        },
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'set_visual_line',
            arguments: {
              line: '문제를 좀 더 파볼게요!',
            },
          },
        },
      ],
      {
        ...process.env,
        CLAUDE_WITH_EMOTION_VISUAL_ASSET_CATALOG_FILE: catalogFilePath,
        CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE: overlayFilePath,
      },
    );

    expect(JSON.parse(fs.readFileSync(overlayFilePath, 'utf8'))).toEqual({
      line: '문제를 좀 더 파볼게요!',
    });

    await invokeMcpServer(
      [
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'test',
              version: '0.0.0',
            },
          },
        },
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'clear_visual_line',
            arguments: {},
          },
        },
      ],
      {
        ...process.env,
        CLAUDE_WITH_EMOTION_VISUAL_ASSET_CATALOG_FILE: catalogFilePath,
        CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE: overlayFilePath,
      },
    );

    expect(JSON.parse(fs.readFileSync(overlayFilePath, 'utf8'))).toEqual({
      line: null,
    });
  });
});
