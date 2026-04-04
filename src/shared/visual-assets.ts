import {
  EMOTION_PRESETS,
  STATE_PRESETS,
  type VisualEmotionPresetId,
  type VisualStatePresetId,
} from "./visual-presets";

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

export interface VisualAssetCatalog {
  assets: ReadonlyArray<VisualAssetRecord>;
  mappings: ReadonlyArray<VisualAssetMapping>;
  stateLines: ReadonlyArray<VisualStateLineMapping>;
  version: 1;
}

export interface VisualAssetResolutionRequest {
  emotion: VisualEmotionPresetId | null;
  state: VisualStatePresetId;
}

export interface VisualAssetResolution {
  asset: VisualAssetRecord;
  mapping: VisualAssetMapping | null;
  match: "default" | "emotion" | "state" | "state-and-emotion";
}

export interface AvailableVisualOptions {
  emotions: VisualEmotionPresetId[];
  states: VisualStatePresetId[];
}

export function createEmptyVisualAssetCatalog(): VisualAssetCatalog {
  return {
    version: 1,
    assets: [],
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
  catalog: VisualAssetCatalog,
  matcher: (mapping: VisualAssetMapping) => boolean,
  match: VisualAssetResolution["match"],
): VisualAssetResolution | null {
  for (const mapping of catalog.mappings) {
    if (!matcher(mapping)) {
      continue;
    }

    const asset = findAssetRecord(catalog.assets, mapping.assetId);

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

export function collectAvailableVisualOptions(
  catalog: VisualAssetCatalog,
): AvailableVisualOptions {
  const mappedStates = new Set<VisualStatePresetId>();
  const mappedEmotions = new Set<VisualEmotionPresetId>();

  for (const mapping of catalog.mappings) {
    if (mapping.state !== undefined) {
      mappedStates.add(mapping.state);
    }

    if (mapping.emotion !== undefined) {
      mappedEmotions.add(mapping.emotion);
    }
  }

  return {
    states: STATE_PRESETS.filter((preset) => mappedStates.has(preset.id)).map(
      (preset) => preset.id,
    ),
    emotions: EMOTION_PRESETS.filter((preset) =>
      mappedEmotions.has(preset.id),
    ).map((preset) => preset.id),
  };
}

export function resolveVisualAsset(
  catalog: VisualAssetCatalog,
  request: VisualAssetResolutionRequest,
): VisualAssetResolution | null {
  if (request.emotion !== null) {
    const exactMatch = resolveFromMapping(
      catalog,
      (mapping) =>
        mapping.state === request.state && mapping.emotion === request.emotion,
      "state-and-emotion",
    );

    if (exactMatch !== null) {
      return exactMatch;
    }
  }

  const stateOnlyMatch = resolveFromMapping(
    catalog,
    (mapping) =>
      mapping.state === request.state && mapping.emotion === undefined,
    "state",
  );

  if (stateOnlyMatch !== null) {
    return stateOnlyMatch;
  }

  if (request.emotion !== null) {
    const emotionOnlyMatch = resolveFromMapping(
      catalog,
      (mapping) =>
        mapping.state === undefined && mapping.emotion === request.emotion,
      "emotion",
    );

    if (emotionOnlyMatch !== null) {
      return emotionOnlyMatch;
    }
  }

  const defaultAsset = catalog.assets.find((asset) => asset.isDefault === true);

  if (defaultAsset === undefined) {
    return null;
  }

  return {
    asset: defaultAsset,
    mapping: null,
    match: "default",
  };
}

export function resolveVisualStateLine(
  catalog: VisualAssetCatalog,
  state: VisualStatePresetId,
): string | null {
  const mapping = catalog.stateLines.find(
    (candidate) => candidate.state === state,
  );

  if (mapping === undefined) {
    return null;
  }

  return mapping.line;
}
