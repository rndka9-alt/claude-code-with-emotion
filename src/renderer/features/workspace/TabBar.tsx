import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Plus, X } from 'lucide-react';
import type { SessionTab } from './model';

interface TabBarProps {
  activeTabId: string;
  tabs: SessionTab[];
  onActivateTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCreateTab: () => void;
  onRenameTab: (tabId: string, title: string) => void;
  onReorderTab: (tabId: string, targetTabId: string) => void;
}

export function TabBar({
  activeTabId,
  tabs,
  onActivateTab,
  onCloseTab,
  onCreateTab,
  onRenameTab,
  onReorderTab,
}: TabBarProps): ReactElement {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingTabId !== null) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingTabId]);

  const startRenaming = (tabId: string, title: string): void => {
    setEditingTabId(tabId);
    setDraftTitle(title);
  };

  const finishRenaming = (tabId: string): void => {
    onRenameTab(tabId, draftTitle);
    setEditingTabId(null);
  };

  return (
    <header className="tab-bar">
      <div
        className="tab-strip"
        aria-label="Terminal sessions"
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isEditing = tab.id === editingTabId;

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
                  if (isEditing) {
                    return;
                  }
                  onActivateTab(tab.id);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  startRenaming(tab.id, tab.title);
                }}
                onDoubleClick={() => {
                  startRenaming(tab.id, tab.title);
                }}
                role="tab"
                type="button"
              >
                {isEditing ? (
                  <input
                    aria-label={`${tab.title} title editor`}
                    className="tab-title-editor"
                    onBlur={() => {
                      finishRenaming(tab.id);
                    }}
                    onChange={(event) => {
                      setDraftTitle(event.target.value);
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        finishRenaming(tab.id);
                      }

                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setEditingTabId(null);
                      }
                    }}
                    ref={editInputRef}
                    type="text"
                    value={draftTitle}
                  />
                ) : (
                  <span className="tab-button__label">{tab.title}</span>
                )}
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
