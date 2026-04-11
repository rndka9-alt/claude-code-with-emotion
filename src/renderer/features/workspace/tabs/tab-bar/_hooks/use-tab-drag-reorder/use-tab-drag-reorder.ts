import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { WorkspaceTab } from "../../../../model";
import { createAutoScrollController } from "./internal/auto-scroll";
import { animateReorderedTabs } from "./internal/drag-animation";
import { resolveDropTarget } from "./internal/drop-target";
import type { DragState, TabDragReorderHandlers } from "./internal/types";

const DRAG_START_DISTANCE_PX = 6;

export function useTabDragReorder(
  tabs: WorkspaceTab[],
  onReorderTab: (tabId: string, destinationIndex: number) => void,
): TabDragReorderHandlers {
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dropIndicatorTabId, setDropIndicatorTabId] = useState<string | null>(
    null,
  );
  const [dropIndicatorSide, setDropIndicatorSide] = useState<
    TabDragReorderHandlers["dropIndicatorSide"]
  >(null);
  const dragStateRef = useRef<DragState | null>(null);
  const previousPositionsRef = useRef<Map<string, number>>(new Map());
  const suppressClickTabIdRef = useRef<string | null>(null);
  const tabElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const tabsRef = useRef(tabs);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const lastPointerClientXRef = useRef<number | null>(null);
  const onReorderTabRef = useRef(onReorderTab);
  const tabOrderRef = useRef(tabs.map((tab) => tab.id));

  tabsRef.current = tabs;
  onReorderTabRef.current = onReorderTab;

  useLayoutEffect(() => {
    const prevOrder = tabOrderRef.current;
    const nextOrder = tabs.map((tab) => tab.id);
    tabOrderRef.current = nextOrder;

    // 탭 추가·삭제 시 이전 위치 캐시를 비운다
    if (prevOrder.length !== nextOrder.length) {
      previousPositionsRef.current = new Map();
      return;
    }

    // 탭 이름·속성만 바뀌고 순서가 동일하면 FLIP 불필요.
    // 애니메이션 도중 getBoundingClientRect 가 중간값을 읽어
    // deltaX 가 눈덩이처럼 불어나는 피드백 루프를 방지한다.
    if (nextOrder.every((id, index) => prevOrder[index] === id)) {
      return;
    }

    previousPositionsRef.current = animateReorderedTabs(
      tabs,
      tabElementsRef.current,
      previousPositionsRef.current,
    );
  }, [tabs]);

  useEffect(() => {
    const autoScrollController = createAutoScrollController({
      getDragState: () => dragStateRef.current,
      getPointerClientX: () => lastPointerClientXRef.current,
      getStripElement: () => stripRef.current,
      onAutoScroll: updateDropTarget,
    });

    function resetDragState(): void {
      autoScrollController.stop();
      lastPointerClientXRef.current = null;
      dragStateRef.current = null;
      setDraggingTabId(null);
      setDropIndicatorTabId(null);
      setDropIndicatorSide(null);
    }

    function updateDropTarget(
      pointerClientX: number,
      draggedTabId: string,
    ): void {
      const dropTarget = resolveDropTarget(
        tabsRef.current,
        tabElementsRef.current,
        pointerClientX,
      );

      if (dropTarget === null) {
        return;
      }

      setDropIndicatorTabId(dropTarget.indicatorTabId);
      setDropIndicatorSide(dropTarget.indicatorSide);
      onReorderTabRef.current(draggedTabId, dropTarget.destinationIndex);
    }

    function handlePointerMove(event: PointerEvent): void {
      const dragState = dragStateRef.current;

      if (
        dragState === null ||
        event.pointerId !== dragState.pointerId ||
        stripRef.current === null
      ) {
        return;
      }

      const movedX = event.clientX - dragState.startX;
      const movedY = event.clientY - dragState.startY;

      if (
        dragState.hasStarted === false &&
        Math.hypot(movedX, movedY) < DRAG_START_DISTANCE_PX
      ) {
        return;
      }

      let activeDragState = dragState;

      if (dragState.hasStarted === false) {
        activeDragState = { ...dragState, hasStarted: true };
        dragStateRef.current = activeDragState;
        setDraggingTabId(activeDragState.tabId);
      }

      lastPointerClientXRef.current = event.clientX;
      updateDropTarget(event.clientX, activeDragState.tabId);
      autoScrollController.update(event.clientX);
    }

    function handlePointerUp(event: PointerEvent): void {
      const dragState = dragStateRef.current;

      if (dragState === null || event.pointerId !== dragState.pointerId) {
        return;
      }

      if (dragState.hasStarted) {
        suppressClickTabIdRef.current = dragState.tabId;
      }

      resetDragState();
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      autoScrollController.stop();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  return {
    draggingTabId,
    dropIndicatorSide,
    dropIndicatorTabId,
    handlePointerDown: (event, tabId) => {
      if (event.button !== 0) {
        return;
      }

      suppressClickTabIdRef.current = null;

      const eventTarget = event.target;

      if (!(eventTarget instanceof HTMLElement)) {
        return;
      }

      if (
        eventTarget.closest(".tab-close-button") !== null ||
        eventTarget.closest(".tab-title-editor") !== null
      ) {
        return;
      }

      dragStateRef.current = {
        hasStarted: false,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        tabId,
      };
    },
    setTabElement: (tabId, element) => {
      if (element === null) {
        tabElementsRef.current.delete(tabId);
        return;
      }

      tabElementsRef.current.set(tabId, element);
    },
    shouldSuppressClick: (tabId) => {
      if (suppressClickTabIdRef.current !== tabId) {
        return false;
      }

      suppressClickTabIdRef.current = null;
      return true;
    },
    stripRef,
  };
}
