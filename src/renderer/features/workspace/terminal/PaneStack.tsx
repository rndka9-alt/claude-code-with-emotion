import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { TerminalSession, WorkspaceLayoutNode } from "../model";
import { TerminalSurface } from "./TerminalSurface";

interface PaneStackProps {
  focusedPaneId: string | null;
  layout: WorkspaceLayoutNode | null;
  onClosePane: (paneId: string, sessionId: string) => void;
  onFocusPane: (paneId: string) => void;
  onResizeSplit: (splitId: string, deltaRatio: number) => void;
  onSyncSessionTitle: (sessionId: string, title: string) => void;
  sessions: Record<string, TerminalSession>;
  terminalFocusRequestKey: number;
}

interface DragState {
  container: HTMLDivElement;
  direction: "horizontal" | "vertical";
  lastClientX: number;
  lastClientY: number;
  splitId: string;
}

function PaneChrome({
  isActive,
  onClosePane,
  onFocusPane,
  paneId,
  session,
}: {
  isActive: boolean;
  onClosePane: (paneId: string, sessionId: string) => void;
  onFocusPane: (paneId: string) => void;
  paneId: string;
  session: TerminalSession;
}): ReactElement {
  if (!isActive) {
    return <></>;
  }

  return (
    <div
      className="flex h-8 flex-none items-center border-b border-border-subtle bg-surface-panel/75 px-2"
      onPointerDown={() => {
        onFocusPane(paneId);
      }}
    >
      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[0.78rem] text-text-subtle">
        {session.title}
      </span>
      <button
        aria-label={`Close pane ${session.title}`}
        className="ml-2 inline-flex h-5 w-5 flex-none items-center justify-center text-text-subtle transition-colors duration-150 hover:text-text-highlight"
        onClick={(event) => {
          event.stopPropagation();
          onClosePane(paneId, session.id);
        }}
        type="button"
      >
        <X aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
    </div>
  );
}

export function PaneStack({
  focusedPaneId,
  layout,
  onClosePane,
  onFocusPane,
  onResizeSplit,
  onSyncSessionTitle,
  sessions,
  terminalFocusRequestKey,
}: PaneStackProps): ReactElement {
  const dragStateRef = useRef<DragState | null>(null);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent): void {
      const dragState = dragStateRef.current;

      if (dragState === null) {
        return;
      }

      const rect = dragState.container.getBoundingClientRect();
      const size =
        dragState.direction === "horizontal" ? rect.width : rect.height;

      if (size <= 0) {
        return;
      }

      const currentPointer =
        dragState.direction === "horizontal" ? event.clientX : event.clientY;
      const previousPointer =
        dragState.direction === "horizontal"
          ? dragState.lastClientX
          : dragState.lastClientY;
      const deltaRatio = (currentPointer - previousPointer) / size;

      if (deltaRatio !== 0) {
        onResizeSplit(dragState.splitId, deltaRatio);
        dragStateRef.current = {
          ...dragState,
          lastClientX: event.clientX,
          lastClientY: event.clientY,
        };
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
  }, [onResizeSplit]);

  const renderNode = (node: WorkspaceLayoutNode): ReactElement | null => {
    if (node.kind === "pane") {
      const session = sessions[node.sessionId];

      if (session === undefined) {
        return null;
      }

      const isActive = node.id === focusedPaneId;

      return (
        <article
          aria-label={session.title}
          className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-border-ghost bg-surface-terminal"
          data-active={isActive}
          key={node.id}
        >
          <PaneChrome
            isActive={isActive}
            onClosePane={onClosePane}
            onFocusPane={onFocusPane}
            paneId={node.id}
            session={session}
          />
          <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
            <TerminalSurface
              focusRequestKey={terminalFocusRequestKey}
              isActive={isActive}
              onFocusPane={onFocusPane}
              onTitleChange={onSyncSessionTitle}
              paneId={node.id}
              session={session}
            />
          </div>
        </article>
      );
    }

    const isHorizontal = node.direction === "horizontal";
    const firstStyle: CSSProperties = {
      flexBasis: 0,
      flexGrow: node.sizes[0],
    };
    const secondStyle: CSSProperties = {
      flexBasis: 0,
      flexGrow: node.sizes[1],
    };

    return (
      <div
        className={`flex h-full min-h-0 min-w-0 flex-1 overflow-hidden ${isHorizontal ? "flex-row" : "flex-col"}`}
        data-split-direction={node.direction}
        key={node.id}
      >
        <div
          className="flex min-h-0 min-w-0 flex-1 overflow-hidden"
          style={firstStyle}
        >
          {renderNode(node.children[0])}
        </div>

        <div
          aria-label={`Resize ${node.direction} split`}
          aria-orientation={isHorizontal ? "vertical" : "horizontal"}
          className={
            isHorizontal
              ? "w-[10px] flex-none cursor-col-resize bg-border-ghost"
              : "h-[10px] flex-none cursor-row-resize bg-border-ghost"
          }
          onPointerDown={(event) => {
            const container = event.currentTarget.parentElement;

            if (!(container instanceof HTMLDivElement)) {
              return;
            }

            dragStateRef.current = {
              container,
              direction: node.direction,
              lastClientX: event.clientX,
              lastClientY: event.clientY,
              splitId: node.id,
            };
          }}
          role="separator"
        />

        <div
          className="flex min-h-0 min-w-0 flex-1 overflow-hidden"
          style={secondStyle}
        >
          {renderNode(node.children[1])}
        </div>
      </div>
    );
  };

  return (
    <div
      aria-label="Terminal pane layout"
      className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden"
    >
      {layout === null ? null : renderNode(layout)}
    </div>
  );
}
