import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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

function createShellExports(env: Record<string, string>): string {
  return Object.entries(env)
    .map(([key, value]) => {
      return `export ${key}=${quoteForPosixShell(value)}`;
    })
    .join("\n");
}

// zsh 가 ZDOTDIR 기준으로 .zshenv/.zprofile/.zshrc/.zlogin 을 읽는 특성을 이용해,
// 유저 홈의 실제 설정 파일을 먼저 source 하고 그 뒤에 헬퍼 PATH 등을 덮어쓰는 래퍼를 만든다.
function createZshWrapperFile(
  sourceFileName: string,
  env: Record<string, string>,
): string {
  const sourceLine = [
    `if [ -f "$HOME/${sourceFileName}" ]; then`,
    `  . "$HOME/${sourceFileName}"`,
    "fi",
  ].join("\n");

  return `${sourceLine}\n${createShellExports(env)}\n`;
}

function getZshWrapperDir(homeDir: string): string {
  return path.join(
    os.tmpdir(),
    "claude-code-with-emotion-shell",
    Buffer.from(homeDir).toString("hex"),
    "zsh",
  );
}

function ensureZshWrapperDir(
  homeDir: string,
  env: Record<string, string>,
): string {
  const wrapperDir = getZshWrapperDir(homeDir);

  fs.mkdirSync(wrapperDir, { recursive: true });
  fs.writeFileSync(
    path.join(wrapperDir, ".zshenv"),
    createZshWrapperFile(".zshenv", env),
    "utf8",
  );
  fs.writeFileSync(
    path.join(wrapperDir, ".zprofile"),
    createZshWrapperFile(".zprofile", env),
    "utf8",
  );
  fs.writeFileSync(
    path.join(wrapperDir, ".zshrc"),
    createZshWrapperFile(".zshrc", env),
    "utf8",
  );
  fs.writeFileSync(
    path.join(wrapperDir, ".zlogin"),
    createZshWrapperFile(".zlogin", env),
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
