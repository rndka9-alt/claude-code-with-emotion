import { useState, type ReactElement } from 'react';
import { Plus, X } from 'lucide-react';
import type { SessionTab } from './model';

interface TabBarProps {
  activeTabId: string;
  tabs: SessionTab[];
  onActivateTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCreateTab: () => void;
  onReorderTab: (tabId: string, targetTabId: string) => void;
}

export function TabBar({
  activeTabId,
  tabs,
  onActivateTab,
  onCloseTab,
  onCreateTab,
  onReorderTab,
}: TabBarProps): ReactElement {
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);

  return (
    <header className="tab-bar">
      <div
        className="tab-strip"
        aria-label="Terminal sessions"
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;

          return (
            <div
              className={`tab-chip${isActive ? ' tab-chip--active' : ''}`}
              draggable
              key={tab.id}
              onDragEnd={() => {
                setDraggingTabId(null);
              }}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDragStart={() => {
                setDraggingTabId(tab.id);
              }}
              onDrop={(event) => {
                event.preventDefault();

                if (draggingTabId === null) {
                  return;
                }

                onReorderTab(draggingTabId, tab.id);
                setDraggingTabId(null);
              }}
              role="presentation"
            >
              <button
                aria-controls={`panel-${tab.id}`}
                aria-selected={isActive}
                className={`tab-button${isActive ? ' tab-button--active' : ''}`}
                id={`tab-${tab.id}`}
                title={tab.title}
                onClick={() => {
                  onActivateTab(tab.id);
                }}
                role="tab"
                type="button"
              >
                <span className="tab-button__label">{tab.title}</span>
              </button>

              <button
                aria-label={`Close ${tab.title}`}
                className="tab-close-button"
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseTab(tab.id);
                }}
                type="button"
              >
                <X aria-hidden="true" className="tab-close-button__icon" strokeWidth={2.25} />
              </button>
            </div>
          );
        })}

        <button
          aria-label="New Session"
          className="tab-create-button"
          onClick={onCreateTab}
          title="New Session"
          type="button"
        >
          <Plus aria-hidden="true" className="tab-create-button__icon" strokeWidth={2.4} />
        </button>
      </div>
    </header>
  );
}
