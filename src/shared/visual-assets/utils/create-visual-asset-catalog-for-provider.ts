import { BASE_VISUAL_ASSET_PROVIDER_ID } from "../constants/provider-metadata";
import type {
  VisualAssetCatalog,
  VisualAssetCatalogStore,
  VisualAssetMapping,
  VisualAssetProviderId,
  VisualEmotionDescriptionMapping,
  VisualStateLineMapping,
} from "../types/visual-asset-types";
import { getVisualAssetProviderCatalog } from "./get-visual-asset-provider-catalog";

function getVisualAssetMappingKey(mapping: VisualAssetMapping): string {
  return `${mapping.state ?? ""}:${mapping.emotion ?? ""}`;
}

function mergeMappings(
  baseMappings: ReadonlyArray<VisualAssetMapping>,
  providerMappings: ReadonlyArray<VisualAssetMapping>,
  useBaseWhenMissing: boolean,
): ReadonlyArray<VisualAssetMapping> {
  if (!useBaseWhenMissing) {
    return providerMappings;
  }

  const providerMappingKeys = new Set(
    providerMappings.map((mapping) => {
      return getVisualAssetMappingKey(mapping);
    }),
  );

  return [
    ...providerMappings,
    ...baseMappings.filter((mapping) => {
      return !providerMappingKeys.has(getVisualAssetMappingKey(mapping));
    }),
  ];
}

function mergeStateLines(
  baseStateLines: ReadonlyArray<VisualStateLineMapping>,
  providerStateLines: ReadonlyArray<VisualStateLineMapping>,
  useBaseWhenMissing: boolean,
): ReadonlyArray<VisualStateLineMapping> {
  if (!useBaseWhenMissing) {
    return providerStateLines;
  }

  const providerStates = new Set(
    providerStateLines.map((mapping) => {
      return mapping.state;
    }),
  );

  return [
    ...providerStateLines,
    ...baseStateLines.filter((mapping) => {
      return !providerStates.has(mapping.state);
    }),
  ];
}

function mergeEmotionDescriptions(
  baseEmotionDescriptions: ReadonlyArray<VisualEmotionDescriptionMapping>,
  providerEmotionDescriptions: ReadonlyArray<VisualEmotionDescriptionMapping>,
  useBaseWhenMissing: boolean,
): ReadonlyArray<VisualEmotionDescriptionMapping> {
  if (!useBaseWhenMissing) {
    return providerEmotionDescriptions;
  }

  const providerEmotions = new Set(
    providerEmotionDescriptions.map((mapping) => {
      return mapping.emotion;
    }),
  );

  return [
    ...providerEmotionDescriptions,
    ...baseEmotionDescriptions.filter((mapping) => {
      return !providerEmotions.has(mapping.emotion);
    }),
  ];
}

export function createVisualAssetCatalogForProvider(
  catalogStore: VisualAssetCatalogStore,
  providerId: VisualAssetProviderId = BASE_VISUAL_ASSET_PROVIDER_ID,
): VisualAssetCatalog {
  const providerCatalog = getVisualAssetProviderCatalog(
    catalogStore,
    providerId,
  );

  if (providerId === BASE_VISUAL_ASSET_PROVIDER_ID) {
    return providerCatalog;
  }

  const useBaseWhenMissing =
    providerCatalog.useBaseProviderWhenMissing !== false;
  const baseCatalog = getVisualAssetProviderCatalog(
    catalogStore,
    BASE_VISUAL_ASSET_PROVIDER_ID,
  );

  const effectiveCatalog: VisualAssetCatalog = {
    version: providerCatalog.version,
    assets: useBaseWhenMissing
      ? [...providerCatalog.assets, ...baseCatalog.assets]
      : providerCatalog.assets,
    emotionDescriptions: mergeEmotionDescriptions(
      baseCatalog.emotionDescriptions,
      providerCatalog.emotionDescriptions,
      useBaseWhenMissing,
    ),
    mappings: mergeMappings(
      baseCatalog.mappings,
      providerCatalog.mappings,
      useBaseWhenMissing,
    ),
    stateLines: mergeStateLines(
      baseCatalog.stateLines,
      providerCatalog.stateLines,
      useBaseWhenMissing,
    ),
  };

  if (providerCatalog.useBaseProviderWhenMissing !== undefined) {
    return {
      ...effectiveCatalog,
      useBaseProviderWhenMissing: providerCatalog.useBaseProviderWhenMissing,
    };
  }

  return effectiveCatalog;
}
