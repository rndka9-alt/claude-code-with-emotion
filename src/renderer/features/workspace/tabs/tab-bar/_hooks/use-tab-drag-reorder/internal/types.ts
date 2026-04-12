import type { RefObject } from "react";
import type {
  DragCancelEvent,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  SensorDescriptor,
} from "@dnd-kit/core";
import type { WorkspaceTab } from "../../../../../model";

export interface TabDragReorderHandlers {
  activeDragTabId: string | null;
  dragOverlayTab: WorkspaceTab | null;
  handleDragCancel: (event: DragCancelEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragStart: (event: DragStartEvent) => void;
  sensors: SensorDescriptor<object>[];
  shouldSuppressClick: (tabId: string) => boolean;
  sortableTabIds: string[];
  stripRef: RefObject<HTMLDivElement | null>;
}
