import {
  createRuntimeEnv,
  TerminalSessionManager,
} from "./session-manager";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  TerminalBootstrapRequest,
  TerminalInputRequest,
  TerminalResizeRequest,
} from "../../shared/terminal-bridge";

interface FakeRuntimeRecord {
  cols: number;
  cwd: string;
  env: Record<string, string>;
  killed: boolean;
  rows: number;
  shell: string;
  shellArgs: string[];
  writes: string[];
}

function createBootstrapRequest(): TerminalBootstrapRequest {
  return {
    sessionId: "session-1",
    title: "main session",
    cwd: "/tmp/app",
    command: "claude",
    cols: 120,
    rows: 32,
  };
}

describe("createRuntimeEnv", () => {
  it("adds terminal-specific env vars and drops non-string values", () => {
    const env = createRuntimeEnv(
      { HOME: "/tmp/home", PATH: "/usr/bin", INVALID: undefined },
      "/tmp/app",
      "/tmp/helper-bin",
      "/tmp/status.json",
      "/tmp/trace.log",
      "/tmp/visual-assets.json",
      "/tmp/visual-overlay.json",
    );

    expect(env.PWD).toBe("/tmp/app");
    expect(env.TERM).toBe("screen-256color");
    expect(env.TERM_PROGRAM).toBe("claude-code-with-emotion");
    expect(env.HEADLINE_INFO_MODE).toBe("prompt");
    expect(env.HEADLINE_LINE_MODE).toBe("off");
    expect(env.HEADLINE_DO_CLOCK).toBe("false");
    expect(env.PATH).toBe("/tmp/helper-bin:/usr/bin");
    expect(env.CLAUDE_WITH_EMOTION_ORIGINAL_PATH).toBe("/usr/bin");
    expect(env.CLAUDE_WITH_EMOTION_HELPER_BIN_DIR).toBe("/tmp/helper-bin");
    expect(env.CLAUDE_WITH_EMOTION_TRACE_FILE).toBe("/tmp/trace.log");
    expect(env.CLAUDE_WITH_EMOTION_VISUAL_ASSET_CATALOG_FILE).toBe(
      "/tmp/visual-assets.json",
    );
    expect(env.CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE).toBe(
      "/tmp/visual-overlay.json",
    );
    expect(env.CLAUDE_WITH_EMOTION_STATUS_FILE).toBe("/tmp/status.json");
    expect(env.CLAUDE_WITH_EMOTION_HOOK_STATE_FILE).toBe(
      "/tmp/status.json.hook-state.json",
    );
    expect(Object.hasOwn(env, "INVALID")).toBe(false);
  });

  it("preserves an existing headline mode override", () => {
    const env = createRuntimeEnv(
      {
        HEADLINE_INFO_MODE: "precmd",
        HEADLINE_LINE_MODE: "on",
        HEADLINE_DO_CLOCK: "true",
        HOME: "/tmp/home",
        PATH: "/usr/bin",
      },
      "/tmp/app",
      "/tmp/helper-bin",
      "/tmp/status.json",
      "/tmp/trace.log",
      "/tmp/visual-assets.json",
      "/tmp/visual-overlay.json",
    );

    expect(env.HEADLINE_INFO_MODE).toBe("precmd");
    expect(env.HEADLINE_LINE_MODE).toBe("on");
    expect(env.HEADLINE_DO_CLOCK).toBe("true");
  });
});

describe("TerminalSessionManager", () => {
  it("bootstraps a runtime and auto-launches the requested command", () => {
    const createdRuntimes: FakeRuntimeRecord[] = [];
    const outputEvents: string[] = [];
    const outputRootDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "claude-terminal-session-output-"),
    );
    const manager = new TerminalSessionManager(
      ({ cols, rows, cwd, env, shell, shellArgs }) => {
        const dataListeners = new Set<(data: string) => void>();
        const exitListeners = new Set<
          (event: { exitCode: number; signal: number }) => void
        >();
        const record: FakeRuntimeRecord = {
          cols,
          cwd,
          env,
          killed: false,
          rows,
          shell,
          shellArgs,
          writes: [],
        };

        createdRuntimes.push(record);

        return {
          write: (data) => {
            record.writes.push(data);

            if (data === "ping\r") {
              for (const listener of dataListeners) {
                listener("pong");
              }
            }
          },
          resize: (nextCols, nextRows) => {
            record.cols = nextCols;
            record.rows = nextRows;
          },
          kill: () => {
            record.killed = true;

            for (const listener of exitListeners) {
              listener({ exitCode: 0, signal: 0 });
            }
          },
          onData: (listener) => {
            dataListeners.add(listener);

            return {
              dispose: () => {
                dataListeners.delete(listener);
              },
            };
          },
          onExit: (listener) => {
            exitListeners.add(listener);

            return {
              dispose: () => {
                exitListeners.delete(listener);
              },
            };
          },
        };
      },
      (sessionId, event) => {
        outputEvents.push(`${sessionId}:${event.outputVersion}:${event.data}`);
      },
      () => {},
      "/tmp/helper-bin",
      "/tmp/trace.log",
      "/tmp/visual-assets.json",
      outputRootDir,
    );
    try {
      const response = manager.bootstrapSession(
        createBootstrapRequest(),
        "/tmp/status.json",
        "/tmp/visual-overlay.json",
      );

      expect(createdRuntimes).toHaveLength(1);
      expect(createdRuntimes[0]?.writes).toEqual(["claude\r"]);
      expect(response).toEqual({
        outputSnapshot: "",
        outputVersion: 0,
      });
      const inputRequest: TerminalInputRequest = {
        sessionId: "session-1",
        data: "ping\r",
      };

      manager.sendInput(inputRequest);

      expect(outputEvents).toContain("session-1:1:pong");
      expect(
        manager.bootstrapSession(
          createBootstrapRequest(),
          "/tmp/status.json",
          "/tmp/visual-overlay.json",
        ),
      ).toEqual({
        outputSnapshot: "pong",
        outputVersion: 1,
      });

      const resizeRequest: TerminalResizeRequest = {
        sessionId: "session-1",
        cols: 140,
        rows: 40,
      };

      manager.resizeSession(resizeRequest);

      expect(createdRuntimes[0]?.cols).toBe(140);
      expect(createdRuntimes[0]?.rows).toBe(40);

      manager.dispose();

      expect(createdRuntimes[0]?.killed).toBe(true);
      expect(
        fs.readFileSync(path.join(outputRootDir, "session-1.log"), "utf8"),
      ).toBe("pong");
    } finally {
      fs.rmSync(outputRootDir, { recursive: true, force: true });
    }
  });

  it("closes a specific session runtime when asked explicitly", () => {
    const createdRuntimes: FakeRuntimeRecord[] = [];
    const outputRootDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "claude-terminal-session-output-"),
    );
    const manager = new TerminalSessionManager(
      ({ cols, rows, cwd, env, shell, shellArgs }) => {
        const dataListeners = new Set<(data: string) => void>();
        const exitListeners = new Set<
          (event: { exitCode: number; signal: number }) => void
        >();
        const record: FakeRuntimeRecord = {
          cols,
          cwd,
          env,
          killed: false,
          rows,
          shell,
          shellArgs,
          writes: [],
        };

        createdRuntimes.push(record);

        return {
          write: () => {},
          resize: () => {},
          kill: () => {
            record.killed = true;

            for (const listener of exitListeners) {
              listener({ exitCode: 0, signal: 0 });
            }
          },
          onData: (listener) => {
            dataListeners.add(listener);

            return {
              dispose: () => {
                dataListeners.delete(listener);
              },
            };
          },
          onExit: (listener) => {
            exitListeners.add(listener);

            return {
              dispose: () => {
                exitListeners.delete(listener);
              },
            };
          },
        };
      },
      () => {},
      () => {},
      "/tmp/helper-bin",
      "/tmp/trace.log",
      "/tmp/visual-assets.json",
      outputRootDir,
    );
    try {
      manager.bootstrapSession(
        createBootstrapRequest(),
        "/tmp/status.json",
        "/tmp/visual-overlay.json",
      );
      manager.closeSession({ sessionId: "session-1" });

      expect(createdRuntimes[0]?.killed).toBe(true);
    } finally {
      fs.rmSync(outputRootDir, { recursive: true, force: true });
    }
  });
});
