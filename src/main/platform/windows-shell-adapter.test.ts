import { describe, expect, it } from "vitest";
import {
  createWindowsLaunchConfig,
  createWindowsShellAdapter,
  quoteForWindowsCmd,
  resolveWindowsDefaultShell,
} from "./windows-shell-adapter";

describe("resolveWindowsDefaultShell", () => {
  it("prefers COMSPEC and falls back to cmd.exe under System32", () => {
    expect(
      resolveWindowsDefaultShell({
        COMSPEC: "C:\\Windows\\System32\\cmd.exe",
      }),
    ).toBe("C:\\Windows\\System32\\cmd.exe");
    expect(resolveWindowsDefaultShell({})).toBe(
      "C:\\Windows\\System32\\cmd.exe",
    );
  });

  it("falls back when COMSPEC is empty string", () => {
    expect(resolveWindowsDefaultShell({ COMSPEC: "" })).toBe(
      "C:\\Windows\\System32\\cmd.exe",
    );
  });

  it("honors custom shells set via COMSPEC", () => {
    expect(
      resolveWindowsDefaultShell({ COMSPEC: "C:\\Program Files\\pwsh\\pwsh.exe" }),
    ).toBe("C:\\Program Files\\pwsh\\pwsh.exe");
  });
});

describe("quoteForWindowsCmd", () => {
  it("wraps plain values in double quotes", () => {
    expect(quoteForWindowsCmd("C:\\Users\\foo\\bin\\claude-session-hook.cmd")).toBe(
      '"C:\\Users\\foo\\bin\\claude-session-hook.cmd"',
    );
  });

  it("preserves spaces inside the path", () => {
    expect(quoteForWindowsCmd("C:\\Program Files\\tool.cmd")).toBe(
      '"C:\\Program Files\\tool.cmd"',
    );
  });

  it("escapes embedded double quotes by doubling them", () => {
    // cmd.exe 의 토큰 파서는 큰따옴표 안에서 "" 를 리터럴 " 하나로 해석한다.
    expect(quoteForWindowsCmd('say "hi"')).toBe('"say ""hi"""');
  });

  it("returns an empty quoted literal for empty strings", () => {
    expect(quoteForWindowsCmd("")).toBe('""');
  });
});

describe("createWindowsLaunchConfig", () => {
  it("passes env straight through with no shell arguments", () => {
    // cmd.exe 는 startup 에서 env 를 덮어쓰지 안아서 POSIX zsh 같은 래퍼 트릭이 불필요.
    const env = {
      PATH: "C:\\Windows\\System32;C:\\helper-bin",
      CLAUDE_WITH_EMOTION_STATUS_FILE: "C:\\tmp\\status.json",
    };

    const launchConfig = createWindowsLaunchConfig(
      "C:\\Windows\\System32\\cmd.exe",
      env,
    );

    expect(launchConfig.env).toBe(env);
    expect(launchConfig.shellArgs).toEqual([]);
  });

  it("does not branch on shell path yet (cmd.exe only)", () => {
    // 향후 PowerShell 지원 시 이 테스트가 분기 표현으로 바뀔 것.
    const env = { PATH: "C:\\tools" };
    const configA = createWindowsLaunchConfig("C:\\Windows\\cmd.exe", env);
    const configB = createWindowsLaunchConfig(
      "C:\\Program Files\\pwsh\\pwsh.exe",
      env,
    );
    expect(configA.shellArgs).toEqual(configB.shellArgs);
  });
});

describe("createWindowsShellAdapter", () => {
  it("exposes the Windows shell primitives through the adapter interface", () => {
    const adapter = createWindowsShellAdapter();

    expect(adapter.resolveDefaultShell({ COMSPEC: "C:\\test\\cmd.exe" })).toBe(
      "C:\\test\\cmd.exe",
    );
    expect(adapter.quoteForHookCommand("C:\\path with space\\x.cmd")).toBe(
      '"C:\\path with space\\x.cmd"',
    );
    const launchConfig = adapter.createLaunchConfig(
      "C:\\Windows\\System32\\cmd.exe",
      { PATH: "C:\\Windows" },
    );
    expect(launchConfig.shellArgs).toEqual([]);
  });
});
