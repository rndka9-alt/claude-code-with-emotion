import {
  createRuntimeEnv,
  resolveShell,
  TerminalSessionManager,
} from './session-manager';
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
    );

    expect(env.PWD).toBe('/tmp/app');
    expect(env.TERM).toBe('xterm-256color');
    expect(env.TERM_PROGRAM).toBe('claude-code-with-emotion');
    expect(env.PATH).toBe('/tmp/helper-bin:/usr/bin');
    expect(env.CLAUDE_WITH_EMOTION_ORIGINAL_PATH).toBe('/usr/bin');
    expect(env.CLAUDE_WITH_EMOTION_TRACE_FILE).toBe('/tmp/trace.log');
    expect(env.CLAUDE_WITH_EMOTION_STATUS_FILE).toBe('/tmp/status.json');
    expect(Object.hasOwn(env, 'INVALID')).toBe(false);
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
      '/tmp/helper-bin',
      '/tmp/status.json',
      '/tmp/trace.log',
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
});
