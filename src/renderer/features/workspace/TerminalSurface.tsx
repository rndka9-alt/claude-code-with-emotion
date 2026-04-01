import { FitAddon } from '@xterm/addon-fit';
import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import { Terminal } from '@xterm/xterm';
import type { SessionTab } from './model';

interface TerminalSurfaceProps {
  isActive: boolean;
  session: SessionTab;
}

interface TerminalSize {
  cols: number;
  rows: number;
}

interface ScheduledTask {
  cancel: () => void;
}

function supportsXtermRuntime(): boolean {
  if (typeof window.matchMedia !== 'function') {
    return false;
  }

  const canvas = document.createElement('canvas');

  try {
    return canvas.getContext('2d') !== null;
  } catch {
    return false;
  }
}

function getTerminalSize(terminal: Terminal): TerminalSize {
  return {
    cols: Math.max(2, terminal.cols),
    rows: Math.max(1, terminal.rows),
  };
}

function fitTerminalViewport(
  fitAddon: FitAddon,
  sessionId: string,
  reason: string,
): boolean {
  try {
    fitAddon.fit();
    return true;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown terminal fit error';

    console.warn(
      `Skipped terminal fit for ${sessionId} during ${reason}: ${message}`,
    );
    return false;
  }
}

function scheduleTask(callback: () => void, delayMs: number): ScheduledTask {
  const timeoutId = window.setTimeout(callback, delayMs);

  return {
    cancel: () => {
      window.clearTimeout(timeoutId);
    },
  };
}

export function TerminalSurface({
  isActive,
  session,
}: TerminalSurfaceProps): ReactElement {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);

  useEffect(() => {
    const host = hostRef.current;

    if (host === null) {
      return;
    }

    if (!supportsXtermRuntime()) {
      host.textContent =
        'Terminal preview unavailable in this environment. The typed preload bridge is still wired.';

      return;
    }

    const terminal = new Terminal({
      allowTransparency: true,
      convertEol: true,
      cursorBlink: true,
      fontFamily: '"SF Mono", "Menlo", monospace',
      fontSize: 13,
      lineHeight: 1.3,
      theme: {
        background: '#0b1019',
        foreground: '#f4f7ff',
        brightBlue: '#92bcff',
        blue: '#6a8aff',
        green: '#8fe4b6',
      },
    });
    const fitAddon = new FitAddon();
    const bridge = window.claudeApp?.terminals;
    const scheduledTasks: ScheduledTask[] = [];
    let disposed = false;
    terminalRef.current = terminal;

    terminal.loadAddon(fitAddon);
    terminal.open(host);

    const syncTerminalSize = (): void => {
      const nextSize = getTerminalSize(terminal);

      if (bridge !== undefined) {
        void bridge.resizeSession({
          sessionId: session.id,
          cols: nextSize.cols,
          rows: nextSize.rows,
        });
      }
    };

    const requestFit = (reason: string): void => {
      const task = scheduleTask(() => {
        if (disposed) {
          return;
        }

        const fitSucceeded = fitTerminalViewport(fitAddon, session.id, reason);

        syncTerminalSize();

        if (!fitSucceeded && !disposed) {
          const retryTask = scheduleTask(() => {
            if (disposed) {
              return;
            }

            fitTerminalViewport(fitAddon, session.id, `${reason}-retry`);
            syncTerminalSize();
          }, 32);

          scheduledTasks.push(retryTask);
        }
      }, 0);

      scheduledTasks.push(task);
    };

    const resizeObserver = new ResizeObserver(() => {
      requestFit('resize');
    });

    resizeObserver.observe(host);
    requestFit('initial-open');

    if (bridge !== undefined) {
      const initialSize = getTerminalSize(terminal);

      void bridge
        .bootstrapSession({
          sessionId: session.id,
          title: session.title,
          cwd: session.cwd,
          command: session.command,
          cols: initialSize.cols,
          rows: initialSize.rows,
        })
        .then((response) => {
          terminal.write(response.initialOutput);
        })
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : 'Unknown bootstrap error';

          console.error(`Failed to bootstrap ${session.id}: ${message}`);
          terminal.write(
            `\r\n[terminal bootstrap failed for ${session.id}: ${message}]\r\n`,
          );
        });
    } else {
      terminal.write(
        `No preload bridge detected for ${session.title}\r\n` +
          'The xterm surface is mounted, but Electron IPC is unavailable.\r\n',
      );
    }

    const removeOutputListener =
      bridge?.onOutput((event) => {
        if (event.sessionId === session.id) {
          terminal.write(event.data);
        }
      }) ?? (() => {});

    const inputSubscription = terminal.onData((data) => {
      if (bridge !== undefined) {
        void bridge.sendInput({ sessionId: session.id, data });
      } else {
        terminal.write(data);
      }
    });

    return () => {
      disposed = true;
      inputSubscription.dispose();
      removeOutputListener();
      resizeObserver.disconnect();
      for (const task of scheduledTasks) {
        task.cancel();
      }
      terminal.dispose();
      terminalRef.current = null;
    };
  }, [session.command, session.cwd, session.id, session.title]);

  useEffect(() => {
    if (isActive) {
      terminalRef.current?.focus();
    }
  }, [isActive]);

  return (
    <div className="terminal-surface">
      <div className="terminal-surface__viewport" ref={hostRef} />
    </div>
  );
}
