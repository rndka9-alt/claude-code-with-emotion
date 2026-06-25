import path from "node:path";
import { ENV_KEYS } from "../../shared/env-keys";

const VISUAL_MCP_SERVER_NAME = "claude-code-with-emotion-visuals";

function quoteTomlValue(value: string): string {
  return JSON.stringify(value);
}

function createConfigOverride(key: string, value: string): string[] {
  return ["-c", `${key}=${quoteTomlValue(value)}`];
}

function appendEnvOverride(
  args: string[],
  envName: string,
  value: string | undefined,
): void {
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

export function createCodexVisualMcpRuntimeArgs(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const args: string[] = [];
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

  appendEnvOverride(args, ENV_KEYS.EVENT_QUEUE_DIR, env[ENV_KEYS.EVENT_QUEUE_DIR]);
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
