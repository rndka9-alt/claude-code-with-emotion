import { BASE_VISUAL_ASSET_PROVIDER_ID } from "../constants/provider-metadata";
import type {
  VisualAssetCatalog,
  VisualAssetProviderId,
} from "../types/visual-asset-types";
import { getVisualAssetProviderOverride } from "./get-visual-asset-provider-override";

export function providerShouldUseBaseWhenMissing(
  catalog: VisualAssetCatalog,
  providerId: VisualAssetProviderId,
): boolean {
  return (
    providerId !== BASE_VISUAL_ASSET_PROVIDER_ID &&
    getVisualAssetProviderOverride(catalog, providerId)
      .useBaseProviderWhenMissing !== false
  );
}
