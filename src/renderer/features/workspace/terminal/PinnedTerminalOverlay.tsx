import { PinOff } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import type { TerminalSession } from "../model";
import {
  getTerminalSessionController,
  type TerminalMirrorController,
  type TerminalPinnedViewportMetrics,
} from "./terminal-session-registry";

interface PinnedTerminalOverlayProps {
  focusRequestKey: number;
  isOpen: boolean;
  onClose: () => void;
  onFocusPane: () => void;
  session: TerminalSession;
  viewportMetrics: TerminalPinnedViewportMetrics | null;
}

export function PinnedTerminalOverlay({
  focusRequestKey,
  isOpen,
  onClose,
  onFocusPane,
  session,
  viewportMetrics,
}: PinnedTerminalOverlayProps): ReactElement {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mirrorControllerRef = useRef<TerminalMirrorController | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const host = hostRef.current;

    if (host === null) {
      return;
    }

    const mirrorController =
      getTerminalSessionController(session).createMirrorController();

    mirrorControllerRef.current = mirrorController;
    mirrorController.attach(host);
    mirrorController.requestFit("pinned-overlay-open");
    mirrorController.focus();

    return () => {
      mirrorController.dispose();

      if (mirrorControllerRef.current === mirrorController) {
        mirrorControllerRef.current = null;
      }
    };
  }, [isOpen, session.id]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    mirrorControllerRef.current?.focus();
  }, [focusRequestKey, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    mirrorControllerRef.current?.requestFit("pinned-overlay-resize");
  }, [isOpen, viewportMetrics]);

  if (!isOpen || viewportMetrics === null) {
    return <></>;
  }

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-30"
      data-pinned-terminal-overlay="true"
      onPointerDownCapture={() => {
        onFocusPane();
      }}
    >
      <div className="border-border-subtle bg-surface-terminal mx-3 mb-3 overflow-hidden rounded-xl border shadow-lg">
        <div className="border-border-ghost bg-surface-panel/95 pointer-events-auto flex items-center justify-between border-b px-3 py-2">
          <span className="text-text-subtle text-[0.72rem] font-medium tracking-[0.08em] uppercase">
            Pinned input
          </span>
          <button
            aria-label="Unpin terminal input overlay"
            className="text-text-subtle hover:bg-surface-panel hover:text-text-highlight inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-150"
            onClick={onClose}
            type="button"
          >
            <PinOff
              aria-hidden="true"
              className="h-3.5 w-3.5"
              strokeWidth={2}
            />
          </button>
        </div>
        <div
          className="pointer-events-auto relative overflow-hidden"
          data-pinned-terminal-scroll-container="true"
          style={{
            height:
              viewportMetrics.visibleRowCount * viewportMetrics.cellHeightPx,
          }}
        >
          <div className="h-full min-h-0 min-w-0" ref={hostRef} />
        </div>
      </div>
    </div>
  );
}
