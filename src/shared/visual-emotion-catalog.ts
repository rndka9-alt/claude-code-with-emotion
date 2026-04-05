import {
  EMOTION_PRESETS,
  type VisualEmotionPresetId,
} from "./visual-presets";

// neutral 은 오버레이 해제 용도라 매핑 여부와 무관하게 항상 노출.
const ALWAYS_INCLUDED_EMOTION_IDS: ReadonlySet<string> = new Set(["neutral"]);

export type VisualEmotionDescriptionOverrides = Partial<
  Record<VisualEmotionPresetId, string>
>;

export function buildEmotionCatalogSection(
  availableEmotionIds: readonly string[],
  overrides: VisualEmotionDescriptionOverrides = {},
): string {
  const includedIds = new Set<string>([
    ...ALWAYS_INCLUDED_EMOTION_IDS,
    ...availableEmotionIds,
  ]);

  const lines = EMOTION_PRESETS.filter((preset) =>
    includedIds.has(preset.id),
  ).map((preset) => {
    // 사용자가 커스텀한 설명이 잇으면 그걸 쓰고, 업스면 프리셋 기본 description 으로 폴백.
    const description = overrides[preset.id] ?? preset.description;
    return `- ${preset.id}: ${description}`;
  });

  return lines.join("\n");
}
