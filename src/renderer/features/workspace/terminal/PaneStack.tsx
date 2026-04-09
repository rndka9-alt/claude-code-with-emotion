import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import type { TerminalSession } from "../model";
import { TerminalSurface } from "./TerminalSurface";

interface PaneStackProps {
  paneSizes: number[];
  focusedSessionId: string | null;
  onFocusSession: (sessionId: string) => void;
  onResizePane: (index: number, deltaRatio: number) => void;
  onSyncSessionTitle: (sessionId: string, title: string) => void;
  sessions: TerminalSession[];
  terminalFocusRequestKey: number;
}

export function PaneStack({
  paneSizes,
  focusedSessionId,
  onFocusSession,
  onResizePane,
  onSyncSessionTitle,
  sessions,
  terminalFocusRequestKey,
}: PaneStackProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ index: number; lastY: number } | null>(null);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent): void {
      const dragState = dragStateRef.current;
      const container = containerRef.current;

      if (dragState === null || container === null) {
        return;
      }

      const { height } = container.getBoundingClientRect();

      if (height <= 0) {
        return;
      }

      const deltaRatio = (event.clientY - dragState.lastY) / height;

      if (deltaRatio !== 0) {
        onResizePane(dragState.index, deltaRatio);
        dragStateRef.current = { index: dragState.index, lastY: event.clientY };
      }
    }

    function handlePointerUp(): void {
      dragStateRef.current = null;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [onResizePane]);

  return (
    <div
      aria-label="Terminal pane stack"
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      ref={containerRef}
    >
      {sessions.map((session, index) => {
        const paneHeight = paneSizes[index];
        const paneStyle =
          sessions.length > 1 && paneHeight !== undefined
            ? { flexGrow: paneHeight, flexBasis: 0 }
            : undefined;

        return (
          <div
            className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
            key={session.id}
            style={paneStyle}
          >
            <article
              aria-label={session.title}
              className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-surface-terminal"
              data-active={session.id === focusedSessionId}
            >
              <div className="flex h-full min-h-0 flex-1 overflow-hidden">
                <TerminalSurface
                  focusRequestKey={terminalFocusRequestKey}
                  isActive={session.id === focusedSessionId}
                  onFocusSession={onFocusSession}
                  onTitleChange={onSyncSessionTitle}
                  session={session}
                />
              </div>
            </article>

            {index < sessions.length - 1 ? (
              <div
                aria-label={`Resize ${session.title}`}
                className="basis-[10px] cursor-row-resize bg-border-ghost"
                onPointerDown={(event) => {
                  dragStateRef.current = { index, lastY: event.clientY };
                }}
                role="separator"
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
