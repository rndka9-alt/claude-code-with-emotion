import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import {
  collectAvailableVisualOptions,
  createEmptyVisualAssetCatalog,
  createEmptyVisualAssetCatalogStore,
  type AvailableVisualOptions,
  type VisualAssetCatalog,
  type VisualAssetCatalogStore,
  type VisualAssetMapping,
  type VisualAssetProviderId,
  type VisualAssetRecord,
  type VisualEmotionDescriptionMapping,
  type VisualStateLineMapping,
} from "../../shared/visual-assets";
import {
  isVisualEmotionPresetId,
  isVisualStatePresetId,
} from "../../shared/visual-presets";
import type { VisualAssetPickerFile } from "../../shared/visual-assets-bridge";

type CatalogListener = (catalog: VisualAssetCatalogStore) => void;

function getProviderCatalog(
  catalogStore: VisualAssetCatalogStore,
  providerId: VisualAssetProviderId = "claude",
): VisualAssetCatalog {
  return (
    catalogStore.providers[providerId] ??
    createEmptyVisualAssetCatalog(providerId !== "claude")
  );
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isVisualAssetRecord(value: unknown): value is VisualAssetRecord {
  if (!isObjectRecord(value)) {
    return false;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.kind !== "string" ||
    typeof value.label !== "string" ||
    typeof value.path !== "string"
  ) {
    return false;
  }

  if (value.kind !== "image") {
    return false;
  }

  if (
    Object.hasOwn(value, "isDefault") &&
    typeof value.isDefault !== "boolean"
  ) {
    return false;
  }

  return true;
}

function isVisualAssetMapping(value: unknown): value is VisualAssetMapping {
  if (!isObjectRecord(value) || typeof value.assetId !== "string") {
    return false;
  }

  const hasState = Object.hasOwn(value, "state");
  const hasEmotion = Object.hasOwn(value, "emotion");

  if (!hasState && !hasEmotion) {
    return false;
  }

  if (hasState && typeof value.state !== "string") {
    return false;
  }

  if (hasEmotion && typeof value.emotion !== "string") {
    return false;
  }

  return true;
}

function isVisualStateLineMapping(
  value: unknown,
): value is VisualStateLineMapping {
  if (!isObjectRecord(value)) {
    return false;
  }

  return typeof value.state === "string" && typeof value.line === "string";
}

function isVisualEmotionDescriptionMapping(
  value: unknown,
): value is VisualEmotionDescriptionMapping {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    typeof value.emotion === "string" && typeof value.description === "string"
  );
}

function isLegacyCodexProviderConfigRecord(value: unknown): boolean {
  if (!isObjectRecord(value)) {
    return false;
  }

  if (
    !Array.isArray(value.mappings) ||
    !Array.isArray(value.stateLines) ||
    !Array.isArray(value.emotionDescriptions)
  ) {
    return false;
  }

  if (
    Object.hasOwn(value, "defaultAssetId") &&
    typeof value.defaultAssetId !== "string"
  ) {
    return false;
  }

  if (
    Object.hasOwn(value, "useBaseProviderWhenMissing") &&
    typeof value.useBaseProviderWhenMissing !== "boolean"
  ) {
    return false;
  }

  return true;
}

function sanitizeMappings(
  mappings: ReadonlyArray<VisualAssetMapping>,
  knownAssetIds: ReadonlySet<string>,
): VisualAssetMapping[] {
  return mappings.filter((mapping) => {
    if (!knownAssetIds.has(mapping.assetId)) {
      return false;
    }

    const stateIsValid =
      mapping.state === undefined || isVisualStatePresetId(mapping.state);
    const emotionIsValid =
      mapping.emotion === undefined || isVisualEmotionPresetId(mapping.emotion);

    return stateIsValid && emotionIsValid;
  });
}

function sanitizeStateLines(
  stateLines: ReadonlyArray<VisualStateLineMapping>,
): VisualStateLineMapping[] {
  return stateLines
    .filter((mapping) => {
      return (
        isVisualStatePresetId(mapping.state) && mapping.line.trim().length > 0
      );
    })
    .map((mapping) => {
      return {
        state: mapping.state,
        line: mapping.line.trim(),
      };
    });
}

function sanitizeEmotionDescriptions(
  emotionDescriptions: ReadonlyArray<VisualEmotionDescriptionMapping>,
): VisualEmotionDescriptionMapping[] {
  return emotionDescriptions
    .filter((mapping) => {
      return (
        isVisualEmotionPresetId(mapping.emotion) &&
        mapping.description.trim().length > 0
      );
    })
    .map((mapping) => {
      return {
        emotion: mapping.emotion,
        description: mapping.description.trim(),
      };
    });
}

function sanitizeCatalog(candidate: VisualAssetCatalog): VisualAssetCatalog {
  const assets = candidate.assets.filter((asset) => {
    return (
      asset.id.length > 0 && asset.label.length > 0 && asset.path.length > 0
    );
  });
  const knownAssetIds = new Set(assets.map((asset) => asset.id));
  const mappings = sanitizeMappings(candidate.mappings, knownAssetIds);
  const stateLines = sanitizeStateLines(candidate.stateLines);
  const emotionDescriptions = sanitizeEmotionDescriptions(
    candidate.emotionDescriptions,
  );

  const sanitizedCatalog: VisualAssetCatalog = {
    version: 1,
    assets,
    emotionDescriptions,
    mappings,
    stateLines,
  };

  if (candidate.useBaseProviderWhenMissing !== undefined) {
    return {
      ...sanitizedCatalog,
      useBaseProviderWhenMissing: candidate.useBaseProviderWhenMissing,
    };
  }

  return sanitizedCatalog;
}

function sanitizeCatalogStore(
  candidate: VisualAssetCatalogStore,
): VisualAssetCatalogStore {
  return {
    version: 1,
    providers: {
      claude: {
        ...sanitizeCatalog(candidate.providers.claude),
        useBaseProviderWhenMissing: false,
      },
      codex: {
        ...sanitizeCatalog(candidate.providers.codex),
        useBaseProviderWhenMissing:
          candidate.providers.codex.useBaseProviderWhenMissing !== false,
      },
    },
  };
}

function collectReferencedAssets(
  assets: ReadonlyArray<VisualAssetRecord>,
  assetIds: ReadonlySet<string>,
): VisualAssetRecord[] {
  return assets.filter((asset) => {
    return assetIds.has(asset.id);
  });
}

function createCatalogFromLegacyOverride(
  assets: ReadonlyArray<VisualAssetRecord>,
  legacyOverride: Record<string, unknown>,
): VisualAssetCatalog {
  const mappings = Array.isArray(legacyOverride.mappings)
    ? legacyOverride.mappings.filter(isVisualAssetMapping)
    : [];
  const stateLines = Array.isArray(legacyOverride.stateLines)
    ? legacyOverride.stateLines.filter(isVisualStateLineMapping)
    : [];
  const emotionDescriptions = Array.isArray(legacyOverride.emotionDescriptions)
    ? legacyOverride.emotionDescriptions.filter(
        isVisualEmotionDescriptionMapping,
      )
    : [];
  const defaultAssetId =
    typeof legacyOverride.defaultAssetId === "string"
      ? legacyOverride.defaultAssetId
      : undefined;
  const referencedAssetIds = new Set(
    mappings.map((mapping) => {
      return mapping.assetId;
    }),
  );

  if (defaultAssetId !== undefined) {
    referencedAssetIds.add(defaultAssetId);
  }

  return {
    version: 1,
    assets: collectReferencedAssets(assets, referencedAssetIds).map((asset) => {
      return {
        ...asset,
        isDefault: asset.id === defaultAssetId,
      };
    }),
    emotionDescriptions,
    mappings,
    stateLines,
    useBaseProviderWhenMissing:
      legacyOverride.useBaseProviderWhenMissing !== false,
  };
}

function parseCatalogStoreFromDisk(
  filePath: string,
  logEvent?: (message: string) => void,
): VisualAssetCatalogStore {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    const parsed: unknown = JSON.parse(text);

    if (!isObjectRecord(parsed) || parsed.version !== 1) {
      logEvent?.("visual asset catalog on disk had an invalid shape");
      return createEmptyVisualAssetCatalogStore();
    }

    if (isObjectRecord(parsed.providers)) {
      const candidate: VisualAssetCatalogStore = {
        version: 1,
        providers: {
          claude: parseProviderCatalogFromRecord(parsed.providers.claude),
          codex: parseProviderCatalogFromRecord(parsed.providers.codex),
        },
      };

      return sanitizeCatalogStore(candidate);
    }

    if (!Array.isArray(parsed.assets) || !Array.isArray(parsed.mappings)) {
      logEvent?.("visual asset catalog on disk had an invalid shape");
      return createEmptyVisualAssetCatalogStore();
    }

    const candidate: VisualAssetCatalog = {
      version: 1,
      assets: parsed.assets.filter(isVisualAssetRecord),
      mappings: parsed.mappings.filter(isVisualAssetMapping),
      stateLines: Array.isArray(parsed.stateLines)
        ? parsed.stateLines.filter(isVisualStateLineMapping)
        : [],
      emotionDescriptions: Array.isArray(parsed.emotionDescriptions)
        ? parsed.emotionDescriptions.filter(isVisualEmotionDescriptionMapping)
        : [],
    };
    const legacyCodexOverride =
      isObjectRecord(parsed.providerOverrides) &&
      isLegacyCodexProviderConfigRecord(parsed.providerOverrides.codex) &&
      isObjectRecord(parsed.providerOverrides.codex)
        ? parsed.providerOverrides.codex
        : undefined;
    const legacyCatalogStore: VisualAssetCatalogStore = {
      version: 1,
      providers: {
        claude: sanitizeCatalog({
          ...candidate,
          useBaseProviderWhenMissing: false,
        }),
        codex:
          legacyCodexOverride !== undefined
            ? sanitizeCatalog(
                createCatalogFromLegacyOverride(
                  candidate.assets,
                  legacyCodexOverride,
                ),
              )
            : createEmptyVisualAssetCatalog(true),
      },
    };

    return sanitizeCatalogStore(legacyCatalogStore);
  } catch (error) {
    if (error instanceof Error && error.name !== "ENOENT") {
      logEvent?.(`failed to read visual asset catalog: ${error.message}`);
    }

    return createEmptyVisualAssetCatalogStore();
  }
}

function parseProviderCatalogFromRecord(value: unknown): VisualAssetCatalog {
  if (!isObjectRecord(value)) {
    return createEmptyVisualAssetCatalog();
  }

  const catalog: VisualAssetCatalog = {
    version: 1,
    assets: Array.isArray(value.assets)
      ? value.assets.filter(isVisualAssetRecord)
      : [],
    mappings: Array.isArray(value.mappings)
      ? value.mappings.filter(isVisualAssetMapping)
      : [],
    stateLines: Array.isArray(value.stateLines)
      ? value.stateLines.filter(isVisualStateLineMapping)
      : [],
    emotionDescriptions: Array.isArray(value.emotionDescriptions)
      ? value.emotionDescriptions.filter(isVisualEmotionDescriptionMapping)
      : [],
  };

  if (typeof value.useBaseProviderWhenMissing === "boolean") {
    return {
      ...catalog,
      useBaseProviderWhenMissing: value.useBaseProviderWhenMissing,
    };
  }

  return catalog;
}

function persistCatalogIfMissing(
  filePath: string,
  catalog: VisualAssetCatalogStore,
  logEvent?: (message: string) => void,
): void {
  if (fs.existsSync(filePath)) {
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(catalog, null, 2), "utf8");
  logEvent?.("initialized empty visual asset catalog on disk");
}

function createImportedAssetFilename(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
  const extension = path.extname(filePath).toLowerCase();

  return `${hash}${extension}`;
}

function isManagedAssetPath(
  assetPath: string,
  assetLibraryDirPath: string,
): boolean {
  const relativePath = path.relative(assetLibraryDirPath, assetPath);

  return (
    relativePath.length > 0 &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath)
  );
}

export class VisualAssetStore {
  private catalog: VisualAssetCatalogStore;
  private readonly listeners = new Set<CatalogListener>();

  constructor(
    private readonly filePath: string,
    private readonly assetLibraryDirPath: string,
    private readonly logEvent?: (message: string) => void,
  ) {
    this.catalog = parseCatalogStoreFromDisk(filePath, logEvent);
    persistCatalogIfMissing(filePath, this.catalog, logEvent);
  }

  getAvailableOptions(): AvailableVisualOptions {
    return collectAvailableVisualOptions(getProviderCatalog(this.catalog));
  }

  getCatalog(): VisualAssetCatalogStore {
    return this.catalog;
  }

  importFiles(filePaths: ReadonlyArray<string>): VisualAssetPickerFile[] {
    fs.mkdirSync(this.assetLibraryDirPath, { recursive: true });

    return filePaths.flatMap((filePath) => {
      if (!fs.existsSync(filePath)) {
        this.logEvent?.(`skipped missing asset import source path=${filePath}`);
        return [];
      }

      const importedFileName = createImportedAssetFilename(filePath);
      const importedFilePath = path.join(
        this.assetLibraryDirPath,
        importedFileName,
      );

      if (!fs.existsSync(importedFilePath)) {
        fs.copyFileSync(filePath, importedFilePath);
        this.logEvent?.(
          `imported asset source=${filePath} target=${importedFilePath}`,
        );
      } else {
        this.logEvent?.(
          `reused imported asset source=${filePath} target=${importedFilePath}`,
        );
      }

      return [
        {
          label: path.basename(filePath),
          path: importedFilePath,
        },
      ];
    });
  }

  replaceCatalog(nextCatalog: VisualAssetCatalogStore): VisualAssetCatalogStore {
    const previousCatalog = this.catalog;
    const sanitizedCatalog = sanitizeCatalogStore(nextCatalog);
    const claudeCatalog = getProviderCatalog(sanitizedCatalog);
    const codexCatalog = getProviderCatalog(sanitizedCatalog, "codex");
    const directoryPath = path.dirname(this.filePath);

    fs.mkdirSync(directoryPath, { recursive: true });
    fs.writeFileSync(
      this.filePath,
      JSON.stringify(sanitizedCatalog, null, 2),
      "utf8",
    );
    this.catalog = sanitizedCatalog;
    this.pruneUnusedImportedAssets(previousCatalog, sanitizedCatalog);
    this.emit();
    this.logEvent?.(
      `saved visual asset catalog claudeAssets=${claudeCatalog.assets.length} claudeMappings=${claudeCatalog.mappings.length} codexAssets=${codexCatalog.assets.length} codexMappings=${codexCatalog.mappings.length}`,
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

  private pruneUnusedImportedAssets(
    previousCatalog: VisualAssetCatalogStore,
    nextCatalog: VisualAssetCatalogStore,
  ): void {
    const nextPaths = new Set(
      Object.values(nextCatalog.providers).flatMap((catalog) => {
        return catalog.assets.map((asset) => asset.path);
      }),
    );

    for (const asset of Object.values(previousCatalog.providers).flatMap(
      (catalog) => {
        return catalog.assets;
      },
    )) {
      if (nextPaths.has(asset.path)) {
        continue;
      }

      if (!isManagedAssetPath(asset.path, this.assetLibraryDirPath)) {
        continue;
      }

      try {
        fs.unlinkSync(asset.path);
        this.logEvent?.(`removed unused imported asset path=${asset.path}`);
      } catch (error) {
        if (error instanceof Error && error.name !== "ENOENT") {
          this.logEvent?.(
            `failed to remove unused imported asset path=${asset.path} error=${error.message}`,
          );
        }
      }
    }
  }
}
