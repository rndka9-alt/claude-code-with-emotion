import { type CSSProperties, type ReactElement, useEffect } from "react";
import { Plus, X } from "lucide-react";
import type { SessionTab } from "./model";
import { useTabDragReorder } from "./use-tab-drag-reorder";
import { useTabTitleEditor } from "./use-tab-title-editor";

interface TabBarProps {
  activeTabId: string;
  notifiedTabIds: ReadonlySet<string>;
  tabs: SessionTab[];
  onActivateTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCreateTab: () => void;
  onDismissNotification: (tabId: string) => void;
  onRenameTab: (tabId: string, title: string) => void;
  onReorderTab: (tabId: string, destinationIndex: number) => void;
}

type TabToneStyle = CSSProperties & {
  "--tab-background": string;
  "--tab-border": string;
  "--tab-foreground": string;
};

export function TabBar({
  activeTabId,
  notifiedTabIds,
  tabs,
  onActivateTab,
  onCloseTab,
  onCreateTab,
  onDismissNotification,
  onRenameTab,
  onReorderTab,
}: TabBarProps): ReactElement {
  const createButtonClassName =
    "ml-0.5 inline-flex h-[26px] w-[26px] flex-none items-center justify-center self-center border border-border-subtle bg-transparent text-tab-create-foreground transition-colors duration-150 hover:border-border-create-hover hover:bg-surface-create-hover hover:text-text-highlight";
  const {
    draftTitle,
    editInputRef,
    editingTabId,
    finishRenaming,
    setDraftTitle,
    setEditingTabId,
    startRenaming,
  } = useTabTitleEditor(onRenameTab);
  const {
    draggingTabId,
    dropIndicatorSide,
    dropIndicatorTabId,
    handlePointerDown,
    setTabElement,
    shouldSuppressClick,
    stripRef,
  } = useTabDragReorder(tabs, onReorderTab);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;

    // 가로 스크롤 전용 탭 스트립이라 휠 입력을 항상 우리가 가로 이동으로 흡수한다
    // 중간중간 브라우저 기본 스크롤과 수동 스크롤이 섞이면 관성 끝에서 움찔하는 현상이 생겨서
    // deltaX가 있으면 deltaX를, 없으면 deltaY를 써서 일관되게 한 방향으로만 이동시킨다
    const handleWheel = (event: WheelEvent) => {
      const delta = event.deltaX !== 0 ? event.deltaX : event.deltaY;
      if (delta === 0) return;
      event.preventDefault();
      strip.scrollLeft += delta;
    };

    strip.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      strip.removeEventListener("wheel", handleWheel);
    };
  }, []);

  useEffect(() => {
    const tab = document.getElementById(`tab-${activeTabId}`);
    const strip = stripRef.current;
    if (!tab || !strip) return;

    const tabRect = tab.getBoundingClientRect();
    const stripRect = strip.getBoundingClientRect();

    if (tabRect.right > stripRect.right) {
      strip.scrollTo({
        left: strip.scrollLeft + tabRect.right - stripRect.right,
        behavior: "smooth",
      });
    } else if (tabRect.left < stripRect.left) {
      strip.scrollTo({
        left: strip.scrollLeft - (stripRect.left - tabRect.left),
        behavior: "smooth",
      });
    }
  }, [activeTabId]);

  return (
    <header className="px-2 pt-1">
      <div
        className="scrollbar-hide flex items-end gap-0.5 overflow-x-hidden pb-0 data-[dragging=true]:cursor-grabbing"
        aria-label="Terminal sessions"
        data-dragging={draggingTabId !== null}
        ref={stripRef}
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isEditing = tab.id === editingTabId;
          const isDragging = tab.id === draggingTabId;
          const isDropIndicatorTarget = tab.id === dropIndicatorTabId;
          const hasNotification = notifiedTabIds.has(tab.id);
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
            "before:pointer-events-none before:absolute before:top-[5px] before:bottom-px before:w-0.5 before:bg-[var(--gradient-tab-indicator)] before:opacity-0 before:shadow-tab-indicator before:transition-opacity before:duration-150",
            isDragging ? "z-[2] opacity-[0.86] shadow-tab-drag" : "",
            isDropIndicatorTarget && dropIndicatorSide === "before"
              ? "before:left-[-2px] before:opacity-100"
              : "",
            isDropIndicatorTarget && dropIndicatorSide === "after"
              ? "before:right-[-2px] before:opacity-100"
              : "",
          ]
            .filter((className) => className.length > 0)
            .join(" ");

          return (
            <div
              className={tabChipClassName}
              key={tab.id}
              onPointerDown={(event) => {
                handlePointerDown(event, tab.id);
              }}
              ref={(element) => {
                setTabElement(tab.id, element);
              }}
              role="presentation"
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
                role="tab"
                type="button"
              >
                {isEditing ? (
                  <input
                    aria-label={`${tab.title} title editor`}
                    className="m-0 w-full border-none bg-transparent p-0 text-inherit outline-none"
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
                      if (event.key === "Enter") {
                        event.preventDefault();
                        finishRenaming(tab.id);
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
                  className="absolute top-1/2 right-1 flex h-[18px] w-[18px] -translate-y-1/2 items-center justify-center bg-[var(--tab-background)] shadow-[-10px_0_10px_var(--tab-background)] transition-[background-color,color,box-shadow] duration-150 hover:bg-surface-hover hover:text-text-highlight hover:shadow-[-10px_0_10px_var(--color-surface-hover)]"
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
                  className="absolute top-1/2 right-1 flex h-[18px] w-[18px] -translate-y-1/2 items-center justify-center bg-[var(--tab-background)] text-tab-close-foreground opacity-0 shadow-[-10px_0_10px_var(--tab-background)] transition-[opacity,background-color,color,box-shadow] duration-150 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 hover:bg-surface-hover hover:text-text-highlight hover:shadow-[-10px_0_10px_var(--color-surface-hover)]"
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
        })}

        <button
          aria-label="New Session"
          className={createButtonClassName}
          onClick={onCreateTab}
          title="New Session"
          type="button"
        >
          <Plus aria-hidden="true" className="h-3 w-3" strokeWidth={2.4} />
        </button>
      </div>
    </header>
  );
}
