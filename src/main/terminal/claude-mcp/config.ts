import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ENV_KEYS } from "../../../shared/env-keys";
import { getPlatformHelperBinResolver } from "../../platform";

interface ClaudeMcpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface ClaudeMcpConfig {
  mcpServers: Record<string, ClaudeMcpServerConfig>;
}

const VISUAL_MCP_SERVER_NAME = "claude-code-with-emotion-visuals";

function getClaudeVisualMcpConfigDir(helperBinDir: string): string {
  return path.join(
    os.tmpdir(),
    "claude-code-with-emotion-mcp",
    Buffer.from(helperBinDir).toString("hex"),
  );
}

export function createClaudeVisualMcpConfig(
  helperBinDir: string,
): ClaudeMcpConfig {
  const resolver = getPlatformHelperBinResolver();
  const visualMcpServerPath = path.join(
    helperBinDir,
    resolver.getHelperBinFilename("claude-visual-mcp"),
  );

  return {
    mcpServers: {
      [VISUAL_MCP_SERVER_NAME]: {
        command: visualMcpServerPath,
        args: [],
        env: {
          PATH: "${PATH}",
          [ENV_KEYS.TRACE_FILE]: `\${${ENV_KEYS.TRACE_FILE}}`,
          [ENV_KEYS.VISUAL_ASSET_CATALOG_FILE]: `\${${ENV_KEYS.VISUAL_ASSET_CATALOG_FILE}}`,
          [ENV_KEYS.EVENT_QUEUE_DIR]: `\${${ENV_KEYS.EVENT_QUEUE_DIR}}`,
        },
      },
    },
  };
}

export function ensureClaudeVisualMcpConfigFile(helperBinDir: string): string {
  const configDir = getClaudeVisualMcpConfigDir(helperBinDir);
  const configFilePath = path.join(configDir, "visual-mcp.json");
  const configJson = JSON.stringify(
    createClaudeVisualMcpConfig(helperBinDir),
    null,
    2,
  );

  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configFilePath, configJson, "utf8");

  return configFilePath;
}
