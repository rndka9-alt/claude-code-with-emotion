import { spawnSync } from "node:child_process";
import path from "node:path";
import { ENV_KEYS } from "../../../shared/env-keys";
import { getEffectivePath, getPlatformHelperBinResolver } from "../../platform";
import type { VisualMcpSetupStatus } from "../../../shared/mcp-setup-bridge";

const VISUAL_MCP_SERVER_NAME = "claude-code-with-emotion-visuals";

interface ClaudeBinaryResolution {
  errorMessage: string | null;
  path: string | null;
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

// PATH 탐색 + 확장자 후보는 어댑터에게 맡기되, "--version 이 0 으로 끝나야 진짜 claude" 라는
// 세만틱은 그대로 유지해야 해서 어댑터 위에 추가 verify 레이어를 얹는다.
// 실패는 두 가지(못 찾음 / 찾앗지만 실행 불가) 를 구분해 돌려준다. 이 구분이 없으면 호출부가
// 빈 stdout/stderr 만 보고 "명령이 실패햇다" 는 무의미한 메시지를 내보내게 된다.
function resolveClaudeBinary(
  pathValue: string | undefined,
): ClaudeBinaryResolution {
  const resolver = getPlatformHelperBinResolver();
  const candidate = resolver.findExecutableInPath("claude", pathValue);

  if (candidate === null) {
    return {
      errorMessage:
        "Claude Code CLI를 찾지 못햇어요. 앱이 로그인 셸 PATH까지 확인햇지만 `claude` 실행 파일이 없어요. 터미널에서 `claude --version`이 실행대는지 확인해 주세요.",
      path: null,
    };
  }

  // claude 는 `#!/usr/bin/env node` shebang 이라 verify 단계에도 node 가 PATH 에 잇어야 한다.
  // 탐색에 쓴 pathValue 를 그대로 env 에 넘겨야 Finder 실행 환경에서도 --version 이 뜬다.
  const check = spawnSync(candidate, ["--version"], {
    encoding: "utf8",
    env: { ...process.env, PATH: pathValue ?? "" },
  });

  if (check.status === 0) {
    return {
      errorMessage: null,
      path: candidate,
    };
  }

  const output =
    readSpawnOutput(check.stderr).trim() ||
    readSpawnOutput(check.stdout).trim();

  return {
    errorMessage:
      output.length > 0
        ? `Claude Code CLI는 찾앗지만 \`claude --version\` 실행에 실패햇어요. 설치 상태나 실행 권한을 확인해 주세요. (${output})`
        : "Claude Code CLI는 찾앗지만 `claude --version` 실행에 실패햇어요. 설치 상태나 실행 권한을 확인해 주세요.",
    path: null,
  };
}

function createBaseStatus(stateFilePath: string): VisualMcpSetupStatus {
  return {
    installed: false,
    stateFilePath,
  };
}

function createUserScopedVisualMcpJson(
  helperBinDir: string,
  stateFilePath: string,
): string {
  const resolver = getPlatformHelperBinResolver();

  // claude-visual-mcp 는 `#!/usr/bin/env node` shebang 이라 claude CLI 가 이 config 를 읽어
  // MCP 서버를 spawn 할 때 PATH 에 node 가 잇어야 한다. Finder 에서 설치하면 process.env.PATH 는
  // launchd 기본값이라 node 가 없으므로, 로그인 쉘에서 뽑은 effective PATH 를 config 에 기록한다.
  return JSON.stringify({
    command: path.join(
      helperBinDir,
      resolver.getHelperBinFilename("claude-visual-mcp"),
    ),
    args: [],
    env: {
      PATH: getEffectivePath(),
      [ENV_KEYS.ASSISTANT_PROVIDER_ID]: "claude",
      [ENV_KEYS.VISUAL_MCP_STATE_FILE]: stateFilePath,
    },
  });
}

function runClaudeMcpCommand(args: string[]): {
  errorMessage: string | null;
  result: ReturnType<typeof spawnSync> | null;
} {
  const effectivePath = getEffectivePath();
  const realClaude = resolveClaudeBinary(effectivePath);

  if (realClaude.path === null) {
    return {
      errorMessage: realClaude.errorMessage,
      result: null,
    };
  }

  return {
    errorMessage: null,
    result: spawnSync(realClaude.path, args, {
      encoding: "utf8",
      env: { ...process.env, PATH: effectivePath },
    }),
  };
}

export function getVisualMcpSetupStatus(
  stateFilePath: string,
): VisualMcpSetupStatus {
  const status = createBaseStatus(stateFilePath);
  const { result } = runClaudeMcpCommand([
    "mcp",
    "get",
    VISUAL_MCP_SERVER_NAME,
  ]);

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
  const { errorMessage, result } = runClaudeMcpCommand([
    "mcp",
    "add-json",
    "--scope",
    "user",
    VISUAL_MCP_SERVER_NAME,
    createUserScopedVisualMcpJson(helperBinDir, stateFilePath),
  ]);

  if (result === null || result.status !== 0) {
    const commandOutput =
      readSpawnOutput(result?.stderr).trim() ||
      readSpawnOutput(result?.stdout).trim();

    throw new Error(
      errorMessage ??
        (commandOutput.length > 0
          ? `Claude Code CLI는 찾앗지만 Visual MCP 등록 명령이 실패햇어요. \`claude mcp add-json\` 출력: ${commandOutput}`
          : "Claude Code CLI는 찾앗지만 Visual MCP 등록 명령이 실패햇어요. `claude mcp add-json --scope user`를 터미널에서 직접 실행해 보면 추가 단서가 나올 수 있어요."),
    );
  }

  return getVisualMcpSetupStatus(stateFilePath);
}

export function removeVisualMcpUserSetup(
  stateFilePath: string,
): VisualMcpSetupStatus {
  const { result } = runClaudeMcpCommand([
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
