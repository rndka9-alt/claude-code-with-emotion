import { useEffect, useRef, useState, type MutableRefObject } from "react";
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
import type {
  WorkspaceWindowBridge,
  WorkspaceWindowScreenPoint,
} from "../../../../../../../shared/workspace-window-bridge";
import {
  createAutoScrollController,
  type AutoScrollController,
} from "./internal/auto-scroll";
import {
  shouldDetachTabOnDrop,
  type PointerClientPosition,
} from "./internal/detach-drop-zone";
import type {
  DetachTabHandler,
  ReorderTabHandler,
  TabDragReorderHandlers,
} from "./internal/types";

const DRAG_ACTIVATION_DISTANCE_PX = 6;

export function useTabDragReorder(
  tabs: WorkspaceTab[],
  onReorderTab: ReorderTabHandler,
  onDetachTab: DetachTabHandler,
): TabDragReorderHandlers {
  const [activeDragTabId, setActiveDragTabId] = useState<string | null>(null);
  const suppressClickTabIdRef = useRef<string | null>(null);
  const tabsRef = useRef(tabs);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const activeDragTabIdRef = useRef<string | null>(null);
  const edgeClientXRef = useRef<number | null>(null);
  const pointerPositionRef = useRef<PointerClientPosition | null>(null);
  const lastOverTabIdRef = useRef<string | null>(null);
  const onReorderTabRef = useRef(onReorderTab);
  const onDetachTabRef = useRef(onDetachTab);
  const autoScrollControllerRef = useRef<AutoScrollController | null>(null);
  const isTabDragPreviewVisibleRef = useRef(false);

  tabsRef.current = tabs;
  onReorderTabRef.current = onReorderTab;
  onDetachTabRef.current = onDetachTab;
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
      pointerPositionRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        screenX: event.screenX,
        screenY: event.screenY,
      };

      if (activeDragTabIdRef.current === null) {
        return;
      }

      edgeClientXRef.current = event.clientX;
      autoScrollController.update(event.clientX);
      updateTabDragPreview({
        activeTabId: activeDragTabIdRef.current,
        isVisibleRef: isTabDragPreviewVisibleRef,
        pointerPosition: pointerPositionRef.current,
        stripElement: stripRef.current,
        tabs: tabsRef.current,
      });
    }

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      autoScrollController.stop();
      edgeClientXRef.current = null;
      pointerPositionRef.current = null;
      activeDragTabIdRef.current = null;
      lastOverTabIdRef.current = null;
      hideTabDragPreview(isTabDragPreviewVisibleRef);
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
      hideTabDragPreview(isTabDragPreviewVisibleRef);
      edgeClientXRef.current = null;
      pointerPositionRef.current = null;
      activeDragTabIdRef.current = null;
      lastOverTabIdRef.current = null;
      setActiveDragTabId(null);
    },
    handleDragEnd: (event: DragEndEvent) => {
      const activeTabId = resolveTabId(event.active.id);
      const overTabId =
        event.over === null
          ? lastOverTabIdRef.current
          : resolveTabId(event.over.id);
      const pointerPosition = resolveDragEndPointerPosition(
        event,
        pointerPositionRef.current,
      );
      const shouldDetachTab = shouldDetachActiveTab(
        stripRef.current,
        pointerPosition,
      );

      suppressClickTabIdRef.current = activeTabId;
      autoScrollControllerRef.current?.stop();
      hideTabDragPreview(isTabDragPreviewVisibleRef);
      edgeClientXRef.current = null;
      pointerPositionRef.current = null;
      activeDragTabIdRef.current = null;
      lastOverTabIdRef.current = null;
      setActiveDragTabId(null);

      if (shouldDetachTab) {
        onDetachTabRef.current(
          activeTabId,
          pointerPosition === null
            ? undefined
            : {
                x: pointerPosition.screenX,
                y: pointerPosition.screenY,
              },
        );
        return;
      }

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
      pointerPositionRef.current = resolvePointerClientPosition(
        event.activatorEvent,
      );
      activeDragTabIdRef.current = tabId;
      updateTabDragPreview({
        activeTabId: tabId,
        isVisibleRef: isTabDragPreviewVisibleRef,
        pointerPosition: pointerPositionRef.current,
        stripElement: stripRef.current,
        tabs: tabsRef.current,
      });
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

interface UpdateTabDragPreviewInput {
  activeTabId: string | null;
  isVisibleRef: MutableRefObject<boolean>;
  pointerPosition: PointerClientPosition | null;
  stripElement: HTMLDivElement | null;
  tabs: WorkspaceTab[];
}

function updateTabDragPreview({
  activeTabId,
  isVisibleRef,
  pointerPosition,
  stripElement,
  tabs,
}: UpdateTabDragPreviewInput): void {
  if (
    activeTabId === null ||
    !shouldDetachActiveTab(stripElement, pointerPosition)
  ) {
    hideTabDragPreview(isVisibleRef);
    return;
  }

  if (pointerPosition === null) {
    throw new Error("Cannot show tab drag preview without a pointer position.");
  }

  const workspaceWindowsBridge = resolveWorkspaceWindowsBridge();
  const screenPoint = resolveScreenPoint(pointerPosition);

  if (workspaceWindowsBridge === null) {
    return;
  }

  if (isVisibleRef.current) {
    workspaceWindowsBridge.moveTabDragPreview({ screenPoint });
    return;
  }

  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  if (activeTab === undefined) {
    throw new Error("Cannot show tab drag preview for an unknown tab.");
  }

  workspaceWindowsBridge.showTabDragPreview({
    screenPoint,
    title: activeTab.title,
  });
  isVisibleRef.current = true;
}

function hideTabDragPreview(isVisibleRef: MutableRefObject<boolean>): void {
  if (!isVisibleRef.current) {
    return;
  }

  const workspaceWindowsBridge = resolveWorkspaceWindowsBridge();

  if (workspaceWindowsBridge !== null) {
    workspaceWindowsBridge.hideTabDragPreview();
  }

  isVisibleRef.current = false;
}

function resolveWorkspaceWindowsBridge(): WorkspaceWindowBridge | null {
  if (window.claudeApp === undefined) {
    return null;
  }

  return window.claudeApp.workspaceWindows;
}

function resolveScreenPoint(
  pointerPosition: PointerClientPosition,
): WorkspaceWindowScreenPoint {
  return {
    x: pointerPosition.screenX,
    y: pointerPosition.screenY,
  };
}

function resolveDragEndPointerPosition(
  event: DragEndEvent,
  fallbackPointerPosition: PointerClientPosition | null,
): PointerClientPosition | null {
  const activatorPosition = resolvePointerClientPosition(event.activatorEvent);

  if (activatorPosition === null) {
    return fallbackPointerPosition;
  }

  return {
    clientX: activatorPosition.clientX + event.delta.x,
    clientY: activatorPosition.clientY + event.delta.y,
    screenX: activatorPosition.screenX + event.delta.x,
    screenY: activatorPosition.screenY + event.delta.y,
  };
}

function resolvePointerClientPosition(
  event: Event,
): PointerClientPosition | null {
  if (event instanceof MouseEvent) {
    return {
      clientX: event.clientX,
      clientY: event.clientY,
      screenX: event.screenX,
      screenY: event.screenY,
    };
  }

  return null;
}

function shouldDetachActiveTab(
  stripElement: HTMLDivElement | null,
  pointerPosition: PointerClientPosition | null,
): boolean {
  if (stripElement === null) {
    return false;
  }

  return shouldDetachTabOnDrop({
    pointerPosition,
    stripRect: stripElement.getBoundingClientRect(),
  });
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
