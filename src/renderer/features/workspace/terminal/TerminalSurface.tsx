import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import type { SessionTab } from "../model";
import { getTerminalSessionController } from "./terminal-session-registry";

interface TerminalSurfaceProps {
  focusRequestKey: number;
  isActive: boolean;
  session: SessionTab;
  onTitleChange: (tabId: string, title: string) => void;
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
  onTitleChange,
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
    if (isActive && supportsXtermRuntime()) {
      getTerminalSessionController(session).focus();
    }
  }, [focusRequestKey, isActive, session.id]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div
        className="terminal-surface__viewport m-0 flex h-full min-h-0 min-w-0 flex-1 items-stretch overflow-hidden border-0 bg-surface-terminal"
        ref={hostRef}
      />
    </div>
  );
}
