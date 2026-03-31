import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import type { SessionTab } from './model';
import { TerminalSurface } from './TerminalSurface';

interface PaneStackProps {
  activeTabId: string;
  paneSizes: number[];
  tabs: SessionTab[];
  onActivateTab: (tabId: string) => void;
  onResizePane: (index: number, deltaRatio: number) => void;
}

export function PaneStack({
  activeTabId,
  paneSizes,
  tabs,
  onActivateTab,
  onResizePane,
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
        const isActive = tab.id === activeTabId;
        const paneStyle =
          paneHeight !== undefined ? { flexGrow: paneHeight, flexBasis: 0 } : undefined;

        return (
          <div className="pane-stack__slot" key={tab.id} style={paneStyle}>
            <article
              aria-label={tab.title}
              className={`terminal-pane${isActive ? ' terminal-pane--active' : ''}`}
              data-active={isActive ? 'true' : 'false'}
            >
              <button
                className="terminal-pane__header"
                onClick={() => {
                  onActivateTab(tab.id);
                }}
                type="button"
              >
                <div className="terminal-pane__title-group">
                  <span className="terminal-pane__title">{tab.title}</span>
                  <span className="terminal-pane__meta">
                    {tab.command} · {tab.lifecycle}
                  </span>
                </div>
                <span className="terminal-pane__badge">
                  {isActive ? 'Focused' : 'Background'}
                </span>
              </button>

              <div className="terminal-pane__body">
                <TerminalSurface isActive={isActive} session={tab} />
                <dl className="terminal-pane__details">
                  <div className="terminal-pane__detail">
                    <dt>cwd</dt>
                    <dd>{tab.cwd}</dd>
                  </div>
                  <div className="terminal-pane__detail">
                    <dt>session</dt>
                    <dd>{tab.id}</dd>
                  </div>
                </dl>
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
