import { Terminal } from '@xterm/xterm';
import type { TerminalOutputEvent } from '../../../shared/terminal-bridge';
import { DEFAULT_TERMINAL_HISTORY_LINES } from '../../../shared/terminal-history';
import { APP_THEME_FALLBACKS } from '../../../shared/theme';
import type { SessionTab } from './model';
import { handleTerminalShortcut } from './terminal-keyboard';

interface TerminalSize {
  cols: number;
  rows: number;
}

interface ScheduledTask {
  cancel: () => void;
}

const terminalThemeFallbacks = {
  background: APP_THEME_FALLBACKS.terminalBackground,
  foreground: APP_THEME_FALLBACKS.terminalForeground,
  brightBlue: APP_THEME_FALLBACKS.terminalBrightBlue,
  blue: APP_THEME_FALLBACKS.terminalBlue,
  green: APP_THEME_FALLBACKS.terminalGreen,
};

export interface TerminalSessionController {
  attach: (
    host: HTMLDivElement,
    onTitleChange: (tabId: string, title: string) => void,
  ) => void;
  detach: () => void;
  focus: () => void;
  requestFit: (reason: string) => void;
  updateTheme: () => void;
  updateTitleChangeHandler: (
    onTitleChange: (tabId: string, title: string) => void,
  ) => void;
  dispose: () => void;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

function getTerminalSize(terminal: Terminal): TerminalSize {
  return {
    cols: Math.max(2, terminal.cols),
    rows: Math.max(1, terminal.rows),
  };
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

function createParkingLot(): HTMLDivElement {
  const parkingLot = document.createElement('div');

  parkingLot.setAttribute('aria-hidden', 'true');
  parkingLot.dataset.terminalParkingLot = 'true';
  parkingLot.style.position = 'fixed';
  parkingLot.style.left = '-10000px';
  parkingLot.style.top = '0';
  parkingLot.style.width = '1px';
  parkingLot.style.height = '1px';
  parkingLot.style.overflow = 'hidden';
  parkingLot.style.pointerEvents = 'none';

  document.body.append(parkingLot);

  return parkingLot;
}

function createTerminalContainer(): HTMLDivElement {
  const container = document.createElement('div');

  container.className = 'terminal-surface__instance';
  container.style.width = '100%';
  container.style.height = '100%';

  return container;
}

const terminalSessionControllers = new Map<string, TerminalSessionController>();
let terminalParkingLot: HTMLDivElement | null = null;

function getParkingLot(): HTMLDivElement {
  if (terminalParkingLot === null || !document.body.contains(terminalParkingLot)) {
    terminalParkingLot = createParkingLot();
  }

  return terminalParkingLot;
}

function readThemeVariable(name: string, fallback: string): string {
  const root = document.documentElement;
  const value = window.getComputedStyle(root).getPropertyValue(name).trim();

  return value.length > 0 ? value : fallback;
}

function createTerminalTheme() {
  return {
    background: readThemeVariable(
      '--color-surface-terminal-theme',
      terminalThemeFallbacks.background,
    ),
    foreground: readThemeVariable(
      '--color-terminal-foreground',
      terminalThemeFallbacks.foreground,
    ),
    brightBlue: readThemeVariable(
      '--color-terminal-bright-blue',
      terminalThemeFallbacks.brightBlue,
    ),
    blue: readThemeVariable(
      '--color-terminal-blue',
      terminalThemeFallbacks.blue,
    ),
    green: readThemeVariable(
      '--color-terminal-green',
      terminalThemeFallbacks.green,
    ),
  };
}

function createTerminalSessionController(
  session: SessionTab,
): TerminalSessionController {
  const bridge = window.claudeApp?.terminals;
  const terminal = new Terminal({
    allowTransparency: true,
    convertEol: true,
    cursorBlink: true,
    fontFamily: '"SF Mono", "Menlo", monospace',
    fontSize: 13,
    lineHeight: 1.3,
    scrollback: DEFAULT_TERMINAL_HISTORY_LINES,
    theme: createTerminalTheme(),
  });
  const container = createTerminalContainer();
  const bufferedOutputEvents: TerminalOutputEvent[] = [];
  const scheduledTasks: ScheduledTask[] = [];
  let bootstrapCompleted = false;
  let bootstrapStarted = false;
  let disposed = false;
  let host: HTMLDivElement | null = null;
  let restoredOutputVersion = 0;
  let titleChangeHandler: ((tabId: string, title: string) => void) | null = null;

  const focusTerminal = (): void => {
    terminal.focus();
  };
  const syncTheme = (): void => {
    terminal.options.theme = createTerminalTheme();
  };
  const removeOutputListener =
    bridge?.onOutput((event) => {
      if (event.sessionId !== session.id) {
        return;
      }

      if (!bootstrapCompleted) {
        bufferedOutputEvents.push(event);
        return;
      }

      applyOutputEvent(event);
    }) ?? (() => {});

  terminal.attachCustomKeyEventHandler((event) =>
    handleTerminalShortcut(event, (data) => {
      if (bridge !== undefined) {
        void bridge.sendInput({ sessionId: session.id, data });
        return;
      }

      terminal.write('\r\n');
    }),
  );

  const inputSubscription = terminal.onData((data) => {
    if (bridge !== undefined) {
      void bridge.sendInput({ sessionId: session.id, data });
    } else {
      terminal.write(data);
    }
  });
  const titleSubscription = terminal.onTitleChange((nextTitle) => {
    titleChangeHandler?.(session.id, nextTitle);
  });

  function applyOutputEvent(event: TerminalOutputEvent): void {
    if (event.outputVersion <= restoredOutputVersion) {
      return;
    }

    restoredOutputVersion = event.outputVersion;
    terminal.write(event.data);
  }

  function flushBufferedOutput(): void {
    bufferedOutputEvents
      .sort((left, right) => left.outputVersion - right.outputVersion)
      .forEach((event) => {
        applyOutputEvent(event);
      });
    bufferedOutputEvents.length = 0;
  }

  function syncTerminalSize(): void {
    if (host === null || bridge === undefined) {
      return;
    }

    const nextSize = getTerminalSize(terminal);

    void bridge.resizeSession({
      sessionId: session.id,
      cols: nextSize.cols,
      rows: nextSize.rows,
    });
  }

  function bootstrapSession(size: TerminalSize): void {
    if (bridge === undefined || bootstrapStarted) {
      return;
    }

    bootstrapStarted = true;

    void bridge
      .bootstrapSession({
        sessionId: session.id,
        title: session.title,
        cwd: session.cwd,
        command: session.command,
        cols: size.cols,
        rows: size.rows,
      })
      .then((response) => {
        if (disposed) {
          return;
        }

        if (response.outputSnapshot.length > 0) {
          terminal.write(response.outputSnapshot);
        }

        restoredOutputVersion = response.outputVersion;
        bootstrapCompleted = true;
        flushBufferedOutput();
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Unknown bootstrap error';

        bootstrapCompleted = true;
        bufferedOutputEvents.length = 0;
        console.error(`Failed to bootstrap ${session.id}: ${message}`);
        terminal.write(
          `\r\n[terminal bootstrap failed for ${session.id}: ${message}]\r\n`,
        );
      });
  }

  function requestFit(reason: string): void {
    const task = scheduleTask(() => {
      if (disposed || host === null) {
        return;
      }

      const nextSize = fitTerminalViewport(terminal, host, session.id, reason);

      if (nextSize !== null) {
        syncTerminalSize();
        bootstrapSession(nextSize);
        return;
      }

      syncTerminalSize();

      if (disposed || host === null) {
        return;
      }

      const retryTask = scheduleTask(() => {
        if (disposed || host === null) {
          return;
        }

        const retrySize = fitTerminalViewport(
          terminal,
          host,
          session.id,
          `${reason}-retry`,
        );
        syncTerminalSize();
        bootstrapSession(retrySize ?? getTerminalSize(terminal));
      }, 32);

      scheduledTasks.push(retryTask);
    }, 0);

    scheduledTasks.push(task);
  }

  return {
    attach(nextHost, onTitleChange) {
      titleChangeHandler = onTitleChange;

      if (!container.isConnected) {
        nextHost.replaceChildren(container);
        terminal.open(container);
      } else if (container.parentElement !== nextHost) {
        nextHost.replaceChildren(container);
      }

      host = nextHost;
      host.addEventListener('mousedown', focusTerminal);
      host.addEventListener('touchstart', focusTerminal, { passive: true });
      requestFit('attach');

      if (bridge === undefined) {
        terminal.write(
          `No preload bridge detected for ${session.title}\r\n` +
            'The xterm surface is mounted, but Electron IPC is unavailable.\r\n',
        );
      }
    },
    detach() {
      if (host === null || disposed) {
        return;
      }

      host.removeEventListener('mousedown', focusTerminal);
      host.removeEventListener('touchstart', focusTerminal);
      getParkingLot().append(container);
      host = null;
    },
    focus() {
      terminal.focus();
    },
    requestFit,
    updateTheme() {
      syncTheme();
    },
    updateTitleChangeHandler(onTitleChange) {
      titleChangeHandler = onTitleChange;
    },
    dispose() {
      if (disposed) {
        return;
      }

      this.detach();
      disposed = true;

      for (const task of scheduledTasks) {
        task.cancel();
      }

      removeOutputListener();
      inputSubscription.dispose();
      titleSubscription.dispose();
      terminal.dispose();
      container.remove();
    },
  };
}

export function getTerminalSessionController(
  session: SessionTab,
): TerminalSessionController {
  const existingController = terminalSessionControllers.get(session.id);

  if (existingController !== undefined) {
    return existingController;
  }

  const controller = createTerminalSessionController(session);

  terminalSessionControllers.set(session.id, controller);

  return controller;
}

export function disposeTerminalSession(sessionId: string): void {
  const controller = terminalSessionControllers.get(sessionId);

  if (controller === undefined) {
    return;
  }

  controller.dispose();
  terminalSessionControllers.delete(sessionId);
}

export function disposeTerminalSessionsExcept(sessionIds: string[]): void {
  const activeSessionIds = new Set(sessionIds);

  for (const sessionId of [...terminalSessionControllers.keys()]) {
    if (activeSessionIds.has(sessionId)) {
      continue;
    }

    disposeTerminalSession(sessionId);
  }
}

export function disposeAllTerminalSessions(): void {
  for (const sessionId of [...terminalSessionControllers.keys()]) {
    disposeTerminalSession(sessionId);
  }

  terminalParkingLot?.remove();
  terminalParkingLot = null;
}

export function syncAllTerminalThemes(): void {
  for (const controller of terminalSessionControllers.values()) {
    controller.updateTheme();
  }
}
