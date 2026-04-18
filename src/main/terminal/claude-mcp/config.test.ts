import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ENV_KEYS } from "../../../shared/env-keys";
import {
  createClaudeVisualMcpConfig,
  ensureClaudeVisualMcpConfigFile,
} from "./config";

describe("claude visual mcp config", () => {
  it("creates a stdio MCP config for the visual helper server", () => {
    const config = createClaudeVisualMcpConfig("/tmp/helper-bin");
    const serverConfig = config.mcpServers["claude-code-with-emotion-visuals"];

    expect(serverConfig).toEqual({
      command: "/tmp/helper-bin/claude-visual-mcp",
      args: [],
      env: {
        PATH: "${PATH}",
        [ENV_KEYS.TRACE_FILE]: `\${${ENV_KEYS.TRACE_FILE}}`,
        [ENV_KEYS.VISUAL_ASSET_CATALOG_FILE]: `\${${ENV_KEYS.VISUAL_ASSET_CATALOG_FILE}}`,
        [ENV_KEYS.EVENT_QUEUE_DIR]: `\${${ENV_KEYS.EVENT_QUEUE_DIR}}`,
      },
    });
  });

  it("writes a reusable mcp config file for the helper bin directory", () => {
    const helperBinDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "claude-with-emotion-helper-bin-"),
    );

    try {
      const configFilePath = ensureClaudeVisualMcpConfigFile(helperBinDir);
      const configFile = fs.readFileSync(configFilePath, "utf8");

      expect(configFile).toContain('"claude-code-with-emotion-visuals"');
      expect(configFile).toContain("claude-visual-mcp");
      expect(configFile).toContain(`"${ENV_KEYS.EVENT_QUEUE_DIR}"`);
      expect(configFile).toContain('"PATH"');
    } finally {
      fs.rmSync(helperBinDir, { recursive: true, force: true });
    }
  });
});
