import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import {
  collectAvailableVisualOptions,
  createEmptyVisualAssetCatalog,
  type AvailableVisualOptions,
  type VisualAssetCatalog,
  type VisualAssetMapping,
  type VisualAssetRecord,
  type VisualEmotionDescriptionMapping,
  type VisualStateLineMapping,
} from "../../shared/visual-assets";
import {
  isVisualEmotionPresetId,
  isVisualStatePresetId,
} from "../../shared/visual-presets";
import type { VisualAssetPickerFile } from "../../shared/visual-assets-bridge";

type CatalogListener = (catalog: VisualAssetCatalog) => void;

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

function sanitizeCatalog(candidate: VisualAssetCatalog): VisualAssetCatalog {
  const assets = candidate.assets.filter((asset) => {
    return (
      asset.id.length > 0 && asset.label.length > 0 && asset.path.length > 0
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
      mapping.emotion === undefined || isVisualEmotionPresetId(mapping.emotion);

    return stateIsValid && emotionIsValid;
  });
  const stateLines = candidate.stateLines
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
  const emotionDescriptions = candidate.emotionDescriptions
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

  return {
    version: 1,
    assets,
    emotionDescriptions,
    mappings,
    stateLines,
  };
}

function parseCatalogFromDisk(
  filePath: string,
  logEvent?: (message: string) => void,
): VisualAssetCatalog {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    const parsed: unknown = JSON.parse(text);

    if (
      !isObjectRecord(parsed) ||
      parsed.version !== 1 ||
      !Array.isArray(parsed.assets) ||
      !Array.isArray(parsed.mappings)
    ) {
      logEvent?.("visual asset catalog on disk had an invalid shape");
      return createEmptyVisualAssetCatalog();
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

    return sanitizeCatalog(candidate);
  } catch (error) {
    if (error instanceof Error && error.name !== "ENOENT") {
      logEvent?.(`failed to read visual asset catalog: ${error.message}`);
    }

    return createEmptyVisualAssetCatalog();
  }
}

function persistCatalogIfMissing(
  filePath: string,
  catalog: VisualAssetCatalog,
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
  private catalog: VisualAssetCatalog;
  private readonly listeners = new Set<CatalogListener>();

  constructor(
    private readonly filePath: string,
    private readonly assetLibraryDirPath: string,
    private readonly logEvent?: (message: string) => void,
  ) {
    this.catalog = parseCatalogFromDisk(filePath, logEvent);
    persistCatalogIfMissing(filePath, this.catalog, logEvent);
  }

  getAvailableOptions(): AvailableVisualOptions {
    return collectAvailableVisualOptions(this.catalog);
  }

  getCatalog(): VisualAssetCatalog {
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

  replaceCatalog(nextCatalog: VisualAssetCatalog): VisualAssetCatalog {
    const previousCatalog = this.catalog;
    const sanitizedCatalog = sanitizeCatalog(nextCatalog);
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
      `saved visual asset catalog assets=${sanitizedCatalog.assets.length} mappings=${sanitizedCatalog.mappings.length} stateLines=${sanitizedCatalog.stateLines.length} emotionDescriptions=${sanitizedCatalog.emotionDescriptions.length}`,
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
    previousCatalog: VisualAssetCatalog,
    nextCatalog: VisualAssetCatalog,
  ): void {
    const nextPaths = new Set(nextCatalog.assets.map((asset) => asset.path));

    for (const asset of previousCatalog.assets) {
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
