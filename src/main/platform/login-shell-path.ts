import { spawnSync } from "node:child_process";
import { joinPathList, splitPathList } from "./platform-paths";
import { getPlatformShellAdapter } from "./platform-shell-adapter";

// rc 파일이 뭔가 느린 짓을 해도 앱 전체가 멈추지 않게 하는 안전장치.
const LOGIN_SHELL_PATH_PROBE_TIMEOUT_MS = 3000;

// 성공한 PATH 만 캐싱한다. 실패까지 캐싱하면 프로브가 한 번만 삐끗해도 - 쉘 초기화가 느린 콜드 스타트,
// 프로브 도중의 CLI 자동 업데이트 - 앱을 재시작할 때까지 영원히 유저 PATH 를 못 읽는다. 호출 지점은
// MCP 설치 상태 확인/설치 버튼처럼 드물어서, 재프로브 비용보다 실패에서 스스로 복구되는 쪽이 중요하다.
let loginShellPathCache: string | null = null;

// Finder 로 띄운 Electron 은 launchd 기본 PATH(`/usr/bin:/bin:/usr/sbin:/sbin`) 만 받아서
// nvm/asdf/homebrew 로 설치한 CLI 를 못 찾는다. 터미널은 zsh 래퍼가 이미 해결햇지만
// 메인 프로세스의 spawnSync 는 그 래퍼를 안 거치므로, 로그인 쉘을 한 번 띄워 PATH 를 뽑는다.
export function resolveLoginShellPath(): string | null {
  if (loginShellPathCache !== null) {
    return loginShellPathCache;
  }

  if (process.platform === "win32") {
    return null;
  }

  const shell = getPlatformShellAdapter().resolveDefaultShell(process.env);
  const result = spawnSync(shell, ["-ilc", 'printf %s "$PATH"'], {
    encoding: "utf8",
    timeout: LOGIN_SHELL_PATH_PROBE_TIMEOUT_MS,
  });

  if (result.status !== 0 || typeof result.stdout !== "string") {
    return null;
  }

  const discovered = result.stdout.trim();

  if (discovered.length === 0) {
    return null;
  }

  loginShellPathCache = discovered;
  return loginShellPathCache;
}

// 로그인 쉘 PATH 를 앞, process.env.PATH 를 뒤로 merge 한다. 유저 쉘 설정(nvm/asdf/homebrew)
// 이 우선이어야 `env node` shebang 이 풀리고, 뒤쪽 process PATH 는 helperBinDir 같은 런타임 전용
// 항목을 날리지 않으려고 유지한다. 중복 세그먼트는 먼저 나온 쪽을 남긴다.
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

// 외부 CLI(claude/codex) 를 찾고 실행할 때 쓸 PATH. 로그인 쉘 프로브가 실패하면
// 최소한 현재 프로세스 PATH 로라도 시도한다.
export function getEffectivePath(): string {
  const initialPath = process.env.PATH ?? "";
  const loginPath = resolveLoginShellPath();

  if (loginPath === null) {
    return initialPath;
  }

  return mergePathLists(loginPath, initialPath);
}
