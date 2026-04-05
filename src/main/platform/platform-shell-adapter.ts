import { createPosixShellAdapter } from "./posix-shell-adapter";

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

// 현재는 POSIX(macOS/Linux) 어댑터만 존재. 윈도우 어댑터는 스텝① 범위 밖이라 미구현 상태로 두고,
// 이 리졸버에 분기만 추가하면 되도록 자리를 잡아둔다.
export function getPlatformShellAdapter(): PlatformShellAdapter {
  return createPosixShellAdapter();
}
