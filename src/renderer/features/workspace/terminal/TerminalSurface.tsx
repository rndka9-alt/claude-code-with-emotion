import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import type { TerminalSession } from "../model";
import type { TerminalSearchRequest, TerminalSearchResults } from "./search";
import {
  applyTerminalSessionSearch,
  clearTerminalSessionSearch,
  getTerminalSessionController,
  updateTerminalSessionSearchResultsHandler,
} from "./terminal-session-registry";

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
      clearTerminalSessionSearch(session);
      return;
    }

    applyTerminalSessionSearch(session, searchRequest);
  }, [searchRequest, session.id]);

  useEffect(() => {
    if (isActive && supportsXtermRuntime()) {
      getTerminalSessionController(session).focus();
    }
  }, [focusRequestKey, isActive, session.id]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div
        className="terminal-surface__viewport m-0 flex h-full min-h-0 min-w-0 flex-1 items-stretch overflow-hidden border-0 bg-surface-terminal"
        onPointerDownCapture={() => {
          onFocusPane(paneId);
        }}
        ref={hostRef}
      />
    </div>
  );
}
