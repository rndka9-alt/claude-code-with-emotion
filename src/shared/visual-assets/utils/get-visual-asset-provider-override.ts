import { BASE_VISUAL_ASSET_PROVIDER_ID } from "../constants/provider-metadata";
import type {
  VisualAssetCatalog,
  VisualAssetProviderId,
  VisualAssetProviderOverride,
} from "../types/visual-asset-types";

function createEmptyProviderOverride(): VisualAssetProviderOverride {
  return {
    defaultAssetId: undefined,
    emotionDescriptions: [],
    mappings: [],
    stateLines: [],
    useBaseProviderWhenMissing: true,
  };
}

export function getVisualAssetProviderOverride(
  catalog: VisualAssetCatalog,
  providerId: VisualAssetProviderId,
): VisualAssetProviderOverride {
  if (providerId === BASE_VISUAL_ASSET_PROVIDER_ID) {
    return {
      defaultAssetId: catalog.assets.find((asset) => asset.isDefault === true)
        ?.id,
      emotionDescriptions: catalog.emotionDescriptions,
      mappings: catalog.mappings,
      stateLines: catalog.stateLines,
      useBaseProviderWhenMissing: false,
    };
  }

  return {
    ...createEmptyProviderOverride(),
    ...catalog.providerOverrides?.[providerId],
  };
}
