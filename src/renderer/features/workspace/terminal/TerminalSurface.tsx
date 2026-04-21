import { Pin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { TerminalSession } from "../model";
import { PinnedTerminalOverlay } from "./PinnedTerminalOverlay";
import type { TerminalSearchRequest, TerminalSearchResults } from "./search";
import {
  applyTerminalSessionSearch,
  clearTerminalSessionSearch,
  getTerminalSessionController,
  updateTerminalSessionSearchResultsHandler,
} from "./session";
import type { TerminalPinnedViewportMetrics } from "./terminal-viewport";

interface TerminalSurfaceProps {
  focusRequestKey: number;
  isActive: boolean;
  onFocusPane: (paneId: string) => void;
  onSearchResultsChange: (results: TerminalSearchResults) => void;
  onTitleChange: (sessionId: string, title: string) => void;
  paneId: string;
  searchRequest: TerminalSearchRequest | null;
  session: TerminalSession;
}

function supportsXtermRuntime(): boolean {
  if (typeof window.matchMedia !== "function") {
    return false;
  }

  const canvas = document.createElement("canvas");

  try {
    return canvas.getContext("2d") !== null;
  } catch {
    return false;
  }
}

export function TerminalSurface({
  focusRequestKey,
  isActive,
  onFocusPane,
  onSearchResultsChange,
  onTitleChange,
  paneId,
  searchRequest,
  session,
}: TerminalSurfaceProps): ReactElement {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const lastAppliedSearchSequenceRef = useRef<number | null>(null);
  const pinSuggestionHideTaskRef = useRef<number | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [isPinSuggestionVisible, setIsPinSuggestionVisible] = useState(false);
  const [pinSuggestionVersion, setPinSuggestionVersion] = useState(0);
  const [pinnedViewportMetrics, setPinnedViewportMetrics] =
    useState<TerminalPinnedViewportMetrics | null>(null);

  const clearPinSuggestionHideTask = (): void => {
    const taskId = pinSuggestionHideTaskRef.current;

    if (taskId === null) {
      return;
    }

    window.clearTimeout(taskId);
    pinSuggestionHideTaskRef.current = null;
  };

  const schedulePinSuggestionHideTask = (): void => {
    clearPinSuggestionHideTask();
    pinSuggestionHideTaskRef.current = window.setTimeout(() => {
      setIsPinSuggestionVisible(false);
      pinSuggestionHideTaskRef.current = null;
    }, 2000);
  };

  useEffect(() => {
    const host = hostRef.current;

    if (host === null) {
      return;
    }

    if (!supportsXtermRuntime()) {
      host.textContent =
        "Terminal preview unavailable in this environment. The typed preload bridge is still wired.";

      return;
    }

    const controller = getTerminalSessionController(session);

    controller.attach(host, onTitleChange);

    const resizeObserver = new ResizeObserver(() => {
      controller.requestFit("resize");
    });

    resizeObserver.observe(host);
    controller.requestFit("initial-open");

    return () => {
      resizeObserver.disconnect();
      controller.detach();
    };
  }, [session.id]);

  useEffect(() => {
    if (!supportsXtermRuntime()) {
      return;
    }

    return getTerminalSessionController(session).subscribePinnedViewport(
      (snapshot) => {
        setPinSuggestionVersion(snapshot.pinSuggestionVersion);
        setPinnedViewportMetrics(snapshot.metrics);
      },
    );
  }, [session.id]);

  useEffect(() => {
    if (!supportsXtermRuntime()) {
      return;
    }

    getTerminalSessionController(session).updateTitleChangeHandler(
      onTitleChange,
    );
  }, [onTitleChange, session.id]);

  useEffect(() => {
    if (!supportsXtermRuntime()) {
      return;
    }

    updateTerminalSessionSearchResultsHandler(session, onSearchResultsChange);

    return () => {
      updateTerminalSessionSearchResultsHandler(session, null);
    };
  }, [onSearchResultsChange, session.id]);

  useEffect(() => {
    if (!supportsXtermRuntime()) {
      return;
    }

    if (searchRequest === null) {
      lastAppliedSearchSequenceRef.current = null;
      clearTerminalSessionSearch(session);
      return;
    }

    if (lastAppliedSearchSequenceRef.current === searchRequest.sequence) {
      return;
    }

    lastAppliedSearchSequenceRef.current = searchRequest.sequence;
    applyTerminalSessionSearch(session, searchRequest);
  }, [searchRequest, session.id]);

  useEffect(() => {
    if (isActive && supportsXtermRuntime()) {
      if (isPinned) {
        return;
      }

      getTerminalSessionController(session).focus();
    }
  }, [focusRequestKey, isActive, isPinned, session.id]);

  useEffect(() => {
    if (pinSuggestionVersion === 0 || isPinned) {
      return;
    }

    setIsPinSuggestionVisible(true);
    schedulePinSuggestionHideTask();
  }, [isPinned, pinSuggestionVersion]);

  useEffect(() => {
    return () => {
      clearPinSuggestionHideTask();
    };
  }, []);

  useEffect(() => {
    setIsPinned(false);
    setIsPinSuggestionVisible(false);
    clearPinSuggestionHideTask();
  }, [session.id]);

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div
        className="terminal-surface__viewport bg-surface-terminal m-0 flex h-full min-h-0 min-w-0 flex-1 items-stretch overflow-hidden border-0"
        onPointerDownCapture={() => {
          onFocusPane(paneId);
        }}
        ref={hostRef}
      />
      {isActive && isPinSuggestionVisible ? (
        <div className="pointer-events-none absolute right-4 bottom-4 z-10">
          <button
            aria-label="Pin terminal input overlay"
            className="border-border-subtle bg-surface-panel/95 text-text-highlight hover:bg-surface-panel pointer-events-auto inline-flex items-center gap-2 rounded-xs border px-3 py-2 text-xs font-medium shadow-lg transition-colors duration-150"
            onClick={() => {
              clearPinSuggestionHideTask();
              setIsPinSuggestionVisible(false);
              setIsPinned(true);
            }}
            onMouseEnter={() => {
              clearPinSuggestionHideTask();
            }}
            onMouseLeave={() => {
              if (!isPinSuggestionVisible) {
                return;
              }

              schedulePinSuggestionHideTask();
            }}
            type="button"
          >
            <Pin aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
            <span>입력창 고정</span>
          </button>
        </div>
      ) : null}
      <PinnedTerminalOverlay
        focusRequestKey={focusRequestKey}
        isOpen={isActive && isPinned}
        onClose={() => {
          setIsPinned(false);

          if (supportsXtermRuntime()) {
            getTerminalSessionController(session).focus();
          }
        }}
        onFocusPane={() => {
          onFocusPane(paneId);
        }}
        session={session}
        viewportMetrics={pinnedViewportMetrics}
      />
    </div>
  );
}
