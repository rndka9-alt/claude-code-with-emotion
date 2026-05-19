import { PinOff } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import type { TerminalSession } from "../model";
import {
  getTerminalSessionController,
  type TerminalMirrorController,
} from "./session";
import type { TerminalPinnedViewportMetrics } from "./terminal-viewport";

interface PinnedTerminalOverlayProps {
  focusRequestKey: number;
  focusRedirectRequestKey: number;
  isOpen: boolean;
  onClose: () => void;
  onFocusPane: () => void;
  session: TerminalSession;
  viewportMetrics: TerminalPinnedViewportMetrics | null;
}

function calculatePinnedViewportOffsetRow(
  viewportMetrics: TerminalPinnedViewportMetrics,
): number {
  const maxOffsetRow = Math.max(
    0,
    viewportMetrics.terminalRows - viewportMetrics.visibleRowCount,
  );

  return Math.max(
    0,
    Math.min(viewportMetrics.cursorViewportRow - 2, maxOffsetRow),
  );
}

export function PinnedTerminalOverlay({
  focusRequestKey,
  focusRedirectRequestKey,
  isOpen,
  onClose,
  onFocusPane,
  session,
  viewportMetrics,
}: PinnedTerminalOverlayProps): ReactElement {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mirrorControllerRef = useRef<TerminalMirrorController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

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
  }, [focusRedirectRequestKey, focusRequestKey, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    mirrorControllerRef.current?.requestFit("pinned-overlay-resize");
  }, [
    isOpen,
    viewportMetrics?.cellHeightPx,
    viewportMetrics?.cellWidthPx,
    viewportMetrics?.terminalColumns,
    viewportMetrics?.terminalRows,
  ]);

  useEffect(() => {
    if (!isOpen || viewportMetrics === null) {
      return;
    }

    const scrollContainer = scrollContainerRef.current;

    if (scrollContainer === null) {
      return;
    }

    const cursorLeft =
      viewportMetrics.cursorViewportColumn * viewportMetrics.cellWidthPx;
    const cursorRight = cursorLeft + viewportMetrics.cellWidthPx;
    const visibleLeft = scrollContainer.scrollLeft;
    const visibleRight = visibleLeft + scrollContainer.clientWidth;

    scrollContainer.scrollTop =
      calculatePinnedViewportOffsetRow(viewportMetrics) *
      viewportMetrics.cellHeightPx;

    if (cursorLeft < visibleLeft) {
      scrollContainer.scrollLeft = cursorLeft;
      return;
    }

    if (visibleRight < cursorRight) {
      scrollContainer.scrollLeft = Math.max(
        0,
        cursorRight - scrollContainer.clientWidth,
      );
    }
  }, [
    isOpen,
    viewportMetrics?.cellHeightPx,
    viewportMetrics?.cellWidthPx,
    viewportMetrics?.cursorViewportColumn,
    viewportMetrics?.cursorViewportRow,
    viewportMetrics?.terminalColumns,
    viewportMetrics?.terminalRows,
    viewportMetrics?.visibleRowCount,
  ]);

  if (!isOpen || viewportMetrics === null) {
    return <></>;
  }

  const {
    cellHeightPx,
    cellWidthPx,
    terminalColumns,
    terminalRows,
    visibleRowCount,
  } = viewportMetrics;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10"
      data-pinned-terminal-overlay="true"
      onPointerDownCapture={() => {
        onFocusPane();
      }}
    >
      <div className="border-border-subtle bg-surface-terminal mx-3 mb-3 overflow-hidden rounded-xs border shadow-lg">
        <div
          className="scrollbar-hide pointer-events-auto relative overflow-auto"
          data-pinned-terminal-scroll-container="true"
          ref={scrollContainerRef}
          style={{
            height: visibleRowCount * cellHeightPx,
          }}
        >
          <button
            aria-label="Unpin terminal input overlay"
            className="bg-surface-panel/95 text-text-subtle hover:bg-surface-panel hover:text-text-highlight absolute top-2 right-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-xs border border-transparent transition-colors duration-150"
            onClick={onClose}
            type="button"
          >
            <PinOff
              aria-hidden="true"
              className="h-3.5 w-3.5"
              strokeWidth={2}
            />
          </button>
          <div
            className="pinned-terminal-overlay__viewport min-h-0 min-w-0"
            data-pinned-terminal-viewport="true"
            ref={hostRef}
            style={{
              height: terminalRows * cellHeightPx,
              width: terminalColumns * cellWidthPx,
            }}
          />
        </div>
      </div>
    </div>
  );
}
