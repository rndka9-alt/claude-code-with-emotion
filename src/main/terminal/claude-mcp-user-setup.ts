import { spawnSync } from "node:child_process";
import path from "node:path";
import { getPlatformHelperBinResolver } from "../platform/helper-bin-resolver";
import type { VisualMcpSetupStatus } from "../../shared/mcp-setup-bridge";

const VISUAL_MCP_SERVER_NAME = "claude-code-with-emotion-visuals";

// PATH 탐색 + 확장자 후보는 어댑터에게 맡기되, "--version 이 0 으로 끝나야 진짜 claude" 라는
// 세만틱은 그대로 유지해야 해서 어댑터 위에 추가 verify 레이어를 얹는다.
function resolveClaudeBinary(pathValue: string | undefined): string | null {
  const resolver = getPlatformHelperBinResolver();
  const candidate = resolver.findExecutableInPath("claude", pathValue);

  if (candidate === null) {
    return null;
  }

  const check = spawnSync(candidate, ["--version"], {
    encoding: "utf8",
    stdio: "ignore",
  });

  if (check.status === 0) {
    return candidate;
  }

  return null;
}

function createBaseStatus(stateFilePath: string): VisualMcpSetupStatus {
  return {
    installed: false,
    stateFilePath,
  };
}

function readSpawnOutput(value: string | Buffer | null | undefined): string {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Buffer) {
    return value.toString("utf8");
  }

  return "";
}

function createUserScopedVisualMcpJson(
  helperBinDir: string,
  stateFilePath: string,
): string {
  const resolver = getPlatformHelperBinResolver();

  return JSON.stringify({
    command: path.join(
      helperBinDir,
      resolver.getHelperBinFilename("claude-visual-mcp"),
    ),
    args: [],
    env: {
      PATH: process.env.PATH ?? "",
      CLAUDE_WITH_EMOTION_VISUAL_MCP_STATE_FILE: stateFilePath,
    },
  });
}

function runClaudeMcpCommand(
  args: string[],
): ReturnType<typeof spawnSync> | null {
  const realClaude = resolveClaudeBinary(process.env.PATH);

  if (realClaude === null) {
    return null;
  }

  return spawnSync(realClaude, args, {
    encoding: "utf8",
    env: process.env,
  });
}

export function getVisualMcpSetupStatus(
  stateFilePath: string,
): VisualMcpSetupStatus {
  const status = createBaseStatus(stateFilePath);
  const result = runClaudeMcpCommand(["mcp", "get", VISUAL_MCP_SERVER_NAME]);

  if (result === null) {
    return status;
  }

  if (result.status === 0) {
    return {
      ...status,
      installed: true,
    };
  }

  return status;
}

export function installVisualMcpUserSetup(
  helperBinDir: string,
  stateFilePath: string,
): VisualMcpSetupStatus {
  const result = runClaudeMcpCommand([
    "mcp",
    "add-json",
    "--scope",
    "user",
    VISUAL_MCP_SERVER_NAME,
    createUserScopedVisualMcpJson(helperBinDir, stateFilePath),
  ]);

  if (result === null || result.status !== 0) {
    throw new Error(
      readSpawnOutput(result?.stderr).trim() ||
        readSpawnOutput(result?.stdout).trim() ||
        "Failed to install visual MCP setup.",
    );
  }

  return getVisualMcpSetupStatus(stateFilePath);
}

export function removeVisualMcpUserSetup(
  stateFilePath: string,
): VisualMcpSetupStatus {
  const result = runClaudeMcpCommand([
    "mcp",
    "remove",
    "--scope",
    "user",
    VISUAL_MCP_SERVER_NAME,
  ]);

  if (result === null) {
    return createBaseStatus(stateFilePath);
  }

  if (result.status !== 0) {
    const output = `${readSpawnOutput(result.stdout)}${readSpawnOutput(result.stderr)}`;

    if (!output.includes("No MCP server found")) {
      throw new Error(output.trim() || "Failed to remove visual MCP setup.");
    }
  }

  return getVisualMcpSetupStatus(stateFilePath);
}
