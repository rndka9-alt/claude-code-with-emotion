import { BASE_VISUAL_ASSET_PROVIDER_ID } from "../constants/provider-metadata";
import type {
  VisualAssetCatalog,
  VisualAssetCatalogStore,
  VisualAssetProviderId,
} from "../types/visual-asset-types";
import { createEmptyVisualAssetCatalog } from "./create-empty-visual-asset-catalog";

export function getVisualAssetProviderCatalog(
  catalogStore: VisualAssetCatalogStore,
  providerId: VisualAssetProviderId = BASE_VISUAL_ASSET_PROVIDER_ID,
): VisualAssetCatalog {
  return (
    catalogStore.providers[providerId] ??
    createEmptyVisualAssetCatalog(providerId !== BASE_VISUAL_ASSET_PROVIDER_ID)
  );
}
