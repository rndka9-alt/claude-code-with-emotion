import { createRuntimeEnv, TerminalSessionManager } from "./manager";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ENV_KEYS } from "../../../shared/env-keys";
import type { AssistantProvider } from "../assistant-provider";
import type {
  TerminalBootstrapRequest,
  TerminalInputRequest,
  TerminalResizeRequest,
} from "../../../shared/terminal-bridge";

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
      "/tmp/event-queue",
      "/tmp/trace.log",
      "/tmp/visual-assets.json",
    );

    expect(env.PWD).toBe("/tmp/app");
    expect(env.TERM).toBe("screen-256color");
    expect(env.TERM_PROGRAM).toBe("claude-code-with-emotion");
    expect(env.HEADLINE_INFO_MODE).toBe("prompt");
    expect(env.HEADLINE_LINE_MODE).toBe("off");
    expect(env.HEADLINE_DO_CLOCK).toBe("false");
    expect(env.PATH).toBe("/tmp/helper-bin:/usr/bin");
    expect(env[ENV_KEYS.ORIGINAL_PATH]).toBe("/usr/bin");
    expect(env[ENV_KEYS.HELPER_BIN_DIR]).toBe("/tmp/helper-bin");
    expect(env[ENV_KEYS.TRACE_FILE]).toBe("/tmp/trace.log");
    expect(env[ENV_KEYS.VISUAL_ASSET_CATALOG_FILE]).toBe(
      "/tmp/visual-assets.json",
    );
    expect(env[ENV_KEYS.EVENT_QUEUE_DIR]).toBe("/tmp/event-queue");
    expect(env[ENV_KEYS.HOOK_STATE_FILE]).toBe(
      "/tmp/event-queue.hook-state.json",
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
      "/tmp/event-queue",
      "/tmp/trace.log",
      "/tmp/visual-assets.json",
    );

    expect(env.HEADLINE_INFO_MODE).toBe("precmd");
    expect(env.HEADLINE_LINE_MODE).toBe("on");
    expect(env.HEADLINE_DO_CLOCK).toBe("true");
  });
});

describe("TerminalSessionManager", () => {
  it("bootstraps a runtime and auto-launches the requested command", async () => {
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
      "/tmp/user-data",
    );
    try {
      const response = await manager.bootstrapSession(
        createBootstrapRequest(),
        "/tmp/event-queue",
      );

      expect(createdRuntimes).toHaveLength(1);
      expect(createdRuntimes[0]?.writes).toEqual(["claude\r"]);
      expect(createdRuntimes[0]?.env[ENV_KEYS.HOOKS_SETTINGS_FILE]).toBe(
        path.join("/tmp/user-data", "claude-hooks", "settings.json"),
      );
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
        await manager.bootstrapSession(
          createBootstrapRequest(),
          "/tmp/event-queue",
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

  it("lets an assistant provider add session-specific environment", async () => {
    const createdRuntimes: FakeRuntimeRecord[] = [];
    const outputRootDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "assistant-provider-session-output-"),
    );
    const assistantProvider: AssistantProvider = {
      displayName: "Test Assistant",
      features: {
        sessionStatus: false,
        visualMcpSetup: false,
      },
      id: "test-assistant",
      launchCommand: "test-assistant",
      createSessionEnvironment: ({ eventQueueDir }) => {
        return {
          TEST_ASSISTANT_EVENT_QUEUE_DIR: eventQueueDir,
        };
      },
      mcpSetup: {
        getStatus: (stateFilePath) => {
          return { installed: false, stateFilePath };
        },
        install: (_helperBinDir, stateFilePath) => {
          return { installed: true, stateFilePath };
        },
        remove: (stateFilePath) => {
          return { installed: false, stateFilePath };
        },
      },
    };
    const manager = new TerminalSessionManager(
      ({ cols, rows, cwd, env, shell, shellArgs }) => {
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
          },
          resize: () => {},
          kill: () => {
            record.killed = true;
          },
          onData: () => {
            return {
              dispose: () => {},
            };
          },
          onExit: () => {
            return {
              dispose: () => {},
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
      "/tmp/user-data",
      assistantProvider,
    );
    try {
      await manager.bootstrapSession(
        createBootstrapRequest(),
        "/tmp/provider-event-queue",
      );

      expect(createdRuntimes[0]?.env.TEST_ASSISTANT_EVENT_QUEUE_DIR).toBe(
        "/tmp/provider-event-queue",
      );
    } finally {
      manager.dispose();
      fs.rmSync(outputRootDir, { recursive: true, force: true });
    }
  });

  it("closes a specific session runtime when asked explicitly", async () => {
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
      "/tmp/user-data",
    );
    try {
      await manager.bootstrapSession(
        createBootstrapRequest(),
        "/tmp/event-queue",
      );
      manager.closeSession({ sessionId: "session-1" });

      expect(createdRuntimes[0]?.killed).toBe(true);
    } finally {
      fs.rmSync(outputRootDir, { recursive: true, force: true });
    }
  });
});
