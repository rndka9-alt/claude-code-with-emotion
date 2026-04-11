import type { WorkspaceTab } from "../../../../../model";

const REORDER_ANIMATION_MS = 180;
const REORDER_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

export function animateReorderedTabs(
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
