import { BASE_VISUAL_ASSET_PROVIDER_ID } from "../constants/provider-metadata";
import type {
  VisualAssetCatalog,
  VisualAssetProviderId,
} from "../types/visual-asset-types";
import { getVisualAssetProviderOverride } from "./get-visual-asset-provider-override";

export function isVisualAssetDefaultForProvider(
  catalog: VisualAssetCatalog,
  assetId: string,
  providerId: VisualAssetProviderId = BASE_VISUAL_ASSET_PROVIDER_ID,
): boolean {
  if (providerId === BASE_VISUAL_ASSET_PROVIDER_ID) {
    return catalog.assets.some((asset) => {
      return asset.id === assetId && asset.isDefault === true;
    });
  }

  return getVisualAssetProviderOverride(catalog, providerId).defaultAssetId ===
    assetId;
}
