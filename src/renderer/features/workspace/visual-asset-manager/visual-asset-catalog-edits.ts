import {
  BASE_VISUAL_ASSET_PROVIDER_ID,
  type VisualAssetCatalog,
  type VisualAssetCatalogStore,
  type VisualAssetMapping,
  type VisualAssetProviderId,
  type VisualAssetRecord,
  getVisualAssetProviderCatalog,
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

function updateProviderCatalog(
  catalogStore: VisualAssetCatalogStore,
  providerId: VisualAssetProviderId,
  update: (catalog: VisualAssetCatalog) => VisualAssetCatalog,
): VisualAssetCatalogStore {
  return {
    ...catalogStore,
    providers: {
      ...catalogStore.providers,
      [providerId]: update(
        getVisualAssetProviderCatalog(catalogStore, providerId),
      ),
    },
  };
}

function updateProviderMappings(
  catalogStore: VisualAssetCatalogStore,
  providerId: VisualAssetProviderId,
  update: (
    mappings: ReadonlyArray<VisualAssetMapping>,
  ) => ReadonlyArray<VisualAssetMapping>,
): VisualAssetCatalogStore {
  return updateProviderCatalog(catalogStore, providerId, (catalog) => {
    return {
      ...catalog,
      mappings: update(catalog.mappings),
    };
  });
}

export function mergePickedVisualAssets(
  catalogStore: VisualAssetCatalogStore,
  files: ReadonlyArray<VisualAssetPickerFile>,
  createId: () => string = createVisualAssetId,
  providerId: VisualAssetProviderId = BASE_VISUAL_ASSET_PROVIDER_ID,
): VisualAssetCatalogStore {
  const catalog = getVisualAssetProviderCatalog(catalogStore, providerId);
  const knownPaths = new Set(catalog.assets.map((asset) => asset.path));
  let nextAssets: VisualAssetRecord[] = [...catalog.assets];
  let nextDefaultAssetId = catalog.assets.find((asset) => {
    return asset.isDefault === true;
  })?.id;
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
      nextDefaultAssetId = nextAssetId;
    }

    if (filenameAssignment !== null && filenameAssignment.pair !== null) {
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

  return updateProviderCatalog(catalogStore, providerId, (currentCatalog) => {
    return {
      ...currentCatalog,
      assets: nextAssets.map((asset) => {
        return {
          ...asset,
          isDefault: asset.id === nextDefaultAssetId,
        };
      }),
      mappings: nextMappings,
    };
  });
}

export function removeVisualAsset(
  catalogStore: VisualAssetCatalogStore,
  assetId: string,
  providerId: VisualAssetProviderId = BASE_VISUAL_ASSET_PROVIDER_ID,
): VisualAssetCatalogStore {
  return updateProviderCatalog(catalogStore, providerId, (catalog) => {
    return {
      ...catalog,
      assets: catalog.assets.filter((asset) => asset.id !== assetId),
      mappings: catalog.mappings.filter((mapping) => {
        return mapping.assetId !== assetId;
      }),
    };
  });
}

export function setVisualAssetDefault(
  catalogStore: VisualAssetCatalogStore,
  assetId: string,
  isDefault: boolean,
  providerId: VisualAssetProviderId = BASE_VISUAL_ASSET_PROVIDER_ID,
): VisualAssetCatalogStore {
  return updateProviderCatalog(catalogStore, providerId, (catalog) => {
    return {
      ...catalog,
      assets: catalog.assets.map((asset) => {
        return {
          ...asset,
          isDefault: isDefault && asset.id === assetId,
        };
      }),
    };
  });
}

// 각 슬롯(state, emotion, state+emotion pair)은 1:1 로 유지돼요.
// isEnabled=true 일 때 다른 에셋이 점유 중이면 그 매핑을 뺏어오고, 본인 걸 꽂음.
// isEnabled=false 면 그 슬롯을 비우기만 함.
export function setVisualAssetStateMapping(
  catalogStore: VisualAssetCatalogStore,
  assetId: string,
  state: VisualStatePresetId,
  isEnabled: boolean,
  providerId: VisualAssetProviderId = BASE_VISUAL_ASSET_PROVIDER_ID,
): VisualAssetCatalogStore {
  return updateProviderMappings(catalogStore, providerId, (mappings) => {
    const nextMappings = removeMatchingStateOnlyMappings(mappings, state);

    if (isEnabled) {
      nextMappings.push({
        assetId,
        state,
      });
    }

    return nextMappings;
  });
}

export function setVisualAssetEmotionMapping(
  catalogStore: VisualAssetCatalogStore,
  assetId: string,
  emotion: VisualEmotionPresetId,
  isEnabled: boolean,
  providerId: VisualAssetProviderId = BASE_VISUAL_ASSET_PROVIDER_ID,
): VisualAssetCatalogStore {
  return updateProviderMappings(catalogStore, providerId, (mappings) => {
    const nextMappings = removeMatchingEmotionOnlyMappings(mappings, emotion);

    if (isEnabled) {
      nextMappings.push({
        assetId,
        emotion,
      });
    }

    return nextMappings;
  });
}

export function setVisualAssetStateEmotionMapping(
  catalogStore: VisualAssetCatalogStore,
  assetId: string,
  state: VisualStatePresetId,
  emotion: VisualEmotionPresetId,
  isEnabled: boolean,
  providerId: VisualAssetProviderId = BASE_VISUAL_ASSET_PROVIDER_ID,
): VisualAssetCatalogStore {
  return updateProviderMappings(catalogStore, providerId, (mappings) => {
    const nextMappings = removeMatchingStateEmotionMappings(
      mappings,
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

    return nextMappings;
  });
}

// 슬롯 점유자 조회. 해당 매핑이 가리키는 자산이 실제로 카탈로그에 남아 잇을 때만 반환해요.
// resolveFromMapping 과 동일하게 배열 순서상 첫 번째 유효 매핑을 리턴해요.
function findSlotOwnerAssetId(
  catalogStore: VisualAssetCatalogStore,
  matcher: (mapping: VisualAssetMapping) => boolean,
  providerId: VisualAssetProviderId = BASE_VISUAL_ASSET_PROVIDER_ID,
): string | null {
  const catalog = getVisualAssetProviderCatalog(catalogStore, providerId);
  const knownAssetIds = new Set(catalog.assets.map((asset) => asset.id));
  const mappings = catalog.mappings;

  for (const mapping of mappings) {
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
  catalogStore: VisualAssetCatalogStore,
  state: VisualStatePresetId,
  providerId: VisualAssetProviderId = BASE_VISUAL_ASSET_PROVIDER_ID,
): string | null {
  return findSlotOwnerAssetId(catalogStore, (mapping) => {
    return mapping.state === state && mapping.emotion === undefined;
  }, providerId);
}

export function findVisualAssetEmotionOwner(
  catalogStore: VisualAssetCatalogStore,
  emotion: VisualEmotionPresetId,
  providerId: VisualAssetProviderId = BASE_VISUAL_ASSET_PROVIDER_ID,
): string | null {
  return findSlotOwnerAssetId(catalogStore, (mapping) => {
    return mapping.state === undefined && mapping.emotion === emotion;
  }, providerId);
}

export function findVisualAssetStateEmotionOwner(
  catalogStore: VisualAssetCatalogStore,
  state: VisualStatePresetId,
  emotion: VisualEmotionPresetId,
  providerId: VisualAssetProviderId = BASE_VISUAL_ASSET_PROVIDER_ID,
): string | null {
  return findSlotOwnerAssetId(catalogStore, (mapping) => {
    return mapping.state === state && mapping.emotion === emotion;
  }, providerId);
}

export function setVisualAssetStateLine(
  catalogStore: VisualAssetCatalogStore,
  state: VisualStatePresetId,
  line: string,
  providerId: VisualAssetProviderId = BASE_VISUAL_ASSET_PROVIDER_ID,
): VisualAssetCatalogStore {
  const trimmedLine = line.trim();

  return updateProviderCatalog(catalogStore, providerId, (catalog) => {
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
  });
}

export function setVisualAssetEmotionDescription(
  catalogStore: VisualAssetCatalogStore,
  emotion: VisualEmotionPresetId,
  description: string,
  providerId: VisualAssetProviderId = BASE_VISUAL_ASSET_PROVIDER_ID,
): VisualAssetCatalogStore {
  const trimmedDescription = description.trim();

  return updateProviderCatalog(catalogStore, providerId, (catalog) => {
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
  });
}

export function setVisualAssetProviderFallback(
  catalogStore: VisualAssetCatalogStore,
  providerId: VisualAssetProviderId,
  useBaseProviderWhenMissing: boolean,
): VisualAssetCatalogStore {
  if (providerId === BASE_VISUAL_ASSET_PROVIDER_ID) {
    return catalogStore;
  }

  return updateProviderCatalog(catalogStore, providerId, (catalog) => {
    return {
      ...catalog,
      useBaseProviderWhenMissing,
    };
  });
}
