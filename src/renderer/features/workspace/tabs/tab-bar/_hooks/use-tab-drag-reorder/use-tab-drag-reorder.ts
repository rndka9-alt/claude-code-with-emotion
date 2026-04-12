import { useEffect, useRef, useState } from "react";
import {
  MouseSensor,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import type { WorkspaceTab } from "../../../../model";
import {
  createAutoScrollController,
  type AutoScrollController,
} from "./internal/auto-scroll";
import type { TabDragReorderHandlers } from "./internal/types";

const DRAG_ACTIVATION_DISTANCE_PX = 6;

export function useTabDragReorder(
  tabs: WorkspaceTab[],
  onReorderTab: (tabId: string, destinationIndex: number) => void,
): TabDragReorderHandlers {
  const [activeDragTabId, setActiveDragTabId] = useState<string | null>(null);
  const suppressClickTabIdRef = useRef<string | null>(null);
  const tabsRef = useRef(tabs);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const activeDragTabIdRef = useRef<string | null>(null);
  const edgeClientXRef = useRef<number | null>(null);
  const lastOverTabIdRef = useRef<string | null>(null);
  const onReorderTabRef = useRef(onReorderTab);
  const autoScrollControllerRef = useRef<AutoScrollController | null>(null);

  tabsRef.current = tabs;
  onReorderTabRef.current = onReorderTab;
  activeDragTabIdRef.current = activeDragTabId;
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: DRAG_ACTIVATION_DISTANCE_PX,
      },
    }),
  );

  useEffect(() => {
    const autoScrollController = createAutoScrollController({
      getActiveDragTabId: () => activeDragTabIdRef.current,
      getEdgeClientX: () => edgeClientXRef.current,
      getStripElement: () => stripRef.current,
    });
    autoScrollControllerRef.current = autoScrollController;

    function handleMouseMove(event: MouseEvent): void {
      if (activeDragTabIdRef.current === null) {
        return;
      }

      edgeClientXRef.current = event.clientX;
      autoScrollController.update(event.clientX);
    }

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      autoScrollController.stop();
      edgeClientXRef.current = null;
      activeDragTabIdRef.current = null;
      lastOverTabIdRef.current = null;
      setActiveDragTabId(null);
      autoScrollControllerRef.current = null;
    };
  }, []);

  return {
    activeDragTabId,
    dragOverlayTab:
      activeDragTabId === null
        ? null
        : (tabs.find((tab) => tab.id === activeDragTabId) ?? null),
    handleDragCancel: (event: DragCancelEvent) => {
      const tabId = resolveTabId(event.active.id);

      suppressClickTabIdRef.current = tabId;
      autoScrollControllerRef.current?.stop();
      edgeClientXRef.current = null;
      activeDragTabIdRef.current = null;
      lastOverTabIdRef.current = null;
      setActiveDragTabId(null);
    },
    handleDragEnd: (event: DragEndEvent) => {
      const activeTabId = resolveTabId(event.active.id);
      const overTabId =
        event.over === null ? lastOverTabIdRef.current : resolveTabId(event.over.id);

      suppressClickTabIdRef.current = activeTabId;
      autoScrollControllerRef.current?.stop();
      edgeClientXRef.current = null;
      activeDragTabIdRef.current = null;
      lastOverTabIdRef.current = null;
      setActiveDragTabId(null);

      if (overTabId === null || activeTabId === overTabId) {
        return;
      }

      const destinationIndex = resolveDestinationIndex(
        tabsRef.current,
        activeTabId,
        overTabId,
      );

      if (destinationIndex === null) {
        return;
      }

      onReorderTabRef.current(activeTabId, destinationIndex);
    },
    handleDragOver: (event: DragOverEvent) => {
      lastOverTabIdRef.current =
        event.over === null ? null : resolveTabId(event.over.id);
    },
    handleDragStart: (event: DragStartEvent) => {
      const tabId = resolveTabId(event.active.id);

      suppressClickTabIdRef.current = null;
      lastOverTabIdRef.current = tabId;
      activeDragTabIdRef.current = tabId;
      setActiveDragTabId(tabId);
    },
    sensors,
    shouldSuppressClick: (tabId) => {
      if (suppressClickTabIdRef.current !== tabId) {
        return false;
      }

      suppressClickTabIdRef.current = null;
      return true;
    },
    sortableTabIds: tabs.map((tab) => tab.id),
    stripRef,
  };
}

function resolveDestinationIndex(
  tabs: WorkspaceTab[],
  activeTabId: string,
  overTabId: string,
): number | null {
  const fromIndex = tabs.findIndex((tab) => tab.id === activeTabId);
  const overIndex = tabs.findIndex((tab) => tab.id === overTabId);

  if (fromIndex < 0 || overIndex < 0) {
    return null;
  }

  return overIndex > fromIndex ? overIndex + 1 : overIndex;
}

function resolveTabId(id: UniqueIdentifier): string {
  if (typeof id === "string") {
    return id;
  }

  throw new Error("Expected drag identifier to be a string tab id.");
}
