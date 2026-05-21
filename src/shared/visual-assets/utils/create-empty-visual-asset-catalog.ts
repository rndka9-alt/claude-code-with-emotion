import type { VisualAssetCatalog } from "../types/visual-asset-types";

export function createEmptyVisualAssetCatalog(): VisualAssetCatalog {
  return {
    version: 1,
    assets: [],
    emotionDescriptions: [],
    mappings: [],
    stateLines: [],
  };
}
