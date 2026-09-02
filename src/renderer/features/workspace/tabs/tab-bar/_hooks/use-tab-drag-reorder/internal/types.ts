import type { RefObject } from "react";
import type {
  CollisionDetection,
  DragCancelEvent,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  SensorDescriptor,
} from "@dnd-kit/core";
import type { WorkspaceWindowScreenPoint } from "../../../../../../../../shared/workspace-window-bridge";
import type { WorkspaceTab } from "../../../../../model";

export interface TabDragReorderHandlers {
  activeDragTabId: string | null;
  collisionDetection: CollisionDetection;
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

export type DetachTabHandler = (
  tabId: string,
  screenPoint?: WorkspaceWindowScreenPoint,
) => void;

export type ReorderTabHandler = (
  tabId: string,
  destinationIndex: number,
) => void;
