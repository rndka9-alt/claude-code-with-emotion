import type {
  VisualAssetCatalog,
  VisualAssetCatalogStore,
} from "../types/visual-asset-types";

export function createEmptyVisualAssetCatalog(
  useBaseProviderWhenMissing?: boolean,
): VisualAssetCatalog {
  const catalog: VisualAssetCatalog = {
    version: 1,
    assets: [],
    emotionDescriptions: [],
    mappings: [],
    stateLines: [],
  };

  if (useBaseProviderWhenMissing !== undefined) {
    return {
      ...catalog,
      useBaseProviderWhenMissing,
    };
  }

  return catalog;
}

export function createEmptyVisualAssetCatalogStore(): VisualAssetCatalogStore {
  return {
    version: 1,
    providers: {
      claude: createEmptyVisualAssetCatalog(false),
      codex: createEmptyVisualAssetCatalog(true),
    },
  };
}
