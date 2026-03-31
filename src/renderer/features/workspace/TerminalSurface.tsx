import { FitAddon } from '@xterm/addon-fit';
import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import { Terminal } from 'xterm';
import type { SessionTab } from './model';

interface TerminalSurfaceProps {
  isActive: boolean;
  session: SessionTab;
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
    terminalRef.current = terminal;

    terminal.loadAddon(fitAddon);
    terminal.open(host);

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();

      if (bridge !== undefined) {
        void bridge.resizeSession({
          sessionId: session.id,
          cols: terminal.cols,
          rows: terminal.rows,
        });
      }
    });

    resizeObserver.observe(host);
    fitAddon.fit();

    if (bridge !== undefined) {
      void bridge
        .bootstrapSession({
          sessionId: session.id,
          title: session.title,
          cwd: session.cwd,
          command: session.command,
          cols: terminal.cols,
          rows: terminal.rows,
        })
        .then((response) => {
          terminal.write(response.initialOutput);
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
      inputSubscription.dispose();
      removeOutputListener();
      resizeObserver.disconnect();
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
      <div className="terminal-surface__meta">
        <p className="terminal-surface__eyebrow">Embedded Terminal</p>
        <p className="terminal-surface__copy">
          xterm.js is mounted. The current bridge is mock-backed until node-pty
          takes over in the next step.
        </p>
      </div>
      <div className="terminal-surface__viewport" ref={hostRef} />
    </div>
  );
}
