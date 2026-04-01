import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import { Terminal } from '@xterm/xterm';
import type { SessionTab } from './model';
import { handleTerminalShortcut } from './terminal-keyboard';

interface TerminalSurfaceProps {
  isActive: boolean;
  session: SessionTab;
  onTitleChange: (tabId: string, title: string) => void;
}

interface TerminalSize {
  cols: number;
  rows: number;
}

interface ScheduledTask {
  cancel: () => void;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

function readNestedNumber(
  value: unknown,
  keys: string[],
): number | null {
  let current: unknown = value;

  for (const key of keys) {
    if (!isObjectRecord(current)) {
      return null;
    }

    current = current[key];
  }

  return typeof current === 'number' && Number.isFinite(current)
    ? current
    : null;
}

function measureTerminalSize(
  terminal: Terminal,
  host: HTMLDivElement,
): TerminalSize | null {
  const core = Reflect.get(terminal, '_core');
  const cellWidth = readNestedNumber(core, [
    '_renderService',
    'dimensions',
    'css',
    'cell',
    'width',
  ]);
  const cellHeight = readNestedNumber(core, [
    '_renderService',
    'dimensions',
    'css',
    'cell',
    'height',
  ]);

  if (
    cellWidth === null ||
    cellHeight === null ||
    cellWidth <= 0 ||
    cellHeight <= 0
  ) {
    return null;
  }

  const scrollBarWidth =
    terminal.options.scrollback === 0
      ? 0
      : readNestedNumber(core, ['viewport', 'scrollBarWidth']) ?? 0;
  const cols = Math.max(
    2,
    Math.floor((host.clientWidth - scrollBarWidth) / cellWidth),
  );
  const rows = Math.max(1, Math.floor(host.clientHeight / cellHeight));

  return {
    cols,
    rows,
  };
}

function fitTerminalViewport(
  terminal: Terminal,
  host: HTMLDivElement,
  sessionId: string,
  reason: string,
): TerminalSize | null {
  try {
    const nextSize = measureTerminalSize(terminal, host);

    if (nextSize === null) {
      return null;
    }

    if (terminal.cols !== nextSize.cols || terminal.rows !== nextSize.rows) {
      terminal.resize(nextSize.cols, nextSize.rows);
    }

    return nextSize;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown terminal fit error';

    console.warn(
      `Skipped terminal fit for ${sessionId} during ${reason}: ${message}`,
    );
    return null;
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
  onTitleChange,
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
    const bridge = window.claudeApp?.terminals;
    const scheduledTasks: ScheduledTask[] = [];
    let disposed = false;
    terminalRef.current = terminal;

    terminal.open(host);

    terminal.attachCustomKeyEventHandler((event) =>
      handleTerminalShortcut(event, (data) => {
        if (bridge !== undefined) {
          void bridge.sendInput({ sessionId: session.id, data });
          return;
        }

        terminal.write('\r\n');
      }),
    );

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

        const nextSize = fitTerminalViewport(terminal, host, session.id, reason);

        if (nextSize !== null) {
          syncTerminalSize();
          return;
        }

        syncTerminalSize();

        if (!disposed) {
          const retryTask = scheduleTask(() => {
            if (disposed) {
              return;
            }

            fitTerminalViewport(terminal, host, session.id, `${reason}-retry`);
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
    const titleSubscription = terminal.onTitleChange((nextTitle) => {
      onTitleChange(session.id, nextTitle);
    });

    return () => {
      disposed = true;
      inputSubscription.dispose();
      titleSubscription.dispose();
      removeOutputListener();
      resizeObserver.disconnect();
      for (const task of scheduledTasks) {
        task.cancel();
      }
      terminal.dispose();
      terminalRef.current = null;
    };
  }, [onTitleChange, session.command, session.cwd, session.id, session.title]);

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
