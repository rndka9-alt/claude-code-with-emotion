import {
  createShellLaunchConfig,
  createRuntimeEnv,
  resolveShell,
  TerminalSessionManager,
} from './session-manager';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
  TerminalBootstrapRequest,
  TerminalInputRequest,
  TerminalResizeRequest,
} from '../../shared/terminal-bridge';

interface FakeRuntimeRecord {
  cols: number;
  cwd: string;
  killed: boolean;
  rows: number;
  shell: string;
  shellArgs: string[];
  writes: string[];
}

function createBootstrapRequest(): TerminalBootstrapRequest {
  return {
    sessionId: 'session-1',
    title: 'main session',
    cwd: '/tmp/app',
    command: 'claude',
    cols: 120,
    rows: 32,
  };
}

describe('resolveShell', () => {
  it('prefers SHELL and falls back to /bin/zsh', () => {
    expect(resolveShell({ SHELL: '/bin/bash' })).toBe('/bin/bash');
    expect(resolveShell({})).toBe('/bin/zsh');
  });
});

describe('createRuntimeEnv', () => {
  it('adds terminal-specific env vars and drops non-string values', () => {
    const env = createRuntimeEnv(
      { HOME: '/tmp/home', PATH: '/usr/bin', INVALID: undefined },
      '/tmp/app',
      '/tmp/helper-bin',
      '/tmp/status.json',
      '/tmp/trace.log',
      '/tmp/visual-assets.json',
    );

    expect(env.PWD).toBe('/tmp/app');
    expect(env.TERM).toBe('xterm-256color');
    expect(env.TERM_PROGRAM).toBe('claude-code-with-emotion');
    expect(env.PATH).toBe('/tmp/helper-bin:/usr/bin');
    expect(env.CLAUDE_WITH_EMOTION_ORIGINAL_PATH).toBe('/usr/bin');
    expect(env.CLAUDE_WITH_EMOTION_HELPER_BIN_DIR).toBe('/tmp/helper-bin');
    expect(env.CLAUDE_WITH_EMOTION_TRACE_FILE).toBe('/tmp/trace.log');
    expect(env.CLAUDE_WITH_EMOTION_VISUAL_ASSET_CATALOG_FILE).toBe(
      '/tmp/visual-assets.json',
    );
    expect(env.CLAUDE_WITH_EMOTION_STATUS_FILE).toBe('/tmp/status.json');
    expect(env.CLAUDE_WITH_EMOTION_HOOK_STATE_FILE).toBe(
      '/tmp/status.json.hook-state.json',
    );
    expect(Object.hasOwn(env, 'INVALID')).toBe(false);
  });
});

describe('createShellLaunchConfig', () => {
  it('wraps zsh startup files so helper commands stay first on PATH', () => {
    const tempHome = fs.mkdtempSync(
      path.join(os.tmpdir(), 'claude-with-emotion-home-'),
    );
    let wrapperDir = '';
    const env = {
      HOME: tempHome,
      PATH: '/tmp/helper-bin:/usr/bin',
      CLAUDE_WITH_EMOTION_ORIGINAL_PATH: '/usr/bin',
      CLAUDE_WITH_EMOTION_STATUS_FILE: '/tmp/status.json',
      CLAUDE_WITH_EMOTION_HOOK_STATE_FILE: '/tmp/status.json.hook-state.json',
      CLAUDE_WITH_EMOTION_TRACE_FILE: '/tmp/trace.log',
      CLAUDE_WITH_EMOTION_VISUAL_ASSET_CATALOG_FILE: '/tmp/visual-assets.json',
    };

    try {
      const launchConfig = createShellLaunchConfig('/bin/zsh', env);
      const zdotDir = launchConfig.env.ZDOTDIR;
      wrapperDir = typeof zdotDir === 'string' ? zdotDir : '';

      expect(launchConfig.shellArgs).toEqual(['-i', '-l']);
      expect(typeof zdotDir).toBe('string');

      if (typeof zdotDir !== 'string') {
        throw new Error('Expected ZDOTDIR to be a string');
      }

      const zshrc = fs.readFileSync(path.join(zdotDir, '.zshrc'), 'utf8');

      expect(zshrc).toContain('. "$HOME/.zshrc"');
      expect(zshrc).toContain(
        "export PATH='/tmp/helper-bin:/usr/bin'",
      );
      expect(zshrc).toContain(
        "export CLAUDE_WITH_EMOTION_STATUS_FILE='/tmp/status.json'",
      );
      expect(zshrc).toContain(
        "export CLAUDE_WITH_EMOTION_HOOK_STATE_FILE='/tmp/status.json.hook-state.json'",
      );
    } finally {
      if (wrapperDir.length > 0) {
        fs.rmSync(wrapperDir, { recursive: true, force: true });
      }
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  });

  it('keeps non-zsh shells on the direct login-shell path', () => {
    const env = {
      HOME: '/tmp/home',
      PATH: '/tmp/helper-bin:/usr/bin',
    };

    const launchConfig = createShellLaunchConfig('/bin/bash', env);

    expect(launchConfig.shellArgs).toEqual(['-i', '-l']);
    expect(launchConfig.env).toEqual(env);
  });
});

describe('TerminalSessionManager', () => {
  it('bootstraps a runtime without auto-launching the requested command', () => {
    const createdRuntimes: FakeRuntimeRecord[] = [];
    const outputEvents: string[] = [];
    const manager = new TerminalSessionManager(
      ({ cols, rows, cwd, shell, shellArgs }) => {
        const dataListeners = new Set<(data: string) => void>();
        const exitListeners = new Set<
          (event: { exitCode: number; signal: number }) => void
        >();
        const record: FakeRuntimeRecord = {
          cols,
          cwd,
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

            if (data === 'ping\r') {
              for (const listener of dataListeners) {
                listener('pong');
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
      (sessionId, data) => {
        outputEvents.push(`${sessionId}:${data}`);
      },
      () => {},
      '/tmp/helper-bin',
      '/tmp/status.json',
      '/tmp/trace.log',
      '/tmp/visual-assets.json',
    );

    const response = manager.bootstrapSession(createBootstrapRequest());

    expect(createdRuntimes).toHaveLength(1);
    expect(createdRuntimes[0]?.writes).toEqual([]);
    expect(response.initialOutput).toContain('Shell ready');

    const inputRequest: TerminalInputRequest = {
      sessionId: 'session-1',
      data: 'ping\r',
    };

    manager.sendInput(inputRequest);

    expect(outputEvents).toContain('session-1:pong');

    const resizeRequest: TerminalResizeRequest = {
      sessionId: 'session-1',
      cols: 140,
      rows: 40,
    };

    manager.resizeSession(resizeRequest);

    expect(createdRuntimes[0]?.cols).toBe(140);
    expect(createdRuntimes[0]?.rows).toBe(40);

    manager.dispose();

    expect(createdRuntimes[0]?.killed).toBe(true);
  });

  it('closes a specific session runtime when asked explicitly', () => {
    const createdRuntimes: FakeRuntimeRecord[] = [];
    const manager = new TerminalSessionManager(
      ({ cols, rows, cwd, shell, shellArgs }) => {
        const dataListeners = new Set<(data: string) => void>();
        const exitListeners = new Set<
          (event: { exitCode: number; signal: number }) => void
        >();
        const record: FakeRuntimeRecord = {
          cols,
          cwd,
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
      '/tmp/helper-bin',
      '/tmp/status.json',
      '/tmp/trace.log',
      '/tmp/visual-assets.json',
    );

    manager.bootstrapSession(createBootstrapRequest());
    manager.closeSession({ sessionId: 'session-1' });

    expect(createdRuntimes[0]?.killed).toBe(true);
  });
});
