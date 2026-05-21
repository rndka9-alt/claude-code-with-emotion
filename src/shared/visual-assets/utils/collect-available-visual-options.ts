import { EMOTION_PRESETS, STATE_PRESETS } from "../../visual-presets";
import type {
  AvailableVisualOptions,
  VisualAssetCatalog,
  VisualEmotionDescriptionOverrides,
} from "../types/visual-asset-types";

export function collectAvailableVisualOptions(
  catalog: VisualAssetCatalog,
): AvailableVisualOptions {
  const mappedStates = new Set<string>();
  const mappedEmotions = new Set<string>();

  for (const mapping of catalog.mappings) {
    if (mapping.state !== undefined) {
      mappedStates.add(mapping.state);
    }

    if (mapping.emotion !== undefined) {
      mappedEmotions.add(mapping.emotion);
    }
  }

  const emotionDescriptions: VisualEmotionDescriptionOverrides = {};

  for (const mapping of catalog.emotionDescriptions) {
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
