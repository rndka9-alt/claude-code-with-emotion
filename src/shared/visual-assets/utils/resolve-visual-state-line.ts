import type { VisualStatePresetId } from "../../visual-presets";
import { BASE_VISUAL_ASSET_PROVIDER_ID } from "../constants/provider-metadata";
import type {
  VisualAssetCatalog,
  VisualAssetProviderId,
} from "../types/visual-asset-types";
import { getVisualAssetProviderOverride } from "./get-visual-asset-provider-override";
import { providerShouldUseBaseWhenMissing } from "./provider-should-use-base-when-missing";

export function resolveVisualStateLine(
  catalog: VisualAssetCatalog,
  state: VisualStatePresetId,
  providerId: VisualAssetProviderId = BASE_VISUAL_ASSET_PROVIDER_ID,
): string | null {
  const providerOverride = getVisualAssetProviderOverride(catalog, providerId);
  const mapping = providerOverride.stateLines.find(
    (candidate) => candidate.state === state,
  );

  if (mapping !== undefined) {
    return mapping.line;
  }

  if (!providerShouldUseBaseWhenMissing(catalog, providerId)) {
    return null;
  }

  const baseMapping = catalog.stateLines.find(
    (candidate) => candidate.state === state,
  );

  return baseMapping?.line ?? null;
}
