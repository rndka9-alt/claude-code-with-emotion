import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

export type DropIndicatorSide = "before" | "after";

export interface DragState {
  hasStarted: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  tabId: string;
}

export interface TabDragReorderHandlers {
  draggingTabId: string | null;
  dropIndicatorSide: DropIndicatorSide | null;
  dropIndicatorTabId: string | null;
  handlePointerDown: (
    event: ReactPointerEvent<HTMLElement>,
    tabId: string,
  ) => void;
  setTabElement: (tabId: string, element: HTMLDivElement | null) => void;
  shouldSuppressClick: (tabId: string) => boolean;
  stripRef: RefObject<HTMLDivElement | null>;
}
