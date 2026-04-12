import { type ReactElement, useEffect } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import type { WorkspaceTab } from "../../model";
import { SortableTab, TabDragOverlay } from "./_components";
import { useTabDragReorder, useTabTitleEditor } from "./_hooks";

interface TabBarProps {
  activeTabId: string;
  notifiedTabIds: ReadonlySet<string>;
  tabs: WorkspaceTab[];
  onActivateTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCreateTab: () => void;
  onDismissNotification: (tabId: string) => void;
  onRenameTab: (tabId: string, title: string) => void;
  onReorderTab: (tabId: string, destinationIndex: number) => void;
}

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
    activeDragTabId,
    dragOverlayTab,
    handleDragCancel,
    handleDragEnd,
    handleDragOver,
    handleDragStart,
    sensors,
    shouldSuppressClick,
    sortableTabIds,
    stripRef,
  } = useTabDragReorder(tabs, onReorderTab);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;

    // 가로 스크롤 전용 탭 스트립이라 휠 입력을 항상 우리가 가로 이동으로 흡수한다
    // 트랙패드는 대각선 입력 시 deltaX·deltaY가 동시에 발생하므로 합산해야
    // 한쪽만 취사선택할 때 생기는 버벅임을 방지할 수 있다
    const handleWheel = (event: WheelEvent) => {
      const delta = event.deltaX + event.deltaY;
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
      <DndContext
        autoScroll={false}
        collisionDetection={closestCenter}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <div
          className="scrollbar-hide flex items-end gap-0.5 overflow-x-hidden pb-0 data-[dragging=true]:cursor-grabbing"
          aria-label="Terminal sessions"
          data-dragging={activeDragTabId !== null}
          ref={stripRef}
          role="tablist"
        >
          <SortableContext
            items={sortableTabIds}
            strategy={horizontalListSortingStrategy}
          >
            {tabs.map((tab) => {
              return (
                <SortableTab
                  activeTabId={activeTabId}
                  draftTitle={draftTitle}
                  editInputRef={editInputRef}
                  editingTabId={editingTabId}
                  finishRenaming={finishRenaming}
                  key={tab.id}
                  notifiedTabIds={notifiedTabIds}
                  onActivateTab={onActivateTab}
                  onCloseTab={onCloseTab}
                  onDismissNotification={onDismissNotification}
                  setDraftTitle={setDraftTitle}
                  setEditingTabId={setEditingTabId}
                  shouldSuppressClick={shouldSuppressClick}
                  startRenaming={startRenaming}
                  tab={tab}
                />
              );
            })}
          </SortableContext>

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

        <DragOverlay dropAnimation={null}>
          {dragOverlayTab === null ? null : (
            <TabDragOverlay
              activeTabId={activeTabId}
              hasNotification={notifiedTabIds.has(dragOverlayTab.id)}
              tab={dragOverlayTab}
            />
          )}
        </DragOverlay>
      </DndContext>
    </header>
  );
}
