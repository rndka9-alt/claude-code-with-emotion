const path = require("node:path");

const VISUAL_MCP_SERVER_NAME = "claude-code-with-emotion-visuals";
const ENV_KEYS = {
  ASSISTANT_PROVIDER_ID: "CLAUDE_WITH_EMOTION_ASSISTANT_PROVIDER_ID",
  EVENT_QUEUE_DIR: "CLAUDE_WITH_EMOTION_EVENT_QUEUE_DIR",
  HELPER_BIN_DIR: "CLAUDE_WITH_EMOTION_HELPER_BIN_DIR",
  TRACE_FILE: "CLAUDE_WITH_EMOTION_TRACE_FILE",
  VISUAL_ASSET_CATALOG_FILE: "CLAUDE_WITH_EMOTION_VISUAL_ASSET_CATALOG_FILE",
  VISUAL_MCP_STATE_FILE: "CLAUDE_WITH_EMOTION_VISUAL_MCP_STATE_FILE",
};

function quoteTomlValue(value) {
  return JSON.stringify(value);
}

function createConfigOverride(key, value) {
  return ["-c", `${key}=${quoteTomlValue(value)}`];
}

function appendEnvOverride(args, envName, value) {
  if (typeof value !== "string" || value.length === 0) {
    return;
  }

  args.push(
    ...createConfigOverride(
      `mcp_servers.${VISUAL_MCP_SERVER_NAME}.env.${envName}`,
      value,
    ),
  );
}

function createCodexVisualMcpRuntimeArgs(env = process.env) {
  const args = [];
  const helperBinDir = env[ENV_KEYS.HELPER_BIN_DIR];

  if (typeof helperBinDir === "string" && helperBinDir.length > 0) {
    args.push(
      ...createConfigOverride(
        `mcp_servers.${VISUAL_MCP_SERVER_NAME}.command`,
        path.join(helperBinDir, "claude-visual-mcp"),
      ),
      "-c",
      `mcp_servers.${VISUAL_MCP_SERVER_NAME}.args=[]`,
    );
  }

  appendEnvOverride(
    args,
    ENV_KEYS.EVENT_QUEUE_DIR,
    env[ENV_KEYS.EVENT_QUEUE_DIR],
  );
  appendEnvOverride(args, ENV_KEYS.TRACE_FILE, env[ENV_KEYS.TRACE_FILE]);
  appendEnvOverride(
    args,
    ENV_KEYS.VISUAL_ASSET_CATALOG_FILE,
    env[ENV_KEYS.VISUAL_ASSET_CATALOG_FILE],
  );
  appendEnvOverride(
    args,
    ENV_KEYS.VISUAL_MCP_STATE_FILE,
    env[ENV_KEYS.VISUAL_MCP_STATE_FILE],
  );

  if (args.length === 0) {
    return [];
  }

  return [
    ...createConfigOverride(
      `mcp_servers.${VISUAL_MCP_SERVER_NAME}.env.${ENV_KEYS.ASSISTANT_PROVIDER_ID}`,
      "codex",
    ),
    ...args,
  ];
}

module.exports = {
  createCodexVisualMcpRuntimeArgs,
};
