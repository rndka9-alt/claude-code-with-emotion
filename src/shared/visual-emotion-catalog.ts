import { EMOTION_PRESETS } from "./visual-presets";

// neutral 은 오버레이 해제 용도라 매핑 여부와 무관하게 항상 노출.
const ALWAYS_INCLUDED_EMOTION_IDS: ReadonlySet<string> = new Set(["neutral"]);

export function buildEmotionCatalogSection(
  availableEmotionIds: readonly string[],
): string {
  const includedIds = new Set<string>([
    ...ALWAYS_INCLUDED_EMOTION_IDS,
    ...availableEmotionIds,
  ]);

  const lines = EMOTION_PRESETS.filter((preset) =>
    includedIds.has(preset.id),
  ).map((preset) => `- ${preset.id}: ${preset.description}`);

  return lines.join("\n");
}
