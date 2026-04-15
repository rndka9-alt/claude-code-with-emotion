import {
  SearchAddon,
  type ISearchOptions,
  type ISearchResultChangeEvent,
} from "@xterm/addon-search";
import { Terminal } from "@xterm/xterm";
import type { TerminalOutputEvent } from "../../../../shared/terminal-bridge";
import { DEFAULT_TERMINAL_HISTORY_LINES } from "../../../../shared/terminal-history";
import { APP_THEME_FALLBACKS } from "../../../../shared/theme";
import type { TerminalSession } from "../model";
import { handleTerminalShortcut } from "./terminal-keyboard";
import type {
  TerminalSearchRequest,
  TerminalSearchResults,
} from "./search";

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

const terminalSearchFallbacks = {
  activeMatchBackground: "#36528a",
  activeMatchBorder: "#92bcff",
  activeMatchOverviewRuler: "#92bcff",
  matchBackground: "#21324e",
  matchBorder: "#6a8aff",
  matchOverviewRuler: "#6a8aff",
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

interface TerminalSessionControllerRecord extends TerminalSessionController {
  applySearch: (request: TerminalSearchRequest) => void;
  clearSearch: () => void;
  updateSearchResultsHandler: (
    onSearchResultsChange: ((results: TerminalSearchResults) => void) | null,
  ) => void;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNestedNumber(value: unknown, keys: string[]): number | null {
  let current: unknown = value;

  for (const key of keys) {
    if (!isObjectRecord(current)) {
      return null;
    }

    current = current[key];
  }

  return typeof current === "number" && Number.isFinite(current)
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
  const core = Reflect.get(terminal, "_core");
  const cellWidth = readNestedNumber(core, [
    "_renderService",
    "dimensions",
    "css",
    "cell",
    "width",
  ]);
  const cellHeight = readNestedNumber(core, [
    "_renderService",
    "dimensions",
    "css",
    "cell",
    "height",
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
      : (readNestedNumber(core, ["viewport", "scrollBarWidth"]) ?? 0);
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
      error instanceof Error ? error.message : "Unknown terminal fit error";

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
  const parkingLot = document.createElement("div");

  parkingLot.setAttribute("aria-hidden", "true");
  parkingLot.dataset.terminalParkingLot = "true";
  parkingLot.style.position = "fixed";
  parkingLot.style.left = "-10000px";
  parkingLot.style.top = "0";
  parkingLot.style.width = "1px";
  parkingLot.style.height = "1px";
  parkingLot.style.overflow = "hidden";
  parkingLot.style.pointerEvents = "none";

  document.body.append(parkingLot);

  return parkingLot;
}

function createTerminalContainer(): HTMLDivElement {
  const container = document.createElement("div");

  container.className = "terminal-surface__instance";
  container.style.width = "100%";
  container.style.height = "100%";

  return container;
}

function isExternalBrowserHref(href: string): boolean {
  try {
    const protocol = new URL(href).protocol;

    return (
      protocol === "http:" || protocol === "https:" || protocol === "vscode:"
    );
  } catch {
    return false;
  }
}

export function handleTerminalExternalBrowserClick(
  event: Pick<MouseEvent, "defaultPrevented" | "preventDefault" | "target">,
  openExternal: ((url: string) => Promise<void>) | undefined,
): void {
  if (event.defaultPrevented || !(event.target instanceof Element)) {
    return;
  }

  const anchor = event.target.closest("a[href]");

  if (
    !(anchor instanceof HTMLAnchorElement) ||
    !isExternalBrowserHref(anchor.href)
  ) {
    return;
  }

  event.preventDefault();
  void openExternal?.(anchor.href);
}

const terminalSessionControllers = new Map<
  string,
  TerminalSessionControllerRecord
>();
let terminalParkingLot: HTMLDivElement | null = null;

function getParkingLot(): HTMLDivElement {
  if (
    terminalParkingLot === null ||
    !document.body.contains(terminalParkingLot)
  ) {
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
      "--color-surface-terminal-theme",
      terminalThemeFallbacks.background,
    ),
    foreground: readThemeVariable(
      "--color-terminal-foreground",
      terminalThemeFallbacks.foreground,
    ),
    brightBlue: readThemeVariable(
      "--color-terminal-bright-blue",
      terminalThemeFallbacks.brightBlue,
    ),
    blue: readThemeVariable(
      "--color-terminal-blue",
      terminalThemeFallbacks.blue,
    ),
    green: readThemeVariable(
      "--color-terminal-green",
      terminalThemeFallbacks.green,
    ),
  };
}

function createTerminalSearchOptions(): ISearchOptions {
  return {
    decorations: {
      activeMatchBackground: readThemeVariable(
        "--color-terminal-blue",
        terminalSearchFallbacks.activeMatchBackground,
      ),
      activeMatchBorder: readThemeVariable(
        "--color-terminal-bright-blue",
        terminalSearchFallbacks.activeMatchBorder,
      ),
      activeMatchColorOverviewRuler: readThemeVariable(
        "--color-terminal-bright-blue",
        terminalSearchFallbacks.activeMatchOverviewRuler,
      ),
      matchBackground: readThemeVariable(
        "--color-avatar-working",
        terminalSearchFallbacks.matchBackground,
      ),
      matchBorder: readThemeVariable(
        "--color-terminal-blue",
        terminalSearchFallbacks.matchBorder,
      ),
      matchOverviewRuler: readThemeVariable(
        "--color-terminal-blue",
        terminalSearchFallbacks.matchOverviewRuler,
      ),
    },
    incremental: true,
  };
}

function createTerminalSessionController(
  session: TerminalSession,
): TerminalSessionControllerRecord {
  const linksBridge = window.claudeApp?.links;
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
    // OSC 8 하이퍼링크 클릭 시 기본 window.open 대신 shell.openExternal 사용
    linkHandler: {
      activate(_event, uri) {
        void linksBridge?.openExternal(uri);
      },
    },
  });
  const searchAddon = new SearchAddon();

  terminal.loadAddon(searchAddon);

  // 터미널 텍스트에서 URL을 감지해 Cmd+클릭으로 열 수 잇게 하는 링크 프로바이더
  const LINKABLE_URL_REGEX = /https?:\/\/[^\s)>\]"']+|vscode:\/\/[^\s)>\]"']+/g;
  terminal.registerLinkProvider({
    provideLinks(bufferLineNumber, callback) {
      const line = terminal.buffer.active.getLine(bufferLineNumber);
      if (!line) {
        callback(undefined);
        return;
      }

      const text = line.translateToString();
      const links: Array<{
        range: {
          start: { x: number; y: number };
          end: { x: number; y: number };
        };
        text: string;
        activate: (_event: MouseEvent, linkText: string) => void;
      }> = [];

      LINKABLE_URL_REGEX.lastIndex = 0;
      let match;
      while ((match = LINKABLE_URL_REGEX.exec(text)) !== null) {
        const url = match[0];
        links.push({
          range: {
            start: { x: match.index + 1, y: bufferLineNumber },
            end: { x: match.index + url.length, y: bufferLineNumber },
          },
          text: url,
          activate(_event, linkText) {
            void linksBridge?.openExternal(linkText);
          },
        });
      }

      callback(links.length > 0 ? links : undefined);
    },
  });

  const container = createTerminalContainer();
  const bufferedOutputEvents: TerminalOutputEvent[] = [];
  const scheduledTasks: ScheduledTask[] = [];
  let bootstrapCompleted = false;
  let bootstrapStarted = false;
  let disposed = false;
  let host: HTMLDivElement | null = null;
  let restoredOutputVersion = 0;
  let searchResultsChangeHandler:
    | ((results: TerminalSearchResults) => void)
    | null = null;
  let titleChangeHandler: ((tabId: string, title: string) => void) | null =
    null;

  const emitSearchResults = (event: ISearchResultChangeEvent): void => {
    searchResultsChangeHandler?.({
      resultCount: event.resultCount,
      resultIndex: event.resultIndex,
      sessionId: session.id,
    });
  };

  const focusTerminal = (): void => {
    terminal.focus();
  };
  const handleTerminalLinkClick = (event: MouseEvent): void => {
    handleTerminalExternalBrowserClick(event, linksBridge?.openExternal);
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

      terminal.write("\r\n");
    }),
  );

  const inputSubscription = terminal.onData((data) => {
    if (bridge !== undefined) {
      void bridge.sendInput({ sessionId: session.id, data });
    } else {
      terminal.write(data);
    }
  });
  const searchResultsSubscription = searchAddon.onDidChangeResults(
    (event: ISearchResultChangeEvent) => {
      emitSearchResults(event);
    },
  );
  const titleSubscription = terminal.onTitleChange((nextTitle) => {
    titleChangeHandler?.(session.id, nextTitle);
  });

  function clearSearchResults(): void {
    searchAddon.clearDecorations();
    searchResultsChangeHandler?.({
      resultCount: 0,
      resultIndex: -1,
      sessionId: session.id,
    });
  }

  function applySearch(request: TerminalSearchRequest): void {
    if (request.query.length === 0) {
      clearSearchResults();
      return;
    }

    const searchOptions = createTerminalSearchOptions();

    if (request.direction === "previous") {
      searchAddon.findPrevious(request.query, searchOptions);
      return;
    }

    searchAddon.findNext(request.query, searchOptions);
  }

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
          error instanceof Error ? error.message : "Unknown bootstrap error";

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
      host.addEventListener("click", handleTerminalLinkClick, true);
      host.addEventListener("mousedown", focusTerminal);
      host.addEventListener("touchstart", focusTerminal, { passive: true });
      requestFit("attach");

      if (bridge === undefined) {
        terminal.write(
          `No preload bridge detected for ${session.title}\r\n` +
            "The xterm surface is mounted, but Electron IPC is unavailable.\r\n",
        );
      }
    },
    detach() {
      if (host === null || disposed) {
        return;
      }

      host.removeEventListener("click", handleTerminalLinkClick, true);
      host.removeEventListener("mousedown", focusTerminal);
      host.removeEventListener("touchstart", focusTerminal);
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
    applySearch,
    clearSearch() {
      clearSearchResults();
    },
    updateSearchResultsHandler(onSearchResultsChange) {
      searchResultsChangeHandler = onSearchResultsChange;
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
      searchResultsSubscription.dispose();
      titleSubscription.dispose();
      terminal.dispose();
      container.remove();
    },
  };
}

export function getTerminalSessionController(
  session: TerminalSession,
): TerminalSessionController {
  const existingController = terminalSessionControllers.get(session.id);

  if (existingController !== undefined) {
    return existingController;
  }

  const controller = createTerminalSessionController(session);

  terminalSessionControllers.set(session.id, controller);

  return controller;
}

export function applyTerminalSessionSearch(
  session: TerminalSession,
  request: TerminalSearchRequest,
): void {
  const controller = terminalSessionControllers.get(session.id);

  if (controller === undefined) {
    return;
  }

  controller.applySearch(request);
}

export function clearTerminalSessionSearch(session: TerminalSession): void {
  const controller = terminalSessionControllers.get(session.id);

  if (controller === undefined) {
    return;
  }

  controller.clearSearch();
}

export function updateTerminalSessionSearchResultsHandler(
  session: TerminalSession,
  onSearchResultsChange: ((results: TerminalSearchResults) => void) | null,
): void {
  const controller = terminalSessionControllers.get(session.id);

  if (controller === undefined) {
    return;
  }

  controller.updateSearchResultsHandler(onSearchResultsChange);
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
