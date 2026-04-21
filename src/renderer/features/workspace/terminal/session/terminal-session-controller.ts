import { SearchAddon } from "@xterm/addon-search";
import { Terminal } from "@xterm/xterm";
import type { TerminalOutputEvent } from "../../../../../shared/terminal-bridge";
import { DEFAULT_TERMINAL_HISTORY_LINES } from "../../../../../shared/terminal-history";
import type { TerminalSession } from "../../model";
import { handleTerminalShortcut } from "../terminal-keyboard";
import {
  createTerminalSearchNavigationResults,
  createTerminalSearchPreviewResults,
  updateTerminalSearchHighlights,
  type TerminalSearchRequest,
  type TerminalSearchResults,
} from "../search";
import {
  createTerminalContainer,
  getParkingLot,
  handleTerminalExternalBrowserClick,
  scheduleTask,
  type ScheduledTask,
} from "../terminal-dom";
import { createTerminalTheme } from "../terminal-theme";
import {
  arePinnedViewportMetricsEqual,
  createPinnedViewportLineTexts,
  createPinnedViewportMetrics,
  fitTerminalViewport,
  getTerminalSize,
  isModifierOnlyKey,
  isTerminalViewportPinnedToBottom,
  type TerminalPinnedViewportMetrics,
  type TerminalPinnedViewportSnapshot,
  type TerminalSize,
} from "../terminal-viewport";

export interface TerminalMirrorController {
  attach: (host: HTMLDivElement) => void;
  detach: () => void;
  dispose: () => void;
  focus: () => void;
  requestFit: (reason: string) => void;
  syncPinnedViewport: (
    metrics: TerminalPinnedViewportMetrics | null,
  ) => void;
  updateTheme: () => void;
}

export interface TerminalSessionController {
  attach: (
    host: HTMLDivElement,
    onTitleChange: (tabId: string, title: string) => void,
  ) => void;
  createMirrorController: () => TerminalMirrorController;
  detach: () => void;
  focus: () => void;
  requestFit: (reason: string) => void;
  subscribePinnedViewport: (
    listener: (snapshot: TerminalPinnedViewportSnapshot) => void,
  ) => () => void;
  updateTheme: () => void;
  updateTitleChangeHandler: (
    onTitleChange: (tabId: string, title: string) => void,
  ) => void;
  dispose: () => void;
}

export interface TerminalSessionControllerRecord
  extends TerminalSessionController {
  applySearch: (request: TerminalSearchRequest) => void;
  clearSearch: () => void;
  updateSearchResultsHandler: (
    onSearchResultsChange: ((results: TerminalSearchResults) => void) | null,
  ) => void;
}

interface TerminalMirrorControllerRecord extends TerminalMirrorController {
  writeOutput: (data: string) => void;
}

export function createTerminalSessionController(
  session: TerminalSession,
): TerminalSessionControllerRecord {
  const linksBridge = window.claudeApp?.links;
  const bridge = window.claudeApp?.terminals;
  const terminal = new Terminal({
    allowProposedApi: true,
    allowTransparency: true,
    // Claude Code is a full-screen TUI, so keep PTY line endings untouched.
    // Rewriting LF into CRLF causes redraw frames to accumulate as plain text.
    convertEol: false,
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
  const registerTerminalLinks = (targetTerminal: Terminal): void => {
    targetTerminal.registerLinkProvider({
      provideLinks(bufferLineNumber, callback) {
        const line = targetTerminal.buffer.active.getLine(bufferLineNumber);
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
  };

  registerTerminalLinks(terminal);

  const container = createTerminalContainer();
  const bufferedOutputEvents: TerminalOutputEvent[] = [];
  const mirrorControllers = new Set<TerminalMirrorControllerRecord>();
  const pinnedViewportListeners = new Set<
    (snapshot: TerminalPinnedViewportSnapshot) => void
  >();
  let pinnedViewportLineTexts = ["", "", "", "", ""];
  const replayOutputSegments: string[] = [];
  const scheduledTasks: ScheduledTask[] = [];
  let bootstrapCompleted = false;
  let bootstrapStarted = false;
  let disposed = false;
  let host: HTMLDivElement | null = null;
  let manualViewportInteractionAtMs = 0;
  let pinSuggestionVersion = 0;
  let pinnedViewportMetrics: TerminalPinnedViewportMetrics | null = null;
  let restoredOutputVersion = 0;
  let searchResultsChangeHandler:
    | ((results: TerminalSearchResults) => void)
    | null = null;
  let titleChangeHandler: ((tabId: string, title: string) => void) | null =
    null;
  let userScrolledAwayFromBottom = false;

  const emitSearchResults = (results: TerminalSearchResults): void => {
    searchResultsChangeHandler?.({
      ...results,
      sessionId: session.id,
    });
  };

  const emitPinnedViewportSnapshot = (): void => {
    const snapshot = {
      lineTexts: pinnedViewportLineTexts,
      metrics: pinnedViewportMetrics,
      pinSuggestionVersion,
    };

    for (const listener of pinnedViewportListeners) {
      listener(snapshot);
    }
  };

  const updatePinnedViewportMetrics = (): void => {
    const nextPinnedViewportMetrics =
      host === null ? null : createPinnedViewportMetrics(terminal);
    const nextPinnedViewportLineTexts =
      host === null
        ? ["", "", "", "", ""]
        : createPinnedViewportLineTexts(terminal);
    const didMetricsChange = !arePinnedViewportMetricsEqual(
      pinnedViewportMetrics,
      nextPinnedViewportMetrics,
    );
    const didLineTextsChange =
      pinnedViewportLineTexts.length !== nextPinnedViewportLineTexts.length ||
      pinnedViewportLineTexts.some((lineText, index) => {
        const nextLineText = nextPinnedViewportLineTexts[index];

        return nextLineText === undefined || lineText !== nextLineText;
      });

    if (!didMetricsChange && !didLineTextsChange) {
      return;
    }

    pinnedViewportMetrics = nextPinnedViewportMetrics;
    pinnedViewportLineTexts = nextPinnedViewportLineTexts;

    for (const mirrorController of mirrorControllers) {
      mirrorController.syncPinnedViewport(nextPinnedViewportMetrics);
    }

    emitPinnedViewportSnapshot();
  };

  const requestPinSuggestion = (): void => {
    pinSuggestionVersion += 1;
    emitPinnedViewportSnapshot();
  };

  const markManualViewportInteraction = (): void => {
    manualViewportInteractionAtMs = Date.now();
  };

  const appendReplayOutput = (data: string): void => {
    replayOutputSegments.push(data);
  };

  const writeTerminalOutput = (data: string): void => {
    appendReplayOutput(data);
    terminal.write(data, () => {
      updatePinnedViewportMetrics();

      for (const mirrorController of mirrorControllers) {
        mirrorController.writeOutput(data);
      }
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

    for (const mirrorController of mirrorControllers) {
      mirrorController.updateTheme();
    }
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

  terminal.attachCustomKeyEventHandler((event) => {
    if (
      event.type === "keydown" &&
      !isModifierOnlyKey(event.key) &&
      !event.metaKey &&
      !isTerminalViewportPinnedToBottom(terminal)
    ) {
      userScrolledAwayFromBottom = false;
      requestPinSuggestion();
    }

    return handleTerminalShortcut(event, (data) => {
      if (bridge !== undefined) {
        void bridge.sendInput({ sessionId: session.id, data });
        return;
      }

      terminal.write("\r\n");
    });
  });

  const inputSubscription = terminal.onData((data) => {
    if (userScrolledAwayFromBottom) {
      userScrolledAwayFromBottom = false;
      requestPinSuggestion();
    }

    if (bridge !== undefined) {
      void bridge.sendInput({ sessionId: session.id, data });
    } else {
      terminal.write(data);
    }
  });
  const cursorMoveSubscription = terminal.onCursorMove(() => {
    updatePinnedViewportMetrics();
  });
  const scrollSubscription = terminal.onScroll(() => {
    if (Date.now() - manualViewportInteractionAtMs <= 250) {
      userScrolledAwayFromBottom = !isTerminalViewportPinnedToBottom(terminal);
    } else if (isTerminalViewportPinnedToBottom(terminal)) {
      userScrolledAwayFromBottom = false;
    }

    updatePinnedViewportMetrics();
  });
  const titleSubscription = terminal.onTitleChange((nextTitle) => {
    titleChangeHandler?.(session.id, nextTitle);
  });

  function clearSearchResults(): void {
    searchAddon.clearDecorations();
    terminal.clearSelection();
    emitSearchResults({
      hasMatch: false,
      resultCount: null,
      resultIndex: null,
      sessionId: session.id,
    });
  }

  function applySearch(request: TerminalSearchRequest): void {
    if (request.query.length === 0) {
      clearSearchResults();
      return;
    }

    if (request.mode === "preview") {
      updateTerminalSearchHighlights(terminal, searchAddon, request.query);
      emitSearchResults(
        createTerminalSearchPreviewResults(terminal, request.query, session.id),
      );
      return;
    }

    emitSearchResults(
      createTerminalSearchNavigationResults(terminal, request, session.id),
    );
  }

  function applyOutputEvent(event: TerminalOutputEvent): void {
    if (event.outputVersion <= restoredOutputVersion) {
      return;
    }

    restoredOutputVersion = event.outputVersion;
    writeTerminalOutput(event.data);
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
          writeTerminalOutput(response.outputSnapshot);
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
        writeTerminalOutput(
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
        updatePinnedViewportMetrics();
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
        updatePinnedViewportMetrics();
      }, 32);

      scheduledTasks.push(retryTask);
    }, 0);

    scheduledTasks.push(task);
  }

  function createMirrorController(): TerminalMirrorControllerRecord {
    const mirrorTerminal = new Terminal({
      allowProposedApi: true,
      allowTransparency: true,
      cols: Math.max(2, terminal.cols),
      convertEol: false,
      cursorBlink: true,
      fontFamily: '"SF Mono", "Menlo", monospace',
      fontSize: 13,
      lineHeight: 1.3,
      rows: Math.max(1, terminal.rows),
      scrollback: DEFAULT_TERMINAL_HISTORY_LINES,
      theme: createTerminalTheme(),
      linkHandler: {
        activate(_event, uri) {
          void linksBridge?.openExternal(uri);
        },
      },
    });
    const mirrorContainer = createTerminalContainer();
    const mirrorScheduledTasks: ScheduledTask[] = [];
    const focusMirrorTerminal = (): void => {
      mirrorTerminal.focus();
    };
    const syncMirrorViewport = (
      _metrics: TerminalPinnedViewportMetrics | null,
    ): void => {
      // No-op: the mirror runs at primary terminal dimensions.
      // Visual clipping is handled by CSS transform in PinnedTerminalOverlay.
    };
    let mirrorDisposed = false;
    let mirrorHasReplayedOutput = false;
    let mirrorHost: HTMLDivElement | null = null;

    registerTerminalLinks(mirrorTerminal);

    mirrorTerminal.attachCustomKeyEventHandler((event) =>
      handleTerminalShortcut(event, (data) => {
        if (bridge !== undefined) {
          void bridge.sendInput({ sessionId: session.id, data });
          return;
        }

        mirrorTerminal.write("\r\n");
      }),
    );

    const mirrorInputSubscription = mirrorTerminal.onData((data) => {
      if (bridge !== undefined) {
        void bridge.sendInput({ sessionId: session.id, data });
      } else {
        mirrorTerminal.write(data);
      }
    });

    const requestMirrorFit = (_reason: string): void => {
      const task = scheduleTask(() => {
        if (mirrorDisposed) {
          return;
        }

        const primaryCols = Math.max(2, terminal.cols);
        const primaryRows = Math.max(1, terminal.rows);

        if (
          mirrorTerminal.cols !== primaryCols ||
          mirrorTerminal.rows !== primaryRows
        ) {
          mirrorTerminal.resize(primaryCols, primaryRows);
        }
      }, 0);

      mirrorScheduledTasks.push(task);
    };

    const mirrorController: TerminalMirrorControllerRecord = {
      attach(nextHost) {
        if (!mirrorContainer.isConnected) {
          nextHost.replaceChildren(mirrorContainer);
          mirrorTerminal.open(mirrorContainer);
        } else if (mirrorContainer.parentElement !== nextHost) {
          nextHost.replaceChildren(mirrorContainer);
        }

        mirrorHost = nextHost;
        mirrorHost.addEventListener("click", handleTerminalLinkClick, true);
        mirrorHost.addEventListener("mousedown", focusMirrorTerminal);
        mirrorHost.addEventListener("touchstart", focusMirrorTerminal, {
          passive: true,
        });

        if (!mirrorHasReplayedOutput) {
          const replayOutput = replayOutputSegments.join("");

          if (replayOutput.length > 0) {
            mirrorTerminal.write(replayOutput);
          }

          mirrorHasReplayedOutput = true;
        }

        syncMirrorViewport(pinnedViewportMetrics);
        requestMirrorFit("attach");
      },
      detach() {
        if (mirrorHost === null || mirrorDisposed) {
          return;
        }

        mirrorHost.removeEventListener("click", handleTerminalLinkClick, true);
        mirrorHost.removeEventListener("mousedown", focusMirrorTerminal);
        mirrorHost.removeEventListener("touchstart", focusMirrorTerminal);
        getParkingLot().append(mirrorContainer);
        mirrorHost = null;
      },
      dispose() {
        if (mirrorDisposed) {
          return;
        }

        this.detach();
        mirrorDisposed = true;

        for (const task of mirrorScheduledTasks) {
          task.cancel();
        }

        mirrorInputSubscription.dispose();
        mirrorTerminal.dispose();
        mirrorContainer.remove();
        mirrorControllers.delete(mirrorController);
      },
      focus() {
        mirrorTerminal.focus();
      },
      requestFit: requestMirrorFit,
      syncPinnedViewport(metrics) {
        syncMirrorViewport(metrics);
      },
      updateTheme() {
        mirrorTerminal.options.theme = createTerminalTheme();
      },
      writeOutput(data) {
        if (!mirrorHasReplayedOutput) {
          return;
        }

        mirrorTerminal.write(data);
        syncMirrorViewport(pinnedViewportMetrics);
      },
    };

    mirrorControllers.add(mirrorController);

    return mirrorController;
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
      host.addEventListener("mousedown", markManualViewportInteraction);
      host.addEventListener("touchstart", focusTerminal, { passive: true });
      host.addEventListener("touchmove", markManualViewportInteraction, {
        passive: true,
      });
      host.addEventListener("wheel", markManualViewportInteraction, {
        passive: true,
      });
      requestFit("attach");
      updatePinnedViewportMetrics();

      if (bridge === undefined) {
        writeTerminalOutput(
          `No preload bridge detected for ${session.title}\r\n` +
            "The xterm surface is mounted, but Electron IPC is unavailable.\r\n",
        );
      }
    },
    createMirrorController,
    detach() {
      if (host === null || disposed) {
        return;
      }

      host.removeEventListener("click", handleTerminalLinkClick, true);
      host.removeEventListener("mousedown", focusTerminal);
      host.removeEventListener("mousedown", markManualViewportInteraction);
      host.removeEventListener("touchstart", focusTerminal);
      host.removeEventListener("touchmove", markManualViewportInteraction);
      host.removeEventListener("wheel", markManualViewportInteraction);
      getParkingLot().append(container);
      host = null;
      pinnedViewportMetrics = null;
      pinnedViewportLineTexts = ["", "", "", "", ""];
      emitPinnedViewportSnapshot();
    },
    focus() {
      focusTerminal();
    },
    requestFit,
    subscribePinnedViewport(listener) {
      pinnedViewportListeners.add(listener);
      listener({
        lineTexts: pinnedViewportLineTexts,
        metrics: pinnedViewportMetrics,
        pinSuggestionVersion,
      });

      return () => {
        pinnedViewportListeners.delete(listener);
      };
    },
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
      cursorMoveSubscription.dispose();
      inputSubscription.dispose();
      scrollSubscription.dispose();
      titleSubscription.dispose();

      for (const mirrorController of [...mirrorControllers]) {
        mirrorController.dispose();
      }

      terminal.dispose();
      container.remove();
    },
  };
}
