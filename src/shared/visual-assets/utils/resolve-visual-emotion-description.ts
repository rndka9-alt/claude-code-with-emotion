import type { VisualEmotionPresetId } from "../../visual-presets";
import { BASE_VISUAL_ASSET_PROVIDER_ID } from "../constants/provider-metadata";
import type {
  VisualAssetCatalog,
  VisualAssetProviderId,
} from "../types/visual-asset-types";
import { getVisualAssetProviderOverride } from "./get-visual-asset-provider-override";
import { providerShouldUseBaseWhenMissing } from "./provider-should-use-base-when-missing";

export function resolveVisualEmotionDescription(
  catalog: VisualAssetCatalog,
  emotion: VisualEmotionPresetId,
  providerId: VisualAssetProviderId = BASE_VISUAL_ASSET_PROVIDER_ID,
): string | null {
  const providerOverride = getVisualAssetProviderOverride(catalog, providerId);
  const mapping = providerOverride.emotionDescriptions.find(
    (candidate) => candidate.emotion === emotion,
  );

  if (mapping !== undefined) {
    return mapping.description;
  }

  if (!providerShouldUseBaseWhenMissing(catalog, providerId)) {
    return null;
  }

  const baseMapping = catalog.emotionDescriptions.find(
    (candidate) => candidate.emotion === emotion,
  );

  return baseMapping?.description ?? null;
}
