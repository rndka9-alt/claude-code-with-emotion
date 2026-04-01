import type { ReactElement } from 'react';
import { X } from 'lucide-react';
import type { SessionTab } from './model';

interface TabBarProps {
  activeTabId: string;
  tabs: SessionTab[];
  onActivateTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCreateTab: () => void;
}

export function TabBar({
  activeTabId,
  tabs,
  onActivateTab,
  onCloseTab,
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
            <div
              className={`tab-chip${isActive ? ' tab-chip--active' : ''}`}
              key={tab.id}
              role="presentation"
            >
              <button
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
