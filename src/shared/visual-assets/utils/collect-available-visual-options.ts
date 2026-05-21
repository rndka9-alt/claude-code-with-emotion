import { EMOTION_PRESETS, STATE_PRESETS } from "../../visual-presets";
import { BASE_VISUAL_ASSET_PROVIDER_ID } from "../constants/provider-metadata";
import type {
  AvailableVisualOptions,
  VisualAssetCatalog,
  VisualAssetProviderId,
  VisualEmotionDescriptionOverrides,
} from "../types/visual-asset-types";
import { getVisualAssetProviderOverride } from "./get-visual-asset-provider-override";
import { providerShouldUseBaseWhenMissing } from "./provider-should-use-base-when-missing";

export function collectAvailableVisualOptions(
  catalog: VisualAssetCatalog,
  providerId: VisualAssetProviderId = BASE_VISUAL_ASSET_PROVIDER_ID,
): AvailableVisualOptions {
  const mappedStates = new Set<string>();
  const mappedEmotions = new Set<string>();
  const providerOverride = getVisualAssetProviderOverride(catalog, providerId);
  const mappings =
    providerId === BASE_VISUAL_ASSET_PROVIDER_ID ||
    !providerShouldUseBaseWhenMissing(catalog, providerId)
      ? providerOverride.mappings
      : [...catalog.mappings, ...providerOverride.mappings];

  for (const mapping of mappings) {
    if (mapping.state !== undefined) {
      mappedStates.add(mapping.state);
    }

    if (mapping.emotion !== undefined) {
      mappedEmotions.add(mapping.emotion);
    }
  }

  const emotionDescriptions: VisualEmotionDescriptionOverrides = {};
  const descriptions =
    providerId === BASE_VISUAL_ASSET_PROVIDER_ID ||
    !providerShouldUseBaseWhenMissing(catalog, providerId)
      ? providerOverride.emotionDescriptions
      : [
          ...catalog.emotionDescriptions,
          ...providerOverride.emotionDescriptions,
        ];

  for (const mapping of descriptions) {
    emotionDescriptions[mapping.emotion] = mapping.description;
  }

  return {
    states: STATE_PRESETS.filter((preset) => mappedStates.has(preset.id)).map(
      (preset) => preset.id,
    ),
    emotions: EMOTION_PRESETS.filter((preset) =>
      mappedEmotions.has(preset.id),
    ).map((preset) => preset.id),
    emotionDescriptions,
  };
}
