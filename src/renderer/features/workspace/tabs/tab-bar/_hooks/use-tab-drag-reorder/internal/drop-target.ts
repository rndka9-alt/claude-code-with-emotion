import type { WorkspaceTab } from "../../../../../model";
import type { DropIndicatorSide } from "./types";

const DROP_THRESHOLD_RATIO = 0.3;

interface DropTargetResult {
  destinationIndex: number;
  indicatorSide: DropIndicatorSide | null;
  indicatorTabId: string | null;
}

interface TabEntryWithElement {
  element: HTMLDivElement;
  tab: WorkspaceTab;
}

export function resolveDropTarget(
  tabs: WorkspaceTab[],
  tabElements: Map<string, HTMLDivElement>,
  pointerClientX: number,
): DropTargetResult | null {
  const orderedEntries = tabs
    .map((tab) => {
      return {
        element: tabElements.get(tab.id),
        tab,
      };
    })
    .filter(
      (entry): entry is TabEntryWithElement => entry.element !== undefined,
    );

  if (orderedEntries.length === 0) {
    return null;
  }

  let destinationIndex = tabs.length;

  for (const [index, entry] of orderedEntries.entries()) {
    const rect = entry.element.getBoundingClientRect();
    const insertionThresholdX = rect.left + rect.width * DROP_THRESHOLD_RATIO;

    if (pointerClientX < insertionThresholdX) {
      destinationIndex = index;
      break;
    }
  }

  const indicatorTab =
    destinationIndex >= tabs.length
      ? (tabs[tabs.length - 1] ?? null)
      : (tabs[destinationIndex] ?? null);
  const indicatorSide =
    destinationIndex >= tabs.length ? "after" : "before";

  return {
    destinationIndex,
    indicatorSide: indicatorTab === null ? null : indicatorSide,
    indicatorTabId: indicatorTab?.id ?? null,
  };
}
