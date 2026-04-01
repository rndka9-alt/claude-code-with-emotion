import {
  type VisualAssetCatalog,
  type VisualAssetMapping,
  type VisualAssetRecord,
} from '../../../shared/visual-assets';
import {
  type VisualEmotionPresetId,
  type VisualStatePresetId,
} from '../../../shared/visual-presets';
import type { VisualAssetPickerFile } from '../../../shared/visual-assets-bridge';

function createVisualAssetId(): string {
  return `visual-asset-${crypto.randomUUID()}`;
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

export function mergePickedVisualAssets(
  catalog: VisualAssetCatalog,
  files: ReadonlyArray<VisualAssetPickerFile>,
  createId: () => string = createVisualAssetId,
): VisualAssetCatalog {
  const knownPaths = new Set(catalog.assets.map((asset) => asset.path));
  const nextAssets: VisualAssetRecord[] = [...catalog.assets];

  for (const file of files) {
    if (knownPaths.has(file.path)) {
      continue;
    }

    nextAssets.push({
      id: createId(),
      kind: 'image',
      label: file.label,
      path: file.path,
    });
    knownPaths.add(file.path);
  }

  return {
    ...catalog,
    assets: nextAssets,
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
