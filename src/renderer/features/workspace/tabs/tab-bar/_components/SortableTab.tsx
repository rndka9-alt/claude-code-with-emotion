import type { CSSProperties, ReactElement, RefObject } from "react";
import { X } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import type { WorkspaceTab } from "../../../model";

interface SortableTabProps {
  draftTitle: string;
  editInputRef: RefObject<HTMLInputElement | null>;
  editingTabId: string | null;
  finishRenaming: (tabId: string, title: string) => void;
  notifiedTabIds: ReadonlySet<string>;
  onActivateTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onDismissNotification: (tabId: string) => void;
  setDraftTitle: (title: string) => void;
  setEditingTabId: (tabId: string | null) => void;
  shouldSuppressClick: (tabId: string) => boolean;
  startRenaming: (tabId: string, title: string) => void;
  tab: WorkspaceTab;
  activeTabId: string;
}

type TabToneStyle = CSSProperties & {
  "--tab-background": string;
  "--tab-border": string;
  "--tab-foreground": string;
};

export function SortableTab({
  activeTabId,
  draftTitle,
  editInputRef,
  editingTabId,
  finishRenaming,
  notifiedTabIds,
  onActivateTab,
  onCloseTab,
  onDismissNotification,
  setDraftTitle,
  setEditingTabId,
  shouldSuppressClick,
  startRenaming,
  tab,
}: SortableTabProps): ReactElement {
  const isActive = tab.id === activeTabId;
  const isEditing = tab.id === editingTabId;
  const hasNotification = notifiedTabIds.has(tab.id);
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: tab.id,
    disabled: isEditing,
  });
  const tabToneStyle: TabToneStyle = {
    "--tab-background": isActive
      ? "var(--color-tab-background-active)"
      : "var(--color-tab-background)",
    "--tab-border": isActive
      ? "var(--color-tab-border-active)"
      : "var(--color-tab-border)",
    "--tab-foreground": isActive
      ? "var(--color-tab-foreground-active)"
      : "var(--color-tab-foreground)",
  };
  const tabChipClassName = [
    "group relative flex max-w-60 min-w-40 flex-none items-stretch transition-[opacity,box-shadow] duration-150",
    isDragging ? "opacity-0" : "",
  ]
    .filter((className) => className.length > 0)
    .join(" ");
  const style: CSSProperties = {
    transition,
    transform:
      transform === null
        ? undefined
        : `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})`,
  };

  return (
    <div
      className={tabChipClassName}
      ref={setNodeRef}
      role="presentation"
      style={style}
    >
      <button
        aria-controls={`panel-${tab.id}`}
        aria-selected={isActive}
        className="relative flex w-full min-w-0 flex-1 cursor-grab select-none border border-b-0 border-[var(--tab-border)] bg-[var(--tab-background)] px-[14px] py-1.5 text-left text-[0.88rem] text-[var(--tab-foreground)]"
        id={`tab-${tab.id}`}
        style={tabToneStyle}
        title={tab.title}
        onClick={() => {
          if (isEditing || shouldSuppressClick(tab.id)) {
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
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        role="tab"
        type="button"
      >
        {isEditing ? (
          <input
            aria-label={`${tab.title} title editor`}
            className="tab-title-editor m-0 w-full border-none bg-transparent p-0 text-inherit outline-none"
            onBlur={(event) => {
              finishRenaming(tab.id, event.currentTarget.value);
            }}
            onChange={(event) => {
              setDraftTitle(event.target.value);
            }}
            onClick={(event) => {
              event.stopPropagation();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                finishRenaming(tab.id, event.currentTarget.value);
              }

              if (event.key === "Escape") {
                event.preventDefault();
                setEditingTabId(null);
              }
            }}
            ref={editInputRef}
            type="text"
            value={draftTitle}
          />
        ) : (
          <span className="block overflow-hidden text-ellipsis whitespace-nowrap leading-[1.2]">
            {tab.title}
          </span>
        )}
      </button>

      {hasNotification ? (
        <button
          aria-label={`Dismiss notification for ${tab.title}`}
          className="tab-close-button absolute top-1/2 right-1 flex h-[18px] w-[18px] -translate-y-1/2 items-center justify-center bg-[var(--tab-background)] shadow-[-10px_0_10px_var(--tab-background)] transition-[background-color,color,box-shadow] duration-150 hover:bg-surface-hover hover:text-text-highlight hover:shadow-[-10px_0_10px_var(--color-surface-hover)]"
          onClick={(event) => {
            event.stopPropagation();
            onDismissNotification(tab.id);
          }}
          style={tabToneStyle}
          type="button"
        >
          <span className="absolute h-[7px] w-[7px] rounded-full bg-tab-notification transition-opacity duration-150 group-hover:opacity-0" />
          <X
            aria-hidden="true"
            className="h-[11px] w-[11px] text-tab-close-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            strokeWidth={2.25}
          />
        </button>
      ) : (
        <button
          aria-label={`Close ${tab.title}`}
          className="tab-close-button absolute top-1/2 right-1 flex h-[18px] w-[18px] -translate-y-1/2 items-center justify-center bg-[var(--tab-background)] text-tab-close-foreground opacity-0 shadow-[-10px_0_10px_var(--tab-background)] transition-[opacity,background-color,color,box-shadow] duration-150 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 hover:bg-surface-hover hover:text-text-highlight hover:shadow-[-10px_0_10px_var(--color-surface-hover)]"
          onClick={(event) => {
            event.stopPropagation();
            onCloseTab(tab.id);
          }}
          style={tabToneStyle}
          type="button"
        >
          <X
            aria-hidden="true"
            className="h-[11px] w-[11px]"
            strokeWidth={2.25}
          />
        </button>
      )}
    </div>
  );
}
