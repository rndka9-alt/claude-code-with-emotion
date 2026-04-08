import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  getPlatformHelperBinResolver,
  joinPathList,
  splitPathList,
} from "../platform";
import type { VisualMcpSetupStatus } from "../../shared/mcp-setup-bridge";

const VISUAL_MCP_SERVER_NAME = "claude-code-with-emotion-visuals";

// Finder 로 띄운 Electron 은 launchd 기본 PATH(`/usr/bin:/bin:/usr/sbin:/sbin`) 만 받아서
// nvm/asdf/homebrew 로 설치한 claude 를 못 찾는다. 터미널은 zsh 래퍼가 이미 해결햇지만
// 메인 프로세스의 spawnSync 는 그 래퍼를 안 거치므로, 로그인 쉘을 한 번 띄워 PATH 를 뽑아 캐싱한다.
// 3초 timeout 은 rc 파일이 뭔가 느린 짓을 해도 앱 전체가 멈추지 않게 하는 안전장치.
let loginShellPathCache: string | null | undefined = undefined;

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

// 로그인 쉘 PATH 를 앞, process.env.PATH 를 뒤로 merge 한다. 유저 쉘 설정(nvm/asdf/homebrew)
// 이 우선이어야 `env node` shebang 이 풀리고, 뒤쪽 process PATH 는 helperBinDir 같은 런타임 전용
// 항목을 날리지 않으려고 유지한다. 중복 세그먼트는 먼저 나온 쪽을 남긴다.
function mergePathLists(primary: string, secondary: string): string {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const segment of [...splitPathList(primary), ...splitPathList(secondary)]) {
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

// PATH 탐색 + 확장자 후보는 어댑터에게 맡기되, "--version 이 0 으로 끝나야 진짜 claude" 라는
// 세만틱은 그대로 유지해야 해서 어댑터 위에 추가 verify 레이어를 얹는다.
function resolveClaudeBinary(pathValue: string | undefined): string | null {
  const resolver = getPlatformHelperBinResolver();
  const candidate = resolver.findExecutableInPath("claude", pathValue);

  if (candidate === null) {
    return null;
  }

  // claude 는 `#!/usr/bin/env node` shebang 이라 verify 단계에도 node 가 PATH 에 잇어야 한다.
  // 탐색에 쓴 pathValue 를 그대로 env 에 넘겨야 Finder 실행 환경에서도 --version 이 뜬다.
  const check = spawnSync(candidate, ["--version"], {
    encoding: "utf8",
    stdio: "ignore",
    env: { ...process.env, PATH: pathValue ?? "" },
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
      CLAUDE_WITH_EMOTION_VISUAL_MCP_STATE_FILE: stateFilePath,
    },
  });
}

function runClaudeMcpCommand(
  args: string[],
): ReturnType<typeof spawnSync> | null {
  const effectivePath = getEffectivePath();
  const realClaude = resolveClaudeBinary(effectivePath);

  if (realClaude === null) {
    return null;
  }

  return spawnSync(realClaude, args, {
    encoding: "utf8",
    env: { ...process.env, PATH: effectivePath },
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
