import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { SessionTab } from './model';

const DRAG_START_DISTANCE_PX = 6;
const DROP_THRESHOLD_RATIO = 0.3;
const REORDER_ANIMATION_MS = 180;
const REORDER_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

type DropIndicatorSide = 'before' | 'after';

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
  tab: SessionTab;
}

function animateReorderedTabs(
  tabs: SessionTab[],
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

    if (deltaX === 0 || typeof element.animate !== 'function') {
      return;
    }

    element.animate(
      [
        { transform: `translateX(${deltaX}px)` },
        { transform: 'translateX(0)' },
      ],
      {
        duration: REORDER_ANIMATION_MS,
        easing: REORDER_EASING,
      },
    );
  });

  return nextPositions;
}

export function useTabDragReorder(
  tabs: SessionTab[],
  onReorderTab: (tabId: string, destinationIndex: number) => void,
): TabDragReorderHandlers {
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dropIndicatorTabId, setDropIndicatorTabId] = useState<string | null>(null);
  const [dropIndicatorSide, setDropIndicatorSide] = useState<DropIndicatorSide | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const previousPositionsRef = useRef<Map<string, number>>(new Map());
  const suppressClickTabIdRef = useRef<string | null>(null);
  const tabElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const tabsRef = useRef(tabs);
  const stripRef = useRef<HTMLDivElement | null>(null);

  tabsRef.current = tabs;

  const tabCountRef = useRef(tabs.length);

  useLayoutEffect(() => {
    const prevCount = tabCountRef.current;
    tabCountRef.current = tabs.length;

    // 탭 추가/삭제 시에는 FLIP 애니메이션 불필요 — 순서 변경일 때만 실행
    if (prevCount !== tabs.length) {
      previousPositionsRef.current = new Map();
      return;
    }

    previousPositionsRef.current = animateReorderedTabs(
      tabs,
      tabElementsRef.current,
      previousPositionsRef.current,
    );
  }, [tabs]);

  useEffect(() => {
    function resetDragState(): void {
      dragStateRef.current = null;
      setDraggingTabId(null);
      setDropIndicatorTabId(null);
      setDropIndicatorSide(null);
    }

    function handlePointerMove(event: PointerEvent): void {
      const dragState = dragStateRef.current;
      const stripElement = stripRef.current;

      if (dragState === null || event.pointerId !== dragState.pointerId || stripElement === null) {
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

      if (dragState.hasStarted === false) {
        dragStateRef.current = { ...dragState, hasStarted: true };
        setDraggingTabId(dragState.tabId);
      }

      const currentTabs = tabsRef.current;
      const orderedEntries = currentTabs
        .map((tab) => {
          return {
            element: tabElementsRef.current.get(tab.id),
            tab,
          };
        })
        .filter((entry): entry is TabEntryWithElement => entry.element !== undefined);

      if (orderedEntries.length === 0) {
        return;
      }

      let destinationIndex = currentTabs.length;

      for (const [index, entry] of orderedEntries.entries()) {
        const rect = entry.element.getBoundingClientRect();
        const insertionThresholdX = rect.left + rect.width * DROP_THRESHOLD_RATIO;

        if (event.clientX < insertionThresholdX) {
          destinationIndex = index;
          break;
        }
      }

      const tabAtIndicator =
        destinationIndex >= currentTabs.length
          ? currentTabs[currentTabs.length - 1] ?? null
          : currentTabs[destinationIndex] ?? null;
      const indicatorSide =
        destinationIndex >= currentTabs.length ? 'after' : 'before';

      setDropIndicatorTabId(tabAtIndicator?.id ?? null);
      setDropIndicatorSide(tabAtIndicator === null ? null : indicatorSide);
      onReorderTab(dragState.tabId, destinationIndex);
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

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [onReorderTab]);

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
        eventTarget.closest('.tab-close-button') !== null ||
        eventTarget.closest('.tab-title-editor') !== null
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
