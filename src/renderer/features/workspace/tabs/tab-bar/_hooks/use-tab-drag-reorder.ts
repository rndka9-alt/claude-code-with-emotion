import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import type { WorkspaceTab } from "../../../model";

const DRAG_START_DISTANCE_PX = 6;
const DROP_THRESHOLD_RATIO = 0.3;
const REORDER_ANIMATION_MS = 180;
const REORDER_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const AUTO_SCROLL_EDGE_THRESHOLD_PX = 48;
const AUTO_SCROLL_MAX_SPEED_PX_PER_SECOND = 420;

type DropIndicatorSide = "before" | "after";

interface DragState {
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

interface TabEntryWithElement {
  element: HTMLDivElement;
  tab: WorkspaceTab;
}

function animateReorderedTabs(
  tabs: WorkspaceTab[],
  elements: Map<string, HTMLDivElement>,
  previousPositions: Map<string, number>,
): Map<string, number> {
  const nextPositions = new Map<string, number>();

  tabs.forEach((tab) => {
    const element = elements.get(tab.id);

    if (element === undefined) {
      return;
    }

    const nextLeft = element.getBoundingClientRect().left;
    nextPositions.set(tab.id, nextLeft);

    const previousLeft = previousPositions.get(tab.id);

    if (previousLeft === undefined) {
      return;
    }

    const deltaX = previousLeft - nextLeft;

    if (deltaX === 0 || typeof element.animate !== "function") {
      return;
    }

    element.animate(
      [
        { transform: `translateX(${deltaX}px)` },
        { transform: "translateX(0)" },
      ],
      {
        duration: REORDER_ANIMATION_MS,
        easing: REORDER_EASING,
      },
    );
  });

  return nextPositions;
}

function getStripVisibleWidth(stripElement: HTMLDivElement): number {
  const rect = stripElement.getBoundingClientRect();

  if (stripElement.clientWidth > 0) {
    return stripElement.clientWidth;
  }

  return rect.width;
}

export function useTabDragReorder(
  tabs: WorkspaceTab[],
  onReorderTab: (tabId: string, destinationIndex: number) => void,
): TabDragReorderHandlers {
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dropIndicatorTabId, setDropIndicatorTabId] = useState<string | null>(
    null,
  );
  const [dropIndicatorSide, setDropIndicatorSide] =
    useState<DropIndicatorSide | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const previousPositionsRef = useRef<Map<string, number>>(new Map());
  const suppressClickTabIdRef = useRef<string | null>(null);
  const tabElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const tabsRef = useRef(tabs);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const lastPointerClientXRef = useRef<number | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const lastAutoScrollTimestampRef = useRef<number | null>(null);
  const onReorderTabRef = useRef(onReorderTab);

  tabsRef.current = tabs;
  onReorderTabRef.current = onReorderTab;

  const tabOrderRef = useRef(tabs.map((tab) => tab.id));

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
    function stopAutoScroll(): void {
      if (autoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(autoScrollFrameRef.current);
        autoScrollFrameRef.current = null;
      }

      lastAutoScrollTimestampRef.current = null;
    }

    function resetDragState(): void {
      stopAutoScroll();
      lastPointerClientXRef.current = null;
      dragStateRef.current = null;
      setDraggingTabId(null);
      setDropIndicatorTabId(null);
      setDropIndicatorSide(null);
    }

    function updateDropTarget(pointerClientX: number, draggedTabId: string): void {
      const currentTabs = tabsRef.current;
      const orderedEntries = currentTabs
        .map((tab) => {
          return {
            element: tabElementsRef.current.get(tab.id),
            tab,
          };
        })
        .filter(
          (entry): entry is TabEntryWithElement => entry.element !== undefined,
        );

      if (orderedEntries.length === 0) {
        return;
      }

      let destinationIndex = currentTabs.length;

      for (const [index, entry] of orderedEntries.entries()) {
        const rect = entry.element.getBoundingClientRect();
        const insertionThresholdX =
          rect.left + rect.width * DROP_THRESHOLD_RATIO;

        if (pointerClientX < insertionThresholdX) {
          destinationIndex = index;
          break;
        }
      }

      const tabAtIndicator =
        destinationIndex >= currentTabs.length
          ? (currentTabs[currentTabs.length - 1] ?? null)
          : (currentTabs[destinationIndex] ?? null);
      const indicatorSide =
        destinationIndex >= currentTabs.length ? "after" : "before";

      setDropIndicatorTabId(tabAtIndicator?.id ?? null);
      setDropIndicatorSide(tabAtIndicator === null ? null : indicatorSide);
      onReorderTabRef.current(draggedTabId, destinationIndex);
    }

    function getAutoScrollVelocity(
      pointerClientX: number,
      stripElement: HTMLDivElement,
    ): number {
      const rect = stripElement.getBoundingClientRect();
      const visibleWidth = getStripVisibleWidth(stripElement);
      const maxScrollLeft = Math.max(stripElement.scrollWidth - visibleWidth, 0);

      if (maxScrollLeft === 0) {
        return 0;
      }

      const leftThreshold = rect.left + AUTO_SCROLL_EDGE_THRESHOLD_PX;

      if (
        pointerClientX < leftThreshold &&
        stripElement.scrollLeft > 0
      ) {
        const intensity = Math.min(
          (leftThreshold - pointerClientX) / AUTO_SCROLL_EDGE_THRESHOLD_PX,
          1,
        );

        return -AUTO_SCROLL_MAX_SPEED_PX_PER_SECOND * intensity * intensity;
      }

      const rightThreshold = rect.right - AUTO_SCROLL_EDGE_THRESHOLD_PX;

      if (
        pointerClientX > rightThreshold &&
        stripElement.scrollLeft < maxScrollLeft
      ) {
        const intensity = Math.min(
          (pointerClientX - rightThreshold) / AUTO_SCROLL_EDGE_THRESHOLD_PX,
          1,
        );

        return AUTO_SCROLL_MAX_SPEED_PX_PER_SECOND * intensity * intensity;
      }

      return 0;
    }

    function runAutoScrollFrame(timestamp: number): void {
      autoScrollFrameRef.current = null;

      const dragState = dragStateRef.current;
      const stripElement = stripRef.current;
      const pointerClientX = lastPointerClientXRef.current;

      if (
        dragState === null ||
        dragState.hasStarted === false ||
        stripElement === null ||
        pointerClientX === null
      ) {
        lastAutoScrollTimestampRef.current = null;
        return;
      }

      const velocity = getAutoScrollVelocity(pointerClientX, stripElement);

      if (velocity === 0) {
        lastAutoScrollTimestampRef.current = null;
        return;
      }

      const previousTimestamp = lastAutoScrollTimestampRef.current;
      const elapsedMs =
        previousTimestamp === null
          ? 16
          : Math.min(timestamp - previousTimestamp, 32);
      lastAutoScrollTimestampRef.current = timestamp;

      const visibleWidth = getStripVisibleWidth(stripElement);
      const maxScrollLeft = Math.max(stripElement.scrollWidth - visibleWidth, 0);
      const nextScrollLeft = Math.min(
        Math.max(
          stripElement.scrollLeft + velocity * (elapsedMs / 1_000),
          0,
        ),
        maxScrollLeft,
      );

      if (nextScrollLeft === stripElement.scrollLeft) {
        lastAutoScrollTimestampRef.current = null;
        return;
      }

      stripElement.scrollLeft = nextScrollLeft;
      updateDropTarget(pointerClientX, dragState.tabId);
      autoScrollFrameRef.current = window.requestAnimationFrame(
        runAutoScrollFrame,
      );
    }

    function scheduleAutoScroll(): void {
      if (autoScrollFrameRef.current !== null) {
        return;
      }

      autoScrollFrameRef.current = window.requestAnimationFrame(
        runAutoScrollFrame,
      );
    }

    function handlePointerMove(event: PointerEvent): void {
      const dragState = dragStateRef.current;
      const stripElement = stripRef.current;

      if (
        dragState === null ||
        event.pointerId !== dragState.pointerId ||
        stripElement === null
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

      if (getAutoScrollVelocity(event.clientX, stripElement) === 0) {
        stopAutoScroll();
        return;
      }

      scheduleAutoScroll();
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
      stopAutoScroll();
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
