import { spawnSync } from "node:child_process";
import path from "node:path";
import { ENV_KEYS } from "../../../shared/env-keys";
import type { VisualMcpSetupTargetStatus } from "../../../shared/mcp-setup-bridge";
import {
  getPlatformHelperBinResolver,
  joinPathList,
  splitPathList,
} from "../../platform";

const VISUAL_MCP_SERVER_NAME = "claude-code-with-emotion-visuals";
const CODEX_DISPLAY_NAME = "Codex CLI";
const CODEX_TARGET_ID = "codex";

let loginShellPathCache: string | null | undefined = undefined;

interface CodexBinaryResolution {
  errorMessage: string | null;
  path: string | null;
}

function resolveLoginShellPath(): string | null {
  if (loginShellPathCache !== undefined) {
    return loginShellPathCache;
  }

  if (process.platform === "win32") {
    loginShellPathCache = null;
    return loginShellPathCache;
  }

  const shell = process.env.SHELL ?? "/bin/zsh";
  const result = spawnSync(shell, ["-ilc", 'printf %s "$PATH"'], {
    encoding: "utf8",
    timeout: 3000,
  });

  if (result.status !== 0 || typeof result.stdout !== "string") {
    loginShellPathCache = null;
    return loginShellPathCache;
  }

  const discovered = result.stdout.trim();

  loginShellPathCache = discovered.length > 0 ? discovered : null;
  return loginShellPathCache;
}

function mergePathLists(primary: string, secondary: string): string {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const segment of [
    ...splitPathList(primary),
    ...splitPathList(secondary),
  ]) {
    if (segment.length === 0 || seen.has(segment)) {
      continue;
    }

    seen.add(segment);
    merged.push(segment);
  }

  return joinPathList(merged);
}

function getEffectivePath(): string {
  const initialPath = process.env.PATH ?? "";
  const loginPath = resolveLoginShellPath();

  if (loginPath === null) {
    return initialPath;
  }

  return mergePathLists(loginPath, initialPath);
}

function resolveCodexBinary(
  pathValue: string | undefined,
): CodexBinaryResolution {
  const resolver = getPlatformHelperBinResolver();
  const candidate = resolver.findExecutableInPath("codex", pathValue);

  if (candidate === null) {
    return {
      errorMessage:
        "Codex CLI를 찾지 못햇어요. 앱이 로그인 셸 PATH까지 확인햇지만 `codex` 실행 파일이 없어요. 먼저 Codex CLI를 설치하고 터미널에서 `codex --version`이 실행대는지 확인해 주세요.",
      path: null,
    };
  }

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
        ? `Codex CLI는 찾앗지만 \`codex --version\` 실행에 실패햇어요. 설치 상태나 실행 권한을 확인해 주세요. (${output})`
        : "Codex CLI는 찾앗지만 `codex --version` 실행에 실패햇어요. 설치 상태나 실행 권한을 확인해 주세요.",
    path: null,
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

function createBaseStatus(stateFilePath: string): VisualMcpSetupTargetStatus {
  return {
    displayName: CODEX_DISPLAY_NAME,
    installed: false,
    stateFilePath,
    targetId: CODEX_TARGET_ID,
  };
}

function createExpectedVisualMcpCommand(helperBinDir: string): string {
  const resolver = getPlatformHelperBinResolver();

  return path.join(
    helperBinDir,
    resolver.getHelperBinFilename("claude-visual-mcp"),
  );
}

function parseCodexMcpGetCommand(stdout: string): string | null {
  for (const line of stdout.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    const prefix = "command:";

    if (!trimmedLine.startsWith(prefix)) {
      continue;
    }

    const command = trimmedLine.slice(prefix.length).trim();

    return command.length > 0 ? command : null;
  }

  return null;
}

function runCodexMcpCommand(args: string[]): {
  errorMessage: string | null;
  result: ReturnType<typeof spawnSync> | null;
} {
  const effectivePath = getEffectivePath();
  const realCodex = resolveCodexBinary(effectivePath);

  if (realCodex.path === null) {
    return {
      errorMessage: realCodex.errorMessage,
      result: null,
    };
  }

  return {
    errorMessage: null,
    result: spawnSync(realCodex.path, args, {
      encoding: "utf8",
      env: { ...process.env, PATH: effectivePath },
    }),
  };
}

export function getCodexVisualMcpSetupStatus(
  helperBinDir: string,
  stateFilePath: string,
): VisualMcpSetupTargetStatus {
  const status = createBaseStatus(stateFilePath);
  const { result } = runCodexMcpCommand(["mcp", "get", VISUAL_MCP_SERVER_NAME]);

  if (result === null) {
    return status;
  }

  const installedCommand = parseCodexMcpGetCommand(
    readSpawnOutput(result.stdout),
  );

  if (
    result.status === 0 &&
    installedCommand === createExpectedVisualMcpCommand(helperBinDir)
  ) {
    return {
      ...status,
      installed: true,
    };
  }

  return status;
}

function removeCodexVisualMcpServerIfPresent(): void {
  const { errorMessage, result } = runCodexMcpCommand([
    "mcp",
    "remove",
    VISUAL_MCP_SERVER_NAME,
  ]);

  if (result === null) {
    throw new Error(
      errorMessage ?? "Codex Visual MCP 제거 명령을 실행하지 못햇어요.",
    );
  }

  if (result.status === 0) {
    return;
  }

  const output = `${readSpawnOutput(result.stdout)}${readSpawnOutput(result.stderr)}`;

  if (output.includes("No MCP server found")) {
    return;
  }

  throw new Error(
    output.trim().length > 0
      ? `Codex Visual MCP 기존 설정 제거가 실패햇어요. \`codex mcp remove ${VISUAL_MCP_SERVER_NAME}\` 출력: ${output.trim()}`
      : `Codex Visual MCP 기존 설정 제거가 실패햇어요. \`codex mcp remove ${VISUAL_MCP_SERVER_NAME}\`를 터미널에서 직접 실행해 보면 추가 단서가 나올 수 있어요.`,
  );
}

export function installCodexVisualMcpUserSetup(
  helperBinDir: string,
  stateFilePath: string,
): VisualMcpSetupTargetStatus {
  const effectivePath = getEffectivePath();
  const command = createExpectedVisualMcpCommand(helperBinDir);

  removeCodexVisualMcpServerIfPresent();

  const { errorMessage, result } = runCodexMcpCommand([
    "mcp",
    "add",
    VISUAL_MCP_SERVER_NAME,
    "--env",
    `PATH=${effectivePath}`,
    "--env",
    `${ENV_KEYS.ASSISTANT_PROVIDER_ID}=codex`,
    "--env",
    `${ENV_KEYS.VISUAL_MCP_STATE_FILE}=${stateFilePath}`,
    "--",
    command,
  ]);

  if (result === null || result.status !== 0) {
    const commandOutput =
      readSpawnOutput(result?.stderr).trim() ||
      readSpawnOutput(result?.stdout).trim();

    throw new Error(
      errorMessage ??
        (commandOutput.length > 0
          ? `Codex CLI는 찾앗지만 Visual MCP 등록 명령이 실패햇어요. \`codex mcp add ${VISUAL_MCP_SERVER_NAME}\` 출력: ${commandOutput}`
          : `Codex CLI는 찾앗지만 Visual MCP 등록 명령이 실패햇어요. \`codex mcp add ${VISUAL_MCP_SERVER_NAME}\`를 터미널에서 직접 실행해 보면 추가 단서가 나올 수 있어요.`),
    );
  }

  return getCodexVisualMcpSetupStatus(helperBinDir, stateFilePath);
}

export function removeCodexVisualMcpUserSetup(
  stateFilePath: string,
): VisualMcpSetupTargetStatus {
  const { errorMessage, result } = runCodexMcpCommand([
    "mcp",
    "remove",
    VISUAL_MCP_SERVER_NAME,
  ]);

  if (result === null) {
    return createBaseStatus(stateFilePath);
  }

  if (result.status !== 0) {
    const output = `${readSpawnOutput(result.stdout)}${readSpawnOutput(result.stderr)}`;

    throw new Error(
      errorMessage ??
        (output.trim().length > 0
          ? `Codex Visual MCP 제거 명령이 실패햇어요. \`codex mcp remove ${VISUAL_MCP_SERVER_NAME}\` 출력: ${output.trim()}`
          : `Codex Visual MCP 제거 명령이 실패햇어요. \`codex mcp remove ${VISUAL_MCP_SERVER_NAME}\`를 터미널에서 직접 실행해 보면 추가 단서가 나올 수 있어요.`),
    );
  }

  return createBaseStatus(stateFilePath);
}
