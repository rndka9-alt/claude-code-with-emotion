import {
  EMOTION_PRESETS,
  STATE_PRESETS,
  isVisualEmotionPresetId,
  isVisualStatePresetId,
  type VisualEmotionPresetId,
  type VisualStatePresetId,
} from "../../visual-presets";
import type {
  AvailableVisualOptions,
  VisualAssetProviderId,
  VisualEmotionDescriptionOverrides,
} from "../types/visual-asset-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// codex provider 는 base catalog 위에 providerOverrides.codex 를 덧댄다.
// claude 는 항상 base 만 사용한다.
function readProviderOverride(
  catalog: Record<string, unknown>,
  providerId: VisualAssetProviderId,
): Record<string, unknown> | null {
  if (providerId !== "codex") {
    return null;
  }

  const providerOverrides = catalog.providerOverrides;

  if (!isRecord(providerOverrides)) {
    return null;
  }

  const override = providerOverrides.codex;

  return isRecord(override) ? override : null;
}

function collectMappingGroups(
  catalog: Record<string, unknown>,
  providerOverride: Record<string, unknown> | null,
  providerUsesBase: boolean,
  key: "mappings" | "emotionDescriptions",
): unknown[][] {
  const groups: unknown[][] = [];
  const baseValue = catalog[key];

  if (providerUsesBase && Array.isArray(baseValue)) {
    groups.push(baseValue);
  }

  const overrideValue = providerOverride === null ? undefined : providerOverride[key];

  if (Array.isArray(overrideValue)) {
    groups.push(overrideValue);
  }

  return groups;
}

// catalog 는 디스크에서 읽은 raw JSON(bin 헬퍼) 또는 메모리 내 catalog(메인) 둘 다 받을 수 있어
// unknown 으로 받고 타입가드로 좁힌다. emotion/state id 는 visual-presets 의 가드로 검증한다.
export function collectAvailableVisualOptions(
  catalog: unknown,
  providerId: VisualAssetProviderId = "claude",
): AvailableVisualOptions {
  const emotionDescriptions: VisualEmotionDescriptionOverrides = {};

  if (!isRecord(catalog)) {
    return { states: [], emotions: [], emotionDescriptions };
  }

  const providerOverride = readProviderOverride(catalog, providerId);
  const providerUsesBase =
    providerId !== "codex" ||
    providerOverride === null ||
    providerOverride.useBaseProviderWhenMissing !== false;

  const mappedStates = new Set<VisualStatePresetId>();
  const mappedEmotions = new Set<VisualEmotionPresetId>();

  for (const mappings of collectMappingGroups(
    catalog,
    providerOverride,
    providerUsesBase,
    "mappings",
  )) {
    for (const mapping of mappings) {
      if (!isRecord(mapping)) {
        continue;
      }

      if (
        typeof mapping.state === "string" &&
        isVisualStatePresetId(mapping.state)
      ) {
        mappedStates.add(mapping.state);
      }

      if (
        typeof mapping.emotion === "string" &&
        isVisualEmotionPresetId(mapping.emotion) &&
        mapping.emotion !== "neutral"
      ) {
        mappedEmotions.add(mapping.emotion);
      }
    }
  }

  // 표시 순서는 preset 정의 순서로 안정화한다(매핑 입력 순서에 의존하지 않음).
  const states = STATE_PRESETS.filter((preset) =>
    mappedStates.has(preset.id),
  ).map((preset) => preset.id);
  const emotions = EMOTION_PRESETS.filter(
    (preset) => preset.id !== "neutral" && mappedEmotions.has(preset.id),
  ).map((preset) => preset.id);

  // emotion 설명: 매핑된 emotion 의 기본 설명(EMOTION_PRESETS)을 먼저 깔고,
  // catalog override 가 있으면 그 위에 덮어쓴다. 커스텀이 없어도 기본 설명이 노출된다.
  for (const emotion of emotions) {
    const preset = EMOTION_PRESETS.find((candidate) => candidate.id === emotion);

    if (preset !== undefined) {
      emotionDescriptions[emotion] = preset.description;
    }
  }

  for (const descriptions of collectMappingGroups(
    catalog,
    providerOverride,
    providerUsesBase,
    "emotionDescriptions",
  )) {
    for (const mapping of descriptions) {
      if (!isRecord(mapping)) {
        continue;
      }

      if (
        typeof mapping.emotion === "string" &&
        isVisualEmotionPresetId(mapping.emotion) &&
        typeof mapping.description === "string" &&
        mapping.description.length > 0
      ) {
        emotionDescriptions[mapping.emotion] = mapping.description;
      }
    }
  }

  return { states, emotions, emotionDescriptions };
}
