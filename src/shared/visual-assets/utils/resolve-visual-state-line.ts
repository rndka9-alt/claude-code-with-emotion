import type { VisualStatePresetId } from "../../visual-presets";
import type { VisualAssetCatalog } from "../types/visual-asset-types";

export function resolveVisualStateLine(
  catalog: VisualAssetCatalog,
  state: VisualStatePresetId,
): string | null {
  const mapping = catalog.stateLines.find(
    (candidate) => candidate.state === state,
  );

  return mapping?.line ?? null;
}
