import fs from 'node:fs';
import path from 'node:path';
import {
  collectAvailableVisualOptions,
  createEmptyVisualAssetCatalog,
  type AvailableVisualOptions,
  type VisualAssetCatalog,
  type VisualAssetMapping,
  type VisualAssetRecord,
} from '../../shared/visual-assets';
import {
  isVisualEmotionPresetId,
  isVisualStatePresetId,
} from '../../shared/visual-presets';

type CatalogListener = (catalog: VisualAssetCatalog) => void;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isVisualAssetRecord(value: unknown): value is VisualAssetRecord {
  if (!isObjectRecord(value)) {
    return false;
  }

  if (
    typeof value.id !== 'string' ||
    typeof value.kind !== 'string' ||
    typeof value.label !== 'string' ||
    typeof value.path !== 'string'
  ) {
    return false;
  }

  if (value.kind !== 'image') {
    return false;
  }

  if (
    Object.hasOwn(value, 'isDefault') &&
    typeof value.isDefault !== 'boolean'
  ) {
    return false;
  }

  return true;
}

function isVisualAssetMapping(value: unknown): value is VisualAssetMapping {
  if (!isObjectRecord(value) || typeof value.assetId !== 'string') {
    return false;
  }

  const hasState = Object.hasOwn(value, 'state');
  const hasEmotion = Object.hasOwn(value, 'emotion');

  if (!hasState && !hasEmotion) {
    return false;
  }

  if (hasState && typeof value.state !== 'string') {
    return false;
  }

  if (hasEmotion && typeof value.emotion !== 'string') {
    return false;
  }

  return true;
}

function sanitizeCatalog(candidate: VisualAssetCatalog): VisualAssetCatalog {
  const assets = candidate.assets.filter((asset) => {
    return (
      asset.id.length > 0 &&
      asset.label.length > 0 &&
      asset.path.length > 0
    );
  });
  const knownAssetIds = new Set(assets.map((asset) => asset.id));
  const mappings = candidate.mappings.filter((mapping) => {
    if (!knownAssetIds.has(mapping.assetId)) {
      return false;
    }

    const stateIsValid =
      mapping.state === undefined || isVisualStatePresetId(mapping.state);
    const emotionIsValid =
      mapping.emotion === undefined ||
      isVisualEmotionPresetId(mapping.emotion);

    return stateIsValid && emotionIsValid;
  });

  return {
    version: 1,
    assets,
    mappings,
  };
}

function parseCatalogFromDisk(
  filePath: string,
  logEvent?: (message: string) => void,
): VisualAssetCatalog {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const parsed: unknown = JSON.parse(text);

    if (
      !isObjectRecord(parsed) ||
      parsed.version !== 1 ||
      !Array.isArray(parsed.assets) ||
      !Array.isArray(parsed.mappings)
    ) {
      logEvent?.('visual asset catalog on disk had an invalid shape');
      return createEmptyVisualAssetCatalog();
    }

    const candidate: VisualAssetCatalog = {
      version: 1,
      assets: parsed.assets.filter(isVisualAssetRecord),
      mappings: parsed.mappings.filter(isVisualAssetMapping),
    };

    return sanitizeCatalog(candidate);
  } catch (error) {
    if (error instanceof Error && error.name !== 'ENOENT') {
      logEvent?.(`failed to read visual asset catalog: ${error.message}`);
    }

    return createEmptyVisualAssetCatalog();
  }
}

export class VisualAssetStore {
  private catalog: VisualAssetCatalog;
  private readonly listeners = new Set<CatalogListener>();

  constructor(
    private readonly filePath: string,
    private readonly logEvent?: (message: string) => void,
  ) {
    this.catalog = parseCatalogFromDisk(filePath, logEvent);
  }

  getAvailableOptions(): AvailableVisualOptions {
    return collectAvailableVisualOptions(this.catalog);
  }

  getCatalog(): VisualAssetCatalog {
    return this.catalog;
  }

  replaceCatalog(nextCatalog: VisualAssetCatalog): VisualAssetCatalog {
    const sanitizedCatalog = sanitizeCatalog(nextCatalog);
    const directoryPath = path.dirname(this.filePath);

    fs.mkdirSync(directoryPath, { recursive: true });
    fs.writeFileSync(
      this.filePath,
      JSON.stringify(sanitizedCatalog, null, 2),
      'utf8',
    );
    this.catalog = sanitizedCatalog;
    this.emit();
    this.logEvent?.(
      `saved visual asset catalog assets=${sanitizedCatalog.assets.length} mappings=${sanitizedCatalog.mappings.length}`,
    );

    return sanitizedCatalog;
  }

  subscribe(listener: CatalogListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.listeners.clear();
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.catalog);
    }
  }
}
