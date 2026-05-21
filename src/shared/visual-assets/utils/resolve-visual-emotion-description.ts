import type { VisualEmotionPresetId } from "../../visual-presets";
import type { VisualAssetCatalog } from "../types/visual-asset-types";

export function resolveVisualEmotionDescription(
  catalog: VisualAssetCatalog,
  emotion: VisualEmotionPresetId,
): string | null {
  const mapping = catalog.emotionDescriptions.find(
    (candidate) => candidate.emotion === emotion,
  );

  return mapping?.description ?? null;
}
