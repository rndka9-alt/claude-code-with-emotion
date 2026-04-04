import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createClaudeVisualMcpConfig,
  ensureClaudeVisualMcpConfigFile,
} from "./claude-mcp-config";

describe("claude visual mcp config", () => {
  it("creates a stdio MCP config for the visual helper server", () => {
    const config = createClaudeVisualMcpConfig("/tmp/helper-bin");
    const serverConfig = config.mcpServers["claude-code-with-emotion-visuals"];

    expect(serverConfig).toEqual({
      command: "/tmp/helper-bin/claude-visual-mcp",
      args: [],
      env: {
        PATH: "${PATH}",
        CLAUDE_WITH_EMOTION_TRACE_FILE: "${CLAUDE_WITH_EMOTION_TRACE_FILE}",
        CLAUDE_WITH_EMOTION_VISUAL_ASSET_CATALOG_FILE:
          "${CLAUDE_WITH_EMOTION_VISUAL_ASSET_CATALOG_FILE}",
        CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE:
          "${CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE}",
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
      expect(configFile).toContain('"CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE"');
      expect(configFile).toContain('"PATH"');
    } finally {
      fs.rmSync(helperBinDir, { recursive: true, force: true });
    }
  });
});
