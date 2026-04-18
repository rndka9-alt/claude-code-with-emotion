import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ENV_KEYS } from "../../shared/env-keys";
import { resolveHomeDir } from "./platform-paths";
import type {
  PlatformShellAdapter,
  ShellLaunchConfig,
} from "./platform-shell-adapter";

const POSIX_DEFAULT_SHELL = "/bin/zsh";
const INTERACTIVE_SHELL_ARGS = ["-i", "-l"] as const;

export function resolvePosixDefaultShell(
  env: Record<string, string | undefined>,
): string {
  const shell = env.SHELL;

  if (typeof shell === "string" && shell.length > 0) {
    return shell;
  }

  return POSIX_DEFAULT_SHELL;
}

// POSIX 싱글쿼트 이스케이프: 문자열 전체를 '...' 로 감싸되, 내부 ' 는 '\"'\"' 로 escape.
// 이 패턴이 sh/bash/zsh 전부에서 공통으로 동작하는 최소 공통 분모.
export function quoteForPosixShell(value: string): string {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

// PATH/CLAUDE_WITH_EMOTION_ORIGINAL_PATH 는 유저 쉘 설정이 모두 반영된 뒤에 동적으로 계산해야 하므로
// 정적 export 대상에서 제외한다. (이 두 개를 정적으로 덮어쓰면 유저가 .zshrc 에서 PATH 에 붙인
// 경로 - 예: /opt/homebrew/bin, nvm/asdf shim - 이 전부 사라져 `claude` 의 `env node` shebang 이 깨짐)
const DYNAMIC_PATH_ENV_KEYS = new Set([
  "PATH",
  ENV_KEYS.ORIGINAL_PATH,
]);

function createShellExports(env: Record<string, string>): string {
  return Object.entries(env)
    .filter(([key]) => !DYNAMIC_PATH_ENV_KEYS.has(key))
    .map(([key, value]) => {
      return `export ${key}=${quoteForPosixShell(value)}`;
    })
    .join("\n");
}

// 유저 쉘 설정 뒤에서 PATH 에 helperBinDir 을 prepend 하고, helperBinDir 을 제외한 순수 유저 PATH 를
// CLAUDE_WITH_EMOTION_ORIGINAL_PATH 에 저장하는 스니펫. .zshenv → .zprofile → .zshrc → .zlogin 네 번에
// 걸쳐 실행돼도 helperBinDir 이 중복 누적되지 않도록 매번 strip 한 뒤 다시 앞에 끼워 넣는다.
function createPathRebuildSnippet(helperBinDir: string): string {
  const quotedHelper = quoteForPosixShell(helperBinDir);

  return [
    `__cwe_helper=${quotedHelper}`,
    `__cwe_stripped=":\${PATH}:"`,
    `__cwe_stripped="\${__cwe_stripped//:\${__cwe_helper}:/:}"`,
    `__cwe_stripped="\${__cwe_stripped#:}"`,
    `__cwe_stripped="\${__cwe_stripped%:}"`,
    `export ${ENV_KEYS.ORIGINAL_PATH}="\${__cwe_stripped}"`,
    `if [ -n "\${__cwe_stripped}" ]; then`,
    `  export PATH="\${__cwe_helper}:\${__cwe_stripped}"`,
    `else`,
    `  export PATH="\${__cwe_helper}"`,
    `fi`,
    `unset __cwe_helper __cwe_stripped`,
  ].join("\n");
}

// zsh 가 ZDOTDIR 기준으로 .zshenv/.zprofile/.zshrc/.zlogin 을 읽는 특성을 이용해,
// 유저 홈의 실제 설정 파일을 먼저 source 하고 그 뒤에 헬퍼 env/PATH 를 씌우는 래퍼를 만든다.
function createZshWrapperFile(
  sourceFileName: string,
  env: Record<string, string>,
  helperBinDir: string,
): string {
  const sourceLine = [
    `if [ -f "$HOME/${sourceFileName}" ]; then`,
    `  . "$HOME/${sourceFileName}"`,
    "fi",
  ].join("\n");

  return `${sourceLine}\n${createShellExports(env)}\n${createPathRebuildSnippet(helperBinDir)}\n`;
}

function getZshWrapperDir(homeDir: string): string {
  return path.join(
    os.tmpdir(),
    "claude-code-with-emotion-shell",
    Buffer.from(homeDir).toString("hex"),
    "zsh",
  );
}

function resolveHelperBinDir(env: Record<string, string>): string {
  const helperBinDir = env[ENV_KEYS.HELPER_BIN_DIR];

  if (typeof helperBinDir === "string" && helperBinDir.length > 0) {
    return helperBinDir;
  }

  // CLAUDE_WITH_EMOTION_HELPER_BIN_DIR 가 비어있을 때의 안전한 폴백:
  // env.PATH 의 첫 세그먼트가 곧 helperBinDir 이다(세션 매니저가 그렇게 조립함).
  const [firstPathSegment] = (env.PATH ?? "").split(path.delimiter);

  return typeof firstPathSegment === "string" ? firstPathSegment : "";
}

function ensureZshWrapperDir(
  homeDir: string,
  env: Record<string, string>,
): string {
  const wrapperDir = getZshWrapperDir(homeDir);
  const helperBinDir = resolveHelperBinDir(env);

  fs.mkdirSync(wrapperDir, { recursive: true });
  fs.writeFileSync(
    path.join(wrapperDir, ".zshenv"),
    createZshWrapperFile(".zshenv", env, helperBinDir),
    "utf8",
  );
  fs.writeFileSync(
    path.join(wrapperDir, ".zprofile"),
    createZshWrapperFile(".zprofile", env, helperBinDir),
    "utf8",
  );
  fs.writeFileSync(
    path.join(wrapperDir, ".zshrc"),
    createZshWrapperFile(".zshrc", env, helperBinDir),
    "utf8",
  );
  fs.writeFileSync(
    path.join(wrapperDir, ".zlogin"),
    createZshWrapperFile(".zlogin", env, helperBinDir),
    "utf8",
  );

  return wrapperDir;
}

export function createPosixLaunchConfig(
  shell: string,
  env: Record<string, string>,
): ShellLaunchConfig {
  const shellName = path.basename(shell);

  if (shellName === "zsh") {
    const homeDir = resolveHomeDir(env);

    if (typeof homeDir === "string" && homeDir.length > 0) {
      const wrapperDir = ensureZshWrapperDir(homeDir, env);

      return {
        env: {
          ...env,
          ZDOTDIR: wrapperDir,
        },
        shellArgs: [...INTERACTIVE_SHELL_ARGS],
      };
    }
  }

  if (shellName === "bash") {
    return {
      env,
      shellArgs: [...INTERACTIVE_SHELL_ARGS],
    };
  }

  return {
    env,
    shellArgs: ["-l"],
  };
}

export function createPosixShellAdapter(): PlatformShellAdapter {
  return {
    resolveDefaultShell: resolvePosixDefaultShell,
    createLaunchConfig: createPosixLaunchConfig,
    quoteForHookCommand: quoteForPosixShell,
  };
}
