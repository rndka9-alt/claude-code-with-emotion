import {
  type VisualAssetCatalog,
  type VisualAssetMapping,
  type VisualAssetRecord,
} from "../../../../shared/visual-assets";
import {
  EMOTION_PRESETS,
  STATE_PRESETS,
  type VisualEmotionPresetId,
  type VisualStatePresetId,
} from "../../../../shared/visual-presets";
import type { VisualAssetPickerFile } from "../../../../shared/visual-assets-bridge";

// 파일명 자동 매핑 결과.
// 세 필드 중 최대 한 개만 채워져요:
//  - pair: 상태 1 + 감정 1 (state+emotion 결합 슬롯)
//  - states: 상태 N개 (emotions 비어잇음)
//  - emotions: 감정 M개 (states 비어잇음)
// 혼합인데 1:1 이 아니면 카운트 큰 쪽을 택하고, 동점이면 감정이 이겨요.
interface AutoVisualAssetAssignment {
  emotions: VisualEmotionPresetId[];
  isDefault: boolean;
  pair: {
    emotion: VisualEmotionPresetId;
    state: VisualStatePresetId;
  } | null;
  states: VisualStatePresetId[];
}

const visualAssetFilenameExtensionPattern = /\.[^.]+$/;

function createVisualAssetId(): string {
  return `visual-asset-${crypto.randomUUID()}`;
}

function normalizeVisualAssetFilenameToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\-\s]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createPresetAliasMap<TPresetId extends string>(
  entries: ReadonlyArray<{
    id: TPresetId;
    label: string;
  }>,
): Map<string, TPresetId> {
  const aliasMap = new Map<string, TPresetId>();

  for (const entry of entries) {
    aliasMap.set(normalizeVisualAssetFilenameToken(entry.id), entry.id);
    aliasMap.set(normalizeVisualAssetFilenameToken(entry.label), entry.id);
  }

  return aliasMap;
}

const stateFilenameAliasMap = createPresetAliasMap(
  STATE_PRESETS.map((preset) => {
    return {
      id: preset.id,
      label: preset.label,
    };
  }),
);

const emotionFilenameAliasMap = createPresetAliasMap(
  EMOTION_PRESETS.filter((preset) => preset.id !== "neutral").map((preset) => {
    return {
      id: preset.id,
      label: preset.label,
    };
  }),
);

function parseVisualAssetFilenameAssignment(
  label: string,
): AutoVisualAssetAssignment | null {
  const segments = label
    .replace(visualAssetFilenameExtensionPattern, "")
    .split(/__+/)
    .map((segment) => normalizeVisualAssetFilenameToken(segment))
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return null;
  }

  const states = new Set<VisualStatePresetId>();
  const emotions = new Set<VisualEmotionPresetId>();
  let isDefault = false;

  for (const segment of segments) {
    if (segment === "default") {
      isDefault = true;
      continue;
    }

    const matchedState = stateFilenameAliasMap.get(segment);

    if (matchedState !== undefined) {
      states.add(matchedState);
      continue;
    }

    const matchedEmotion = emotionFilenameAliasMap.get(segment);

    if (matchedEmotion !== undefined) {
      emotions.add(matchedEmotion);
    }
  }

  if (!isDefault && states.size === 0 && emotions.size === 0) {
    return null;
  }

  // 1:1 혼합은 state+emotion 결합 슬롯으로 묶어서 기존 동작 유지.
  const [firstState] = states;
  const [firstEmotion] = emotions;

  if (
    states.size === 1 &&
    emotions.size === 1 &&
    firstState !== undefined &&
    firstEmotion !== undefined
  ) {
    return {
      emotions: [],
      isDefault,
      pair: { emotion: firstEmotion, state: firstState },
      states: [],
    };
  }

  // 한쪽만 있으면 그 카테고리의 슬롯을 전부 차지.
  // 혼합인데 1:1 아니면 카운트 큰 쪽만 반영, 동점이면 감정 우선.
  const emotionsWin = emotions.size >= states.size;

  if (emotionsWin && emotions.size > 0) {
    return {
      emotions: Array.from(emotions),
      isDefault,
      pair: null,
      states: [],
    };
  }

  if (states.size > 0) {
    return {
      emotions: [],
      isDefault,
      pair: null,
      states: Array.from(states),
    };
  }

  return {
    emotions: [],
    isDefault,
    pair: null,
    states: [],
  };
}

function removeMatchingStateOnlyMappings(
  mappings: ReadonlyArray<VisualAssetMapping>,
  state: VisualStatePresetId,
): VisualAssetMapping[] {
  return mappings.filter((mapping) => {
    return !(mapping.state === state && mapping.emotion === undefined);
  });
}

function removeMatchingEmotionOnlyMappings(
  mappings: ReadonlyArray<VisualAssetMapping>,
  emotion: VisualEmotionPresetId,
): VisualAssetMapping[] {
  return mappings.filter((mapping) => {
    return !(mapping.state === undefined && mapping.emotion === emotion);
  });
}

function removeMatchingStateEmotionMappings(
  mappings: ReadonlyArray<VisualAssetMapping>,
  state: VisualStatePresetId,
  emotion: VisualEmotionPresetId,
): VisualAssetMapping[] {
  return mappings.filter((mapping) => {
    return !(mapping.state === state && mapping.emotion === emotion);
  });
}

export function mergePickedVisualAssets(
  catalog: VisualAssetCatalog,
  files: ReadonlyArray<VisualAssetPickerFile>,
  createId: () => string = createVisualAssetId,
): VisualAssetCatalog {
  const knownPaths = new Set(catalog.assets.map((asset) => asset.path));
  let nextAssets: VisualAssetRecord[] = [...catalog.assets];
  let nextMappings: VisualAssetMapping[] = [...catalog.mappings];

  for (const file of files) {
    if (knownPaths.has(file.path)) {
      continue;
    }

    const nextAssetId = createId();
    const filenameAssignment = parseVisualAssetFilenameAssignment(file.label);

    nextAssets = [
      ...nextAssets,
      {
        id: nextAssetId,
        kind: "image",
        label: file.label,
        path: file.path,
      },
    ];

    if (filenameAssignment?.isDefault === true) {
      nextAssets = nextAssets.map((asset) => {
        if (asset.id === nextAssetId) {
          return {
            ...asset,
            isDefault: true,
          };
        }

        if (asset.isDefault === true) {
          return {
            ...asset,
            isDefault: false,
          };
        }

        return asset;
      });
    }

    if (
      filenameAssignment !== null &&
      filenameAssignment.pair !== null
    ) {
      const { emotion, state } = filenameAssignment.pair;

      nextMappings = removeMatchingStateEmotionMappings(
        nextMappings,
        state,
        emotion,
      );
      nextMappings.push({
        assetId: nextAssetId,
        emotion,
        state,
      });
    } else if (
      filenameAssignment !== null &&
      filenameAssignment.states.length > 0
    ) {
      for (const state of filenameAssignment.states) {
        nextMappings = removeMatchingStateOnlyMappings(nextMappings, state);
        nextMappings.push({
          assetId: nextAssetId,
          state,
        });
      }
    } else if (
      filenameAssignment !== null &&
      filenameAssignment.emotions.length > 0
    ) {
      for (const emotion of filenameAssignment.emotions) {
        nextMappings = removeMatchingEmotionOnlyMappings(nextMappings, emotion);
        nextMappings.push({
          assetId: nextAssetId,
          emotion,
        });
      }
    }

    knownPaths.add(file.path);
  }

  return {
    ...catalog,
    assets: nextAssets,
    mappings: nextMappings,
  };
}

export function removeVisualAsset(
  catalog: VisualAssetCatalog,
  assetId: string,
): VisualAssetCatalog {
  return {
    ...catalog,
    assets: catalog.assets.filter((asset) => asset.id !== assetId),
    mappings: catalog.mappings.filter((mapping) => mapping.assetId !== assetId),
  };
}

export function setVisualAssetDefault(
  catalog: VisualAssetCatalog,
  assetId: string,
  isDefault: boolean,
): VisualAssetCatalog {
  return {
    ...catalog,
    assets: catalog.assets.map((asset) => {
      if (asset.id === assetId) {
        return {
          ...asset,
          isDefault,
        };
      }

      if (isDefault && asset.isDefault === true) {
        return {
          ...asset,
          isDefault: false,
        };
      }

      return asset;
    }),
  };
}

// 각 슬롯(state, emotion, state+emotion pair)은 1:1 로 유지돼요.
// isEnabled=true 일 때 다른 에셋이 점유 중이면 그 매핑을 뺏어오고, 본인 걸 꽂음.
// isEnabled=false 면 그 슬롯을 비우기만 함.
export function setVisualAssetStateMapping(
  catalog: VisualAssetCatalog,
  assetId: string,
  state: VisualStatePresetId,
  isEnabled: boolean,
): VisualAssetCatalog {
  const nextMappings = removeMatchingStateOnlyMappings(catalog.mappings, state);

  if (isEnabled) {
    nextMappings.push({
      assetId,
      state,
    });
  }

  return {
    ...catalog,
    mappings: nextMappings,
  };
}

export function setVisualAssetEmotionMapping(
  catalog: VisualAssetCatalog,
  assetId: string,
  emotion: VisualEmotionPresetId,
  isEnabled: boolean,
): VisualAssetCatalog {
  const nextMappings = removeMatchingEmotionOnlyMappings(
    catalog.mappings,
    emotion,
  );

  if (isEnabled) {
    nextMappings.push({
      assetId,
      emotion,
    });
  }

  return {
    ...catalog,
    mappings: nextMappings,
  };
}

export function setVisualAssetStateEmotionMapping(
  catalog: VisualAssetCatalog,
  assetId: string,
  state: VisualStatePresetId,
  emotion: VisualEmotionPresetId,
  isEnabled: boolean,
): VisualAssetCatalog {
  const nextMappings = removeMatchingStateEmotionMappings(
    catalog.mappings,
    state,
    emotion,
  );

  if (isEnabled) {
    nextMappings.push({
      assetId,
      state,
      emotion,
    });
  }

  return {
    ...catalog,
    mappings: nextMappings,
  };
}

// 슬롯 점유자 조회. 해당 매핑이 가리키는 자산이 실제로 카탈로그에 남아 잇을 때만 반환해요.
// resolveFromMapping 과 동일하게 배열 순서상 첫 번째 유효 매핑을 리턴해요.
function findSlotOwnerAssetId(
  catalog: VisualAssetCatalog,
  matcher: (mapping: VisualAssetMapping) => boolean,
): string | null {
  const knownAssetIds = new Set(catalog.assets.map((asset) => asset.id));

  for (const mapping of catalog.mappings) {
    if (!matcher(mapping)) {
      continue;
    }

    if (knownAssetIds.has(mapping.assetId)) {
      return mapping.assetId;
    }
  }

  return null;
}

export function findVisualAssetStateOwner(
  catalog: VisualAssetCatalog,
  state: VisualStatePresetId,
): string | null {
  return findSlotOwnerAssetId(catalog, (mapping) => {
    return mapping.state === state && mapping.emotion === undefined;
  });
}

export function findVisualAssetEmotionOwner(
  catalog: VisualAssetCatalog,
  emotion: VisualEmotionPresetId,
): string | null {
  return findSlotOwnerAssetId(catalog, (mapping) => {
    return mapping.state === undefined && mapping.emotion === emotion;
  });
}

export function findVisualAssetStateEmotionOwner(
  catalog: VisualAssetCatalog,
  state: VisualStatePresetId,
  emotion: VisualEmotionPresetId,
): string | null {
  return findSlotOwnerAssetId(catalog, (mapping) => {
    return mapping.state === state && mapping.emotion === emotion;
  });
}

export function setVisualAssetStateLine(
  catalog: VisualAssetCatalog,
  state: VisualStatePresetId,
  line: string,
): VisualAssetCatalog {
  const trimmedLine = line.trim();

  return {
    ...catalog,
    stateLines: [
      ...catalog.stateLines.filter((mapping) => mapping.state !== state),
      ...(trimmedLine.length > 0
        ? [
            {
              state,
              line: trimmedLine,
            },
          ]
        : []),
    ],
  };
}

export function setVisualAssetEmotionDescription(
  catalog: VisualAssetCatalog,
  emotion: VisualEmotionPresetId,
  description: string,
): VisualAssetCatalog {
  const trimmedDescription = description.trim();

  return {
    ...catalog,
    emotionDescriptions: [
      ...catalog.emotionDescriptions.filter(
        (mapping) => mapping.emotion !== emotion,
      ),
      ...(trimmedDescription.length > 0
        ? [
            {
              emotion,
              description: trimmedDescription,
            },
          ]
        : []),
    ],
  };
}
