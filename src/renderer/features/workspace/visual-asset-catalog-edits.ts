import {
  type VisualAssetCatalog,
  type VisualAssetMapping,
  type VisualAssetRecord,
} from "../../../shared/visual-assets";
import {
  EMOTION_PRESETS,
  STATE_PRESETS,
  type VisualEmotionPresetId,
  type VisualStatePresetId,
} from "../../../shared/visual-presets";
import type { VisualAssetPickerFile } from "../../../shared/visual-assets-bridge";

interface AutoVisualAssetAssignment {
  emotion?: VisualEmotionPresetId;
  isDefault: boolean;
  state?: VisualStatePresetId;
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

  if (states.size > 1 || emotions.size > 1) {
    return isDefault ? { isDefault } : null;
  }

  const [state] = states;
  const [emotion] = emotions;

  if (!isDefault && state === undefined && emotion === undefined) {
    return null;
  }

  const assignment: AutoVisualAssetAssignment = {
    isDefault,
  };

  if (state !== undefined) {
    assignment.state = state;
  }

  if (emotion !== undefined) {
    assignment.emotion = emotion;
  }

  return assignment;
}

function hasStateOnlyMapping(
  mapping: VisualAssetMapping,
  assetId: string,
  state: VisualStatePresetId,
): boolean {
  return (
    mapping.assetId === assetId &&
    mapping.state === state &&
    mapping.emotion === undefined
  );
}

function hasEmotionOnlyMapping(
  mapping: VisualAssetMapping,
  assetId: string,
  emotion: VisualEmotionPresetId,
): boolean {
  return (
    mapping.assetId === assetId &&
    mapping.state === undefined &&
    mapping.emotion === emotion
  );
}

function hasStateAndEmotionMapping(
  mapping: VisualAssetMapping,
  assetId: string,
  state: VisualStatePresetId,
  emotion: VisualEmotionPresetId,
): boolean {
  return (
    mapping.assetId === assetId &&
    mapping.state === state &&
    mapping.emotion === emotion
  );
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
      filenameAssignment?.state !== undefined &&
      filenameAssignment.emotion !== undefined
    ) {
      nextMappings = removeMatchingStateEmotionMappings(
        nextMappings,
        filenameAssignment.state,
        filenameAssignment.emotion,
      );
      nextMappings.push({
        assetId: nextAssetId,
        emotion: filenameAssignment.emotion,
        state: filenameAssignment.state,
      });
    } else if (filenameAssignment?.state !== undefined) {
      nextMappings = removeMatchingStateOnlyMappings(
        nextMappings,
        filenameAssignment.state,
      );
      nextMappings.push({
        assetId: nextAssetId,
        state: filenameAssignment.state,
      });
    } else if (filenameAssignment?.emotion !== undefined) {
      nextMappings = removeMatchingEmotionOnlyMappings(
        nextMappings,
        filenameAssignment.emotion,
      );
      nextMappings.push({
        assetId: nextAssetId,
        emotion: filenameAssignment.emotion,
      });
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

export function setVisualAssetStateMapping(
  catalog: VisualAssetCatalog,
  assetId: string,
  state: VisualStatePresetId,
  isEnabled: boolean,
): VisualAssetCatalog {
  const nextMappings = catalog.mappings.filter((mapping) => {
    return !hasStateOnlyMapping(mapping, assetId, state);
  });

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
  const nextMappings = catalog.mappings.filter((mapping) => {
    return !hasEmotionOnlyMapping(mapping, assetId, emotion);
  });

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
  const nextMappings = catalog.mappings.filter((mapping) => {
    return !hasStateAndEmotionMapping(mapping, assetId, state, emotion);
  });

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
