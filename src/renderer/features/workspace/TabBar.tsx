import type { ReactElement } from 'react';
import type { SessionTab } from './model';

interface TabBarProps {
  activeTabId: string;
  tabs: SessionTab[];
  onActivateTab: (tabId: string) => void;
  onCreateTab: () => void;
}

export function TabBar({
  activeTabId,
  tabs,
  onActivateTab,
  onCreateTab,
}: TabBarProps): ReactElement {
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
            <button
              key={tab.id}
              aria-controls={`panel-${tab.id}`}
              aria-selected={isActive}
              className={`tab-button${isActive ? ' tab-button--active' : ''}`}
              id={`tab-${tab.id}`}
              onClick={() => {
                onActivateTab(tab.id);
              }}
              role="tab"
              type="button"
            >
              <span className="tab-button__label">{tab.title}</span>
            </button>
          );
        })}

        <button
          className="tab-create-button"
          onClick={onCreateTab}
          type="button"
        >
          New Session
        </button>
      </div>
    </header>
  );
}
