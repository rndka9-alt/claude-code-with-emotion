import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  getVisualAssetProviderCatalog,
  type VisualAssetCatalog,
  type VisualAssetCatalogStore,
} from "../../shared/visual-assets";
import { VisualAssetStore } from "./visual-asset-store";

function createEmptyCatalog(
  useBaseProviderWhenMissing?: boolean,
): VisualAssetCatalog {
  const catalog: VisualAssetCatalog = {
    version: 1,
    assets: [],
    mappings: [],
    stateLines: [],
    emotionDescriptions: [],
  };

  if (useBaseProviderWhenMissing !== undefined) {
    return {
      ...catalog,
      useBaseProviderWhenMissing,
    };
  }

  return catalog;
}

function createCatalogStore(
  claudeCatalog: VisualAssetCatalog,
  codexCatalog: VisualAssetCatalog = createEmptyCatalog(true),
): VisualAssetCatalogStore {
  return {
    version: 1,
    providers: {
      claude: claudeCatalog,
      codex: codexCatalog,
    },
  };
}

describe("VisualAssetStore", () => {
  it("starts empty and writes an empty catalog file when none exists yet", () => {
    const directoryPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "visual-asset-store-empty-"),
    );
    const filePath = path.join(directoryPath, "visual-assets.json");
    const store = new VisualAssetStore(
      filePath,
      path.join(directoryPath, "asset-library"),
    );

    expect(store.getCatalog()).toEqual(
      createCatalogStore(createEmptyCatalog(false)),
    );
    expect(JSON.parse(fs.readFileSync(filePath, "utf8"))).toEqual(
      createCatalogStore(createEmptyCatalog(false)),
    );
  });

  it("sanitizes and persists the catalog to disk", () => {
    const directoryPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "visual-asset-store-write-"),
    );
    const filePath = path.join(directoryPath, "visual-assets.json");
    const store = new VisualAssetStore(
      filePath,
      path.join(directoryPath, "asset-library"),
    );

    const savedCatalog = store.replaceCatalog(
      createCatalogStore({
        ...createEmptyCatalog(),
        assets: [
          {
            id: "asset-working",
            kind: "image",
            label: "Working",
            path: "/tmp/working.png",
          },
        ],
        mappings: [
          {
            assetId: "asset-working",
            state: "working",
          },
          {
            assetId: "missing-asset",
            emotion: "happy",
          },
        ],
        stateLines: [
          {
            state: "thinking",
            line: "   문서 뒤지는 중   ",
          },
        ],
      }),
    );
    const savedClaudeCatalog = getVisualAssetProviderCatalog(savedCatalog);

    expect(savedClaudeCatalog.mappings).toEqual([
      {
        assetId: "asset-working",
        state: "working",
      },
    ]);
    expect(savedClaudeCatalog.stateLines).toEqual([
      {
        state: "thinking",
        line: "문서 뒤지는 중",
      },
    ]);
    expect(JSON.parse(fs.readFileSync(filePath, "utf8"))).toEqual(savedCatalog);
    expect(store.getAvailableOptions()).toEqual({
      states: ["working"],
      emotions: [],
      emotionDescriptions: {},
    });
  });

  it("emits snapshots to subscribers after saving", () => {
    const directoryPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "visual-asset-store-subscribe-"),
    );
    const filePath = path.join(directoryPath, "visual-assets.json");
    const store = new VisualAssetStore(
      filePath,
      path.join(directoryPath, "asset-library"),
    );
    const snapshots: string[] = [];
    const unsubscribe = store.subscribe((catalog) => {
      const claudeCatalog = getVisualAssetProviderCatalog(catalog);

      snapshots.push(
        `${claudeCatalog.assets.length}:${claudeCatalog.mappings.length}`,
      );
    });

    store.replaceCatalog(
      createCatalogStore({
        ...createEmptyCatalog(),
        assets: [
          {
            id: "asset-default",
            isDefault: true,
            kind: "image",
            label: "Default",
            path: "/tmp/default.png",
          },
        ],
      }),
    );

    unsubscribe();

    expect(snapshots).toEqual(["1:0"]);
  });

  it("copies imported files into the managed asset library and reuses duplicates", () => {
    const directoryPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "visual-asset-store-import-"),
    );
    const filePath = path.join(directoryPath, "visual-assets.json");
    const assetLibraryDirPath = path.join(directoryPath, "asset-library");
    const store = new VisualAssetStore(filePath, assetLibraryDirPath);
    const sourceFilePath = path.join(directoryPath, "source.png");

    fs.writeFileSync(sourceFilePath, "same-image", "utf8");

    const firstImport = store.importFiles([sourceFilePath]);
    const secondImport = store.importFiles([sourceFilePath]);

    expect(firstImport).toHaveLength(1);
    expect(secondImport).toEqual(firstImport);
    expect(firstImport[0]?.path.startsWith(assetLibraryDirPath)).toBe(true);
    expect(fs.existsSync(firstImport[0]?.path ?? "")).toBe(true);
  });

  it("removes unused imported files when assets disappear from the catalog", () => {
    const directoryPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "visual-asset-store-prune-"),
    );
    const filePath = path.join(directoryPath, "visual-assets.json");
    const assetLibraryDirPath = path.join(directoryPath, "asset-library");
    const sourceFilePath = path.join(directoryPath, "source.png");
    const store = new VisualAssetStore(filePath, assetLibraryDirPath);

    fs.writeFileSync(sourceFilePath, "prune-image", "utf8");

    const importedAsset = store.importFiles([sourceFilePath])[0];

    if (importedAsset === undefined) {
      throw new Error("Expected imported asset to exist");
    }

    store.replaceCatalog(
      createCatalogStore({
        ...createEmptyCatalog(),
        assets: [
          {
            id: "asset-a",
            kind: "image",
            label: "Imported",
            path: importedAsset.path,
          },
        ],
      }),
    );

    expect(fs.existsSync(importedAsset.path)).toBe(true);

    store.replaceCatalog(createCatalogStore(createEmptyCatalog()));

    expect(fs.existsSync(importedAsset.path)).toBe(false);
  });
});
