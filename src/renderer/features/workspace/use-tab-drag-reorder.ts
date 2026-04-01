import { useState } from 'react';

export interface TabDragReorderHandlers {
  draggingTabId: string | null;
  handleDragEnd: () => void;
  handleDragOver: (event: React.DragEvent<HTMLElement>) => void;
  handleDragStart: (tabId: string) => void;
  handleDrop: (
    event: React.DragEvent<HTMLElement>,
    targetTabId: string,
  ) => void;
}

export function useTabDragReorder(
  onReorderTab: (tabId: string, targetTabId: string) => void,
): TabDragReorderHandlers {
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);

  return {
    draggingTabId,
    handleDragEnd: () => {
      setDraggingTabId(null);
    },
    handleDragOver: (event) => {
      event.preventDefault();
    },
    handleDragStart: (tabId) => {
      setDraggingTabId(tabId);
    },
    handleDrop: (event, targetTabId) => {
      event.preventDefault();

      if (draggingTabId === null) {
        return;
      }

      onReorderTab(draggingTabId, targetTabId);
      setDraggingTabId(null);
    },
  };
}
