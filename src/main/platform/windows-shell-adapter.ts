import type {
  PlatformShellAdapter,
  ShellLaunchConfig,
} from "./platform-shell-adapter";

// COMSPEC 이 누락댄 비정상 환경을 위한 폴백. 시스템 드라이브 가정을 최소화하려 %SystemRoot% 대신
// 관례상 C:\\Windows 를 사용. 더 정확한 추정이 필요해지면 SystemRoot env 를 먼저 보는 식으로 확장.
const WINDOWS_DEFAULT_SHELL = "C:\\Windows\\System32\\cmd.exe";

export function resolveWindowsDefaultShell(
  env: Record<string, string | undefined>,
): string {
  const comspec = env.COMSPEC;

  if (typeof comspec === "string" && comspec.length > 0) {
    return comspec;
  }

  return WINDOWS_DEFAULT_SHELL;
}

// cmd.exe 토큰 파서가 이해하는 이스케이프: 전체를 " 로 감싸고 내부 " 는 "" (중복)로 처리.
// 주의: % 변수 전개(`%PATH%` 등)는 cmd.exe 안에선 정식으로 막을 방법이 업다. 경로·값이 % 를 포함하지
// 안는다는 전제에 기댄다. 실제 유즈케이스(helperBinDir + 이벤트 이름)에선 % 가 거의 나오지 안음.
export function quoteForWindowsCmd(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

// cmd.exe 는 POSIX zsh 처럼 startup 에서 PATH 등을 갈아끼우지 안아서 env 를 그대로 넘기면 된다.
// ConPTY 기반 node-pty 가 env 를 자식 프로세스에 전달. PowerShell 을 지원하려면 여기서 분기.
export function createWindowsLaunchConfig(
  _shell: string,
  env: Record<string, string>,
): ShellLaunchConfig {
  return {
    env,
    shellArgs: [],
  };
}

export function createWindowsShellAdapter(): PlatformShellAdapter {
  return {
    resolveDefaultShell: resolveWindowsDefaultShell,
    createLaunchConfig: createWindowsLaunchConfig,
    quoteForHookCommand: quoteForWindowsCmd,
  };
}
