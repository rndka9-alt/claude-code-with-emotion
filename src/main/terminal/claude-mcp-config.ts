import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

interface ClaudeMcpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface ClaudeMcpConfig {
  mcpServers: Record<string, ClaudeMcpServerConfig>;
}

const VISUAL_MCP_SERVER_NAME = 'claude-code-with-emotion-visuals';

function getClaudeVisualMcpConfigDir(helperBinDir: string): string {
  return path.join(
    os.tmpdir(),
    'claude-code-with-emotion-mcp',
    Buffer.from(helperBinDir).toString('hex'),
  );
}

export function createClaudeVisualMcpConfig(
  helperBinDir: string,
): ClaudeMcpConfig {
  const visualMcpServerPath = path.join(helperBinDir, 'claude-visual-mcp');

  return {
    mcpServers: {
      [VISUAL_MCP_SERVER_NAME]: {
        command: visualMcpServerPath,
        args: [],
        env: {
          PATH: '${PATH}',
          CLAUDE_WITH_EMOTION_TRACE_FILE:
            '${CLAUDE_WITH_EMOTION_TRACE_FILE}',
          CLAUDE_WITH_EMOTION_VISUAL_ASSET_CATALOG_FILE:
            '${CLAUDE_WITH_EMOTION_VISUAL_ASSET_CATALOG_FILE}',
          CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE:
            '${CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE}',
        },
      },
    },
  };
}

export function ensureClaudeVisualMcpConfigFile(helperBinDir: string): string {
  const configDir = getClaudeVisualMcpConfigDir(helperBinDir);
  const configFilePath = path.join(configDir, 'visual-mcp.json');
  const configJson = JSON.stringify(
    createClaudeVisualMcpConfig(helperBinDir),
    null,
    2,
  );

  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configFilePath, configJson, 'utf8');

  return configFilePath;
}
