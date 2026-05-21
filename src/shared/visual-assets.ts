import {
  EMOTION_PRESETS,
  STATE_PRESETS,
  type VisualEmotionPresetId,
  type VisualStatePresetId,
} from "./visual-presets";

export type VisualAssetProviderId = "claude" | "codex";

export interface VisualAssetProviderOption {
  id: VisualAssetProviderId;
  isBase: boolean;
  label: string;
}

export const BASE_VISUAL_ASSET_PROVIDER_ID = "claude";

export const VISUAL_ASSET_PROVIDER_OPTIONS: ReadonlyArray<VisualAssetProviderOption> =
  [
    {
      id: "claude",
      isBase: true,
      label: "Claude Code",
    },
    {
      id: "codex",
      isBase: false,
      label: "Codex",
    },
  ];

export interface VisualProviderStateMetadata {
  description: string;
  eventNames: ReadonlyArray<string>;
  state: VisualStatePresetId;
}

export const VISUAL_PROVIDER_STATE_METADATA: Record<
  VisualAssetProviderId,
  ReadonlyArray<VisualProviderStateMetadata>
> = {
  claude: STATE_PRESETS.map((preset) => {
    return {
      description: preset.description,
      eventNames: [],
      state: preset.id,
    };
  }),
  codex: [
    {
      description: "Codex CLI가 아직 연결되지 않았거나 종료된 상태예요.",
      eventNames: ["Codex wrapper start/end"],
      state: "disconnected",
    },
    {
      description: "Codex가 요청을 읽거나 도구 결과를 정리하는 상태예요.",
      eventNames: ["UserPromptSubmit", "PostToolUse"],
      state: "thinking",
    },
    {
      description: "Codex가 도구 실행을 준비하거나 실제 작업으로 들어가는 상태예요.",
      eventNames: ["PreToolUse", "Codex wrapper start"],
      state: "working",
    },
    {
      description: "Codex가 다음 입력을 기다리는 상태예요.",
      eventNames: ["SessionStart", "Stop"],
      state: "waiting",
    },
    {
      description: "Codex가 권한 확인 응답을 기다리는 상태예요.",
      eventNames: ["PermissionRequest"],
      state: "permission_wait",
    },
    {
      description: "Codex가 대화 맥락을 압축하는 상태예요.",
      eventNames: ["PreCompact"],
      state: "compacting",
    },
    {
      description: "Codex가 대화 맥락 압축을 마친 상태예요.",
      eventNames: ["PostCompact"],
      state: "completed",
    },
    {
      description: "Codex CLI 실행이 오류로 끝난 상태예요.",
      eventNames: ["Codex wrapper error"],
      state: "error",
    },
  ],
};

export interface VisualAssetRecord {
  id: string;
  isDefault?: boolean;
  kind: "image";
  label: string;
  path: string;
}

export interface VisualAssetMapping {
  assetId: string;
  emotion?: VisualEmotionPresetId;
  state?: VisualStatePresetId;
}

export interface VisualStateLineMapping {
  line: string;
  state: VisualStatePresetId;
}

export interface VisualEmotionDescriptionMapping {
  description: string;
  emotion: VisualEmotionPresetId;
}

export interface VisualAssetProviderOverride {
  defaultAssetId: string | undefined;
  emotionDescriptions: ReadonlyArray<VisualEmotionDescriptionMapping>;
  mappings: ReadonlyArray<VisualAssetMapping>;
  stateLines: ReadonlyArray<VisualStateLineMapping>;
  useBaseProviderWhenMissing: boolean;
}

export type VisualAssetProviderOverrides = Partial<
  Record<Exclude<VisualAssetProviderId, "claude">, VisualAssetProviderOverride>
>;

export interface VisualAssetCatalog {
  assets: ReadonlyArray<VisualAssetRecord>;
  emotionDescriptions: ReadonlyArray<VisualEmotionDescriptionMapping>;
  mappings: ReadonlyArray<VisualAssetMapping>;
  providerOverrides?: VisualAssetProviderOverrides;
  stateLines: ReadonlyArray<VisualStateLineMapping>;
  version: 1;
}

export interface VisualAssetResolutionRequest {
  emotion: VisualEmotionPresetId | null;
  providerId?: VisualAssetProviderId;
  state: VisualStatePresetId;
}

export interface VisualAssetResolution {
  asset: VisualAssetRecord;
  mapping: VisualAssetMapping | null;
  match: "default" | "emotion" | "state" | "state-and-emotion";
}

export type VisualEmotionDescriptionOverrides = Partial<
  Record<VisualEmotionPresetId, string>
>;

export interface AvailableVisualOptions {
  emotionDescriptions: VisualEmotionDescriptionOverrides;
  emotions: VisualEmotionPresetId[];
  states: VisualStatePresetId[];
}

export function createEmptyVisualAssetCatalog(): VisualAssetCatalog {
  return {
    version: 1,
    assets: [],
    emotionDescriptions: [],
    mappings: [],
    stateLines: [],
  };
}

function findAssetRecord(
  assets: ReadonlyArray<VisualAssetRecord>,
  assetId: string,
): VisualAssetRecord | null {
  const asset = assets.find((candidate) => candidate.id === assetId);

  return asset !== undefined ? asset : null;
}

function resolveFromMapping(
  assets: ReadonlyArray<VisualAssetRecord>,
  mappings: ReadonlyArray<VisualAssetMapping>,
  matcher: (mapping: VisualAssetMapping) => boolean,
  match: VisualAssetResolution["match"],
): VisualAssetResolution | null {
  for (const mapping of mappings) {
    if (!matcher(mapping)) {
      continue;
    }

    const asset = findAssetRecord(assets, mapping.assetId);

    if (asset !== null) {
      return {
        asset,
        mapping,
        match,
      };
    }
  }

  return null;
}

function createEmptyProviderOverride(): VisualAssetProviderOverride {
  return {
    defaultAssetId: undefined,
    emotionDescriptions: [],
    mappings: [],
    stateLines: [],
    useBaseProviderWhenMissing: true,
  };
}

export function normalizeVisualAssetProviderId(
  providerId: string | null | undefined,
): VisualAssetProviderId {
  return providerId === "codex" ? "codex" : BASE_VISUAL_ASSET_PROVIDER_ID;
}

export function getVisualAssetProviderOverride(
  catalog: VisualAssetCatalog,
  providerId: VisualAssetProviderId,
): VisualAssetProviderOverride {
  if (providerId === BASE_VISUAL_ASSET_PROVIDER_ID) {
    return {
      defaultAssetId: catalog.assets.find((asset) => asset.isDefault === true)
        ?.id,
      emotionDescriptions: catalog.emotionDescriptions,
      mappings: catalog.mappings,
      stateLines: catalog.stateLines,
      useBaseProviderWhenMissing: false,
    };
  }

  return {
    ...createEmptyProviderOverride(),
    ...catalog.providerOverrides?.[providerId],
  };
}

export function getVisualAssetProviderStateMetadata(
  providerId: VisualAssetProviderId,
): ReadonlyArray<VisualProviderStateMetadata> {
  return VISUAL_PROVIDER_STATE_METADATA[providerId];
}

export function isVisualAssetDefaultForProvider(
  catalog: VisualAssetCatalog,
  assetId: string,
  providerId: VisualAssetProviderId = BASE_VISUAL_ASSET_PROVIDER_ID,
): boolean {
  if (providerId === BASE_VISUAL_ASSET_PROVIDER_ID) {
    return catalog.assets.some((asset) => {
      return asset.id === assetId && asset.isDefault === true;
    });
  }

  return getVisualAssetProviderOverride(catalog, providerId).defaultAssetId ===
    assetId;
}

export function getVisualAssetProviderMappings(
  catalog: VisualAssetCatalog,
  providerId: VisualAssetProviderId = BASE_VISUAL_ASSET_PROVIDER_ID,
): ReadonlyArray<VisualAssetMapping> {
  return getVisualAssetProviderOverride(catalog, providerId).mappings;
}

export function getVisualAssetProviderStateLines(
  catalog: VisualAssetCatalog,
  providerId: VisualAssetProviderId = BASE_VISUAL_ASSET_PROVIDER_ID,
): ReadonlyArray<VisualStateLineMapping> {
  return getVisualAssetProviderOverride(catalog, providerId).stateLines;
}

export function getVisualAssetProviderEmotionDescriptions(
  catalog: VisualAssetCatalog,
  providerId: VisualAssetProviderId = BASE_VISUAL_ASSET_PROVIDER_ID,
): ReadonlyArray<VisualEmotionDescriptionMapping> {
  return getVisualAssetProviderOverride(catalog, providerId)
    .emotionDescriptions;
}

function providerShouldUseBaseWhenMissing(
  catalog: VisualAssetCatalog,
  providerId: VisualAssetProviderId,
): boolean {
  return (
    providerId !== BASE_VISUAL_ASSET_PROVIDER_ID &&
    getVisualAssetProviderOverride(catalog, providerId)
      .useBaseProviderWhenMissing !== false
  );
}

function resolveVisualAssetFromMappings(
  assets: ReadonlyArray<VisualAssetRecord>,
  mappings: ReadonlyArray<VisualAssetMapping>,
  defaultAssetId: string | undefined,
  request: VisualAssetResolutionRequest,
): VisualAssetResolution | null {
  if (request.emotion !== null) {
    const exactMatch = resolveFromMapping(
      assets,
      mappings,
      (mapping) =>
        mapping.state === request.state && mapping.emotion === request.emotion,
      "state-and-emotion",
    );

    if (exactMatch !== null) {
      return exactMatch;
    }

    const emotionOnlyMatch = resolveFromMapping(
      assets,
      mappings,
      (mapping) =>
        mapping.state === undefined && mapping.emotion === request.emotion,
      "emotion",
    );

    if (emotionOnlyMatch !== null) {
      return emotionOnlyMatch;
    }
  }

  const stateOnlyMatch = resolveFromMapping(
    assets,
    mappings,
    (mapping) =>
      mapping.state === request.state && mapping.emotion === undefined,
    "state",
  );

  if (stateOnlyMatch !== null) {
    return stateOnlyMatch;
  }

  if (defaultAssetId === undefined) {
    return null;
  }

  const defaultAsset = findAssetRecord(assets, defaultAssetId);

  if (defaultAsset === null) {
    return null;
  }

  return {
    asset: defaultAsset,
    mapping: null,
    match: "default",
  };
}

export function collectAvailableVisualOptions(
  catalog: VisualAssetCatalog,
  providerId: VisualAssetProviderId = BASE_VISUAL_ASSET_PROVIDER_ID,
): AvailableVisualOptions {
  const mappedStates = new Set<VisualStatePresetId>();
  const mappedEmotions = new Set<VisualEmotionPresetId>();
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

export function resolveVisualAsset(
  catalog: VisualAssetCatalog,
  request: VisualAssetResolutionRequest,
): VisualAssetResolution | null {
  // 우선순위: state+emotion 조합 > emotion 전용 > state 전용 > 기본값.
  // emotion 이 명시적으로 설정댓을 때(MCP 툴 호출 등) 그 emotion 자산이 state
  // 자산에 가려지지 않도록 state 전용보다 먼저 본다. emotion 이 null 이면
  // emotion 전용 단계는 건너뛰고 state 전용이 주인공 역할을 한다.
  const providerId = normalizeVisualAssetProviderId(request.providerId);
  const providerOverride = getVisualAssetProviderOverride(catalog, providerId);
  const providerResolution = resolveVisualAssetFromMappings(
    catalog.assets,
    providerOverride.mappings,
    providerOverride.defaultAssetId,
    request,
  );

  if (providerResolution !== null) {
    return providerResolution;
  }

  if (!providerShouldUseBaseWhenMissing(catalog, providerId)) {
    return null;
  }

  return resolveVisualAssetFromMappings(
    catalog.assets,
    catalog.mappings,
    catalog.assets.find((asset) => asset.isDefault === true)?.id,
    request,
  );
}

export function resolveVisualStateLine(
  catalog: VisualAssetCatalog,
  state: VisualStatePresetId,
  providerId: VisualAssetProviderId = BASE_VISUAL_ASSET_PROVIDER_ID,
): string | null {
  const providerOverride = getVisualAssetProviderOverride(catalog, providerId);
  const mapping = providerOverride.stateLines.find(
    (candidate) => candidate.state === state,
  );

  if (mapping !== undefined) {
    return mapping.line;
  }

  if (!providerShouldUseBaseWhenMissing(catalog, providerId)) {
    return null;
  }

  const baseMapping = catalog.stateLines.find(
    (candidate) => candidate.state === state,
  );

  return baseMapping?.line ?? null;
}

export function resolveVisualEmotionDescription(
  catalog: VisualAssetCatalog,
  emotion: VisualEmotionPresetId,
  providerId: VisualAssetProviderId = BASE_VISUAL_ASSET_PROVIDER_ID,
): string | null {
  const providerOverride = getVisualAssetProviderOverride(catalog, providerId);
  const mapping = providerOverride.emotionDescriptions.find(
    (candidate) => candidate.emotion === emotion,
  );

  if (mapping !== undefined) {
    return mapping.description;
  }

  if (!providerShouldUseBaseWhenMissing(catalog, providerId)) {
    return null;
  }

  const baseMapping = catalog.emotionDescriptions.find(
    (candidate) => candidate.emotion === emotion,
  );

  return baseMapping?.description ?? null;
}
