import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createPosixLaunchConfig,
  createPosixShellAdapter,
  quoteForPosixShell,
  resolvePosixDefaultShell,
} from "./posix-shell-adapter";

describe("resolvePosixDefaultShell", () => {
  it("prefers SHELL and falls back to /bin/zsh", () => {
    expect(resolvePosixDefaultShell({ SHELL: "/bin/bash" })).toBe("/bin/bash");
    expect(resolvePosixDefaultShell({})).toBe("/bin/zsh");
  });
});

describe("quoteForPosixShell", () => {
  it("wraps plain values in single quotes", () => {
    expect(quoteForPosixShell("/tmp/foo bar")).toBe("'/tmp/foo bar'");
  });

  it("escapes embedded single quotes using the close-open trick", () => {
    expect(quoteForPosixShell("it's fine")).toBe(`'it'"'"'s fine'`);
  });
});

describe("createPosixLaunchConfig", () => {
  it("wraps zsh startup files so helper commands stay first on PATH", () => {
    const tempHome = fs.mkdtempSync(
      path.join(os.tmpdir(), "claude-with-emotion-home-"),
    );
    let wrapperDir = "";
    const env = {
      HOME: tempHome,
      PATH: "/tmp/helper-bin:/usr/bin",
      CLAUDE_WITH_EMOTION_ORIGINAL_PATH: "/usr/bin",
      CLAUDE_WITH_EMOTION_HELPER_BIN_DIR: "/tmp/helper-bin",
      CLAUDE_WITH_EMOTION_EVENT_QUEUE_DIR: "/tmp/event-queue",
      CLAUDE_WITH_EMOTION_HOOK_STATE_FILE: "/tmp/event-queue.hook-state.json",
      CLAUDE_WITH_EMOTION_TRACE_FILE: "/tmp/trace.log",
      CLAUDE_WITH_EMOTION_VISUAL_ASSET_CATALOG_FILE: "/tmp/visual-assets.json",
    };

    try {
      const launchConfig = createPosixLaunchConfig("/bin/zsh", env);
      const zdotDir = launchConfig.env.ZDOTDIR;
      wrapperDir = typeof zdotDir === "string" ? zdotDir : "";

      expect(launchConfig.shellArgs).toEqual(["-i", "-l"]);
      expect(typeof zdotDir).toBe("string");

      if (typeof zdotDir !== "string") {
        throw new Error("Expected ZDOTDIR to be a string");
      }

      const zshrc = fs.readFileSync(path.join(zdotDir, ".zshrc"), "utf8");

      expect(zshrc).toContain('. "$HOME/.zshrc"');
      // PATH 는 유저 쉘 설정 실행 뒤에 동적으로 재조립돼야 하므로 정적 quoted export 엔 포함되면 안 된다.
      expect(zshrc).not.toContain("export PATH='/tmp/helper-bin:/usr/bin'");
      expect(zshrc).not.toContain(
        "export CLAUDE_WITH_EMOTION_ORIGINAL_PATH='/usr/bin'",
      );
      expect(zshrc).toContain("__cwe_helper='/tmp/helper-bin'");
      expect(zshrc).toContain(
        'export CLAUDE_WITH_EMOTION_ORIGINAL_PATH="${__cwe_stripped}"',
      );
      expect(zshrc).toContain('export PATH="${__cwe_helper}:${__cwe_stripped}"');
      expect(zshrc).toContain(
        "export CLAUDE_WITH_EMOTION_EVENT_QUEUE_DIR='/tmp/event-queue'",
      );
      expect(zshrc).toContain(
        "export CLAUDE_WITH_EMOTION_HOOK_STATE_FILE='/tmp/event-queue.hook-state.json'",
      );
    } finally {
      if (wrapperDir.length > 0) {
        fs.rmSync(wrapperDir, { recursive: true, force: true });
      }
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  });

  it("keeps non-zsh shells on the direct login-shell path", () => {
    const env = {
      HOME: "/tmp/home",
      PATH: "/tmp/helper-bin:/usr/bin",
    };

    const launchConfig = createPosixLaunchConfig("/bin/bash", env);

    expect(launchConfig.shellArgs).toEqual(["-i", "-l"]);
    expect(launchConfig.env).toEqual(env);
  });

  it("falls back to a plain login shell for unknown shell names", () => {
    const env = { HOME: "/tmp/home", PATH: "/usr/bin" };

    const launchConfig = createPosixLaunchConfig("/usr/local/bin/fish", env);

    expect(launchConfig.shellArgs).toEqual(["-l"]);
    expect(launchConfig.env).toEqual(env);
  });

  it("skips ZDOTDIR wrapping when no home directory is resolvable", () => {
    const env = { PATH: "/usr/bin" };

    const launchConfig = createPosixLaunchConfig("/bin/zsh", env);

    expect(launchConfig.shellArgs).toEqual(["-l"]);
    expect(launchConfig.env).toEqual(env);
  });
});

describe("createPosixShellAdapter", () => {
  it("exposes the POSIX shell primitives through the adapter interface", () => {
    const adapter = createPosixShellAdapter();

    expect(adapter.resolveDefaultShell({ SHELL: "/bin/bash" })).toBe(
      "/bin/bash",
    );
    expect(adapter.quoteForHookCommand("/tmp/foo bar")).toBe("'/tmp/foo bar'");
    const launchConfig = adapter.createLaunchConfig("/bin/bash", {
      HOME: "/tmp/home",
    });
    expect(launchConfig.shellArgs).toEqual(["-i", "-l"]);
  });
});
