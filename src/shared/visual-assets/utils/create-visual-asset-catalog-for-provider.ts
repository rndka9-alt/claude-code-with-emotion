import { BASE_VISUAL_ASSET_PROVIDER_ID } from "../constants/provider-metadata";
import type {
  VisualAssetCatalog,
  VisualAssetMapping,
  VisualAssetProviderId,
  VisualAssetRecord,
  VisualEmotionDescriptionMapping,
  VisualStateLineMapping,
} from "../types/visual-asset-types";
import { getVisualAssetProviderOverride } from "./get-visual-asset-provider-override";

function getBaseDefaultAssetId(
  assets: ReadonlyArray<VisualAssetRecord>,
): string | undefined {
  return assets.find((asset) => asset.isDefault === true)?.id;
}

function withDefaultAsset(
  assets: ReadonlyArray<VisualAssetRecord>,
  defaultAssetId: string | undefined,
): ReadonlyArray<VisualAssetRecord> {
  return assets.map((asset) => {
    return {
      ...asset,
      isDefault: asset.id === defaultAssetId,
    };
  });
}

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
  catalog: VisualAssetCatalog,
  providerId: VisualAssetProviderId = BASE_VISUAL_ASSET_PROVIDER_ID,
): VisualAssetCatalog {
  if (providerId === BASE_VISUAL_ASSET_PROVIDER_ID) {
    return {
      version: catalog.version,
      assets: catalog.assets,
      emotionDescriptions: catalog.emotionDescriptions,
      mappings: catalog.mappings,
      stateLines: catalog.stateLines,
    };
  }

  const providerOverride = getVisualAssetProviderOverride(catalog, providerId);
  const useBaseWhenMissing =
    providerOverride.useBaseProviderWhenMissing !== false;
  const defaultAssetId =
    providerOverride.defaultAssetId ??
    (useBaseWhenMissing ? getBaseDefaultAssetId(catalog.assets) : undefined);

  return {
    version: catalog.version,
    assets: withDefaultAsset(catalog.assets, defaultAssetId),
    emotionDescriptions: mergeEmotionDescriptions(
      catalog.emotionDescriptions,
      providerOverride.emotionDescriptions,
      useBaseWhenMissing,
    ),
    mappings: mergeMappings(
      catalog.mappings,
      providerOverride.mappings,
      useBaseWhenMissing,
    ),
    stateLines: mergeStateLines(
      catalog.stateLines,
      providerOverride.stateLines,
      useBaseWhenMissing,
    ),
  };
}
