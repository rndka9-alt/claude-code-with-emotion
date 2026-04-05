import { createPosixShellAdapter } from "./posix-shell-adapter";
import { createWindowsShellAdapter } from "./windows-shell-adapter";

export interface ShellLaunchConfig {
  env: Record<string, string>;
  shellArgs: string[];
}

// 플랫폼마다 쉘 선택·인자·쿼팅 규칙이 전부 다르기 때문에, 터미널 런치 레이어가
// 직접 분기하지 않고 이 어댑터를 통해서만 플랫폼 의존 동작을 수행하도록 강제한다.
export interface PlatformShellAdapter {
  resolveDefaultShell(env: Record<string, string | undefined>): string;
  createLaunchConfig(
    shell: string,
    env: Record<string, string>,
  ): ShellLaunchConfig;
  quoteForHookCommand(value: string): string;
}

export function getPlatformShellAdapter(): PlatformShellAdapter {
  if (process.platform === "win32") {
    return createWindowsShellAdapter();
  }
  return createPosixShellAdapter();
}
