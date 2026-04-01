import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import type { SessionTab } from './model';
import { TerminalSurface } from './TerminalSurface';

interface PaneStackProps {
  paneSizes: number[];
  tabs: SessionTab[];
  onResizePane: (index: number, deltaRatio: number) => void;
  onSyncTabTitle: (tabId: string, title: string) => void;
  terminalFocusRequestKey: number;
}

export function PaneStack({
  paneSizes,
  tabs,
  onResizePane,
  onSyncTabTitle,
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

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [onResizePane]);

  return (
    <div
      aria-label="Terminal pane stack"
      className="pane-stack"
      ref={containerRef}
    >
      {tabs.map((tab, index) => {
        const paneHeight = paneSizes[index];
        const paneStyle =
          tabs.length > 1 && paneHeight !== undefined
            ? { flexGrow: paneHeight, flexBasis: 0 }
            : undefined;

        return (
          <div className="pane-stack__slot" key={tab.id} style={paneStyle}>
            <article
              aria-label={tab.title}
              className="terminal-pane terminal-pane--active"
              data-active="true"
            >
              <div className="terminal-pane__body">
                <TerminalSurface
                  focusRequestKey={terminalFocusRequestKey}
                  isActive={true}
                  onTitleChange={onSyncTabTitle}
                  session={tab}
                />
              </div>
            </article>

            {index < tabs.length - 1 ? (
              <div
                aria-label={`Resize ${tab.title}`}
                className="pane-resizer"
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
