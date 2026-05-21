import {
  getVisualAssetProviderCatalog,
  type VisualAssetCatalog,
  type VisualAssetCatalogStore,
} from "../../../../shared/visual-assets";
import {
  findVisualAssetEmotionOwner,
  findVisualAssetStateEmotionOwner,
  findVisualAssetStateOwner,
  mergePickedVisualAssets,
  removeVisualAsset,
  setVisualAssetDefault,
  setVisualAssetEmotionDescription,
  setVisualAssetEmotionMapping,
  setVisualAssetProviderFallback,
  setVisualAssetStateEmotionMapping,
  setVisualAssetStateLine,
  setVisualAssetStateMapping,
} from "./visual-asset-catalog-edits";

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

function getClaudeCatalog(
  catalogStore: VisualAssetCatalogStore,
): VisualAssetCatalog {
  return getVisualAssetProviderCatalog(catalogStore, "claude");
}

function getCodexCatalog(
  catalogStore: VisualAssetCatalogStore,
): VisualAssetCatalog {
  return getVisualAssetProviderCatalog(catalogStore, "codex");
}

describe("visual asset catalog edits", () => {
  it("merges picked files into the selected provider without duplicating existing paths", () => {
    const catalog = mergePickedVisualAssets(
      createCatalogStore({
        ...createEmptyCatalog(),
        assets: [
          {
            id: "asset-a",
            kind: "image",
            label: "A",
            path: "/tmp/a.png",
          },
        ],
      }),
      [
        {
          label: "A again",
          path: "/tmp/a.png",
        },
        {
          label: "B",
          path: "/tmp/b.png",
        },
      ],
      () => "asset-b",
    );

    expect(
      getClaudeCatalog(catalog).assets.map((asset) => {
        return asset.id;
      }),
    ).toEqual(["asset-a", "asset-b"]);
    expect(getCodexCatalog(catalog).assets).toEqual([]);
  });

  it("auto-maps imported assets from filename rules and updates conflicting slots", () => {
    const catalog = mergePickedVisualAssets(
      createCatalogStore({
        ...createEmptyCatalog(),
        assets: [
          {
            id: "asset-default-old",
            isDefault: true,
            kind: "image",
            label: "Default",
            path: "/tmp/default-old.png",
          },
          {
            id: "asset-working-old",
            kind: "image",
            label: "Working Old",
            path: "/tmp/working-old.png",
          },
        ],
        mappings: [
          {
            assetId: "asset-working-old",
            state: "working",
          },
        ],
      }),
      [
        {
          label: "working.png",
          path: "/tmp/working.png",
        },
        {
          label: "happy.png",
          path: "/tmp/happy.png",
        },
        {
          label: "working__happy.png",
          path: "/tmp/working__happy.png",
        },
        {
          label: "default__fallback.png",
          path: "/tmp/default__fallback.png",
        },
      ],
      (() => {
        const ids = [
          "asset-working-new",
          "asset-happy-new",
          "asset-working-happy-new",
          "asset-default-new",
        ];

        return () => {
          const nextId = ids.shift();

          if (nextId === undefined) {
            throw new Error("Expected another visual asset id");
          }

          return nextId;
        };
      })(),
    );
    const claudeCatalog = getClaudeCatalog(catalog);

    expect(claudeCatalog.assets).toEqual([
      {
        id: "asset-default-old",
        isDefault: false,
        kind: "image",
        label: "Default",
        path: "/tmp/default-old.png",
      },
      {
        id: "asset-working-old",
        isDefault: false,
        kind: "image",
        label: "Working Old",
        path: "/tmp/working-old.png",
      },
      {
        id: "asset-working-new",
        isDefault: false,
        kind: "image",
        label: "working.png",
        path: "/tmp/working.png",
      },
      {
        id: "asset-happy-new",
        isDefault: false,
        kind: "image",
        label: "happy.png",
        path: "/tmp/happy.png",
      },
      {
        id: "asset-working-happy-new",
        isDefault: false,
        kind: "image",
        label: "working__happy.png",
        path: "/tmp/working__happy.png",
      },
      {
        id: "asset-default-new",
        isDefault: true,
        kind: "image",
        label: "default__fallback.png",
        path: "/tmp/default__fallback.png",
      },
    ]);
    expect(claudeCatalog.mappings).toEqual([
      {
        assetId: "asset-working-new",
        state: "working",
      },
      {
        assetId: "asset-happy-new",
        emotion: "happy",
      },
      {
        assetId: "asset-working-happy-new",
        state: "working",
        emotion: "happy",
      },
    ]);
  });

  it("fans out same-category filenames and keeps only the larger side on mixed filenames", () => {
    const catalog = mergePickedVisualAssets(
      createCatalogStore(createEmptyCatalog()),
      [
        {
          label: "working__waiting.png",
          path: "/tmp/working__waiting.png",
        },
        {
          label: "happy__angry__sad.png",
          path: "/tmp/happy__angry__sad.png",
        },
        {
          label: "completed__error__proud__surprised.png",
          path: "/tmp/tie.png",
        },
      ],
      (() => {
        const ids = ["asset-states", "asset-emotions", "asset-tie"];

        return () => {
          const nextId = ids.shift();

          if (nextId === undefined) {
            throw new Error("Expected another visual asset id");
          }

          return nextId;
        };
      })(),
    );

    expect(getClaudeCatalog(catalog).mappings).toEqual([
      { assetId: "asset-states", state: "working" },
      { assetId: "asset-states", state: "waiting" },
      { assetId: "asset-emotions", emotion: "happy" },
      { assetId: "asset-emotions", emotion: "angry" },
      { assetId: "asset-emotions", emotion: "sad" },
      { assetId: "asset-tie", emotion: "proud" },
      { assetId: "asset-tie", emotion: "surprised" },
    ]);
  });

  it("keeps Codex defaults and mappings separate from Claude mappings", () => {
    const baseCatalog: VisualAssetCatalog = {
      ...createEmptyCatalog(),
      assets: [
        {
          id: "asset-claude",
          isDefault: true,
          kind: "image",
          label: "Claude",
          path: "/tmp/claude.png",
        },
      ],
      mappings: [
        {
          assetId: "asset-claude",
          state: "working",
        },
      ],
    };
    const codexCatalog: VisualAssetCatalog = {
      ...createEmptyCatalog(true),
      assets: [
        {
          id: "asset-codex",
          kind: "image",
          label: "Codex",
          path: "/tmp/codex.png",
        },
      ],
    };
    const withCodexDefault = setVisualAssetDefault(
      createCatalogStore(baseCatalog, codexCatalog),
      "asset-codex",
      true,
      "codex",
    );
    const withCodexMapping = setVisualAssetStateMapping(
      withCodexDefault,
      "asset-codex",
      "thinking",
      true,
      "codex",
    );

    expect(getClaudeCatalog(withCodexMapping).assets[0]?.isDefault).toBe(true);
    expect(getClaudeCatalog(withCodexMapping).mappings).toEqual([
      {
        assetId: "asset-claude",
        state: "working",
      },
    ]);
    expect(getCodexCatalog(withCodexMapping).assets).toEqual([
      {
        id: "asset-codex",
        isDefault: true,
        kind: "image",
        label: "Codex",
        path: "/tmp/codex.png",
      },
    ]);
    expect(getCodexCatalog(withCodexMapping).mappings).toEqual([
      {
        assetId: "asset-codex",
        state: "thinking",
      },
    ]);

    const withoutFallback = setVisualAssetProviderFallback(
      withCodexMapping,
      "codex",
      false,
    );

    expect(getCodexCatalog(withoutFallback).useBaseProviderWhenMissing).toBe(
      false,
    );
  });

  it("adds, removes, and steals mapping slots inside the selected provider", () => {
    const baseCatalog: VisualAssetCatalog = {
      ...createEmptyCatalog(),
      assets: [
        {
          id: "asset-a",
          kind: "image",
          label: "A",
          path: "/tmp/a.png",
        },
        {
          id: "asset-b",
          kind: "image",
          label: "B",
          path: "/tmp/b.png",
        },
      ],
      mappings: [
        { assetId: "asset-a", emotion: "happy" },
        { assetId: "asset-a", state: "working" },
        {
          assetId: "asset-a",
          state: "working",
          emotion: "sad",
        },
      ],
    };
    const catalog = createCatalogStore(baseCatalog);
    const stolenEmotion = setVisualAssetEmotionMapping(
      catalog,
      "asset-b",
      "happy",
      true,
    );
    const stolenState = setVisualAssetStateMapping(
      catalog,
      "asset-b",
      "working",
      true,
    );
    const stolenPair = setVisualAssetStateEmotionMapping(
      catalog,
      "asset-b",
      "working",
      "sad",
      true,
    );

    expect(getClaudeCatalog(stolenEmotion).mappings).toEqual([
      { assetId: "asset-a", state: "working" },
      { assetId: "asset-a", state: "working", emotion: "sad" },
      { assetId: "asset-b", emotion: "happy" },
    ]);
    expect(getClaudeCatalog(stolenState).mappings).toEqual([
      { assetId: "asset-a", emotion: "happy" },
      { assetId: "asset-a", state: "working", emotion: "sad" },
      { assetId: "asset-b", state: "working" },
    ]);
    expect(getClaudeCatalog(stolenPair).mappings).toEqual([
      { assetId: "asset-a", emotion: "happy" },
      { assetId: "asset-a", state: "working" },
      { assetId: "asset-b", state: "working", emotion: "sad" },
    ]);

    const withoutPair = setVisualAssetStateEmotionMapping(
      stolenPair,
      "asset-b",
      "working",
      "sad",
      false,
    );

    expect(getClaudeCatalog(withoutPair).mappings).toEqual([
      { assetId: "asset-a", emotion: "happy" },
      { assetId: "asset-a", state: "working" },
    ]);
  });

  it("removes asset mappings together with the asset", () => {
    const catalog = removeVisualAsset(
      createCatalogStore({
        ...createEmptyCatalog(),
        assets: [
          {
            id: "asset-a",
            kind: "image",
            label: "A",
            path: "/tmp/a.png",
          },
        ],
        mappings: [
          {
            assetId: "asset-a",
            state: "working",
          },
        ],
      }),
      "asset-a",
    );

    expect(getClaudeCatalog(catalog)).toEqual(createEmptyCatalog());
  });

  it("sets and clears state lines independently from asset mappings", () => {
    const withLine = setVisualAssetStateLine(
      createCatalogStore(createEmptyCatalog()),
      "thinking",
      "읽는 중이에요...!",
    );
    const withoutLine = setVisualAssetStateLine(withLine, "thinking", "   ");

    expect(getClaudeCatalog(withLine).stateLines).toEqual([
      {
        state: "thinking",
        line: "읽는 중이에요...!",
      },
    ]);
    expect(getClaudeCatalog(withoutLine).stateLines).toEqual([]);
  });

  it("reports the current slot owner or null when the slot is free", () => {
    const catalog = createCatalogStore({
      ...createEmptyCatalog(),
      assets: [
        {
          id: "asset-a",
          kind: "image",
          label: "A",
          path: "/tmp/a.png",
        },
        {
          id: "asset-orphan",
          kind: "image",
          label: "Orphan",
          path: "/tmp/orphan.png",
        },
      ],
      mappings: [
        { assetId: "asset-a", emotion: "happy" },
        { assetId: "asset-a", state: "working" },
        {
          assetId: "asset-a",
          state: "working",
          emotion: "sad",
        },
        // 좀비 매핑: assetId 가 카탈로그에 읍는 경우는 owner 가 아니에요.
        { assetId: "asset-ghost", emotion: "angry" },
      ],
    });

    expect(findVisualAssetEmotionOwner(catalog, "happy")).toEqual("asset-a");
    expect(findVisualAssetEmotionOwner(catalog, "angry")).toEqual(null);
    expect(findVisualAssetEmotionOwner(catalog, "bored")).toEqual(null);
    expect(findVisualAssetStateOwner(catalog, "working")).toEqual("asset-a");
    expect(findVisualAssetStateOwner(catalog, "thinking")).toEqual(null);
    expect(findVisualAssetStateEmotionOwner(catalog, "working", "sad")).toEqual(
      "asset-a",
    );
    expect(
      findVisualAssetStateEmotionOwner(catalog, "working", "happy"),
    ).toEqual(null);
  });

  it("sets, replaces, and clears emotion description overrides", () => {
    const withDescription = setVisualAssetEmotionDescription(
      createCatalogStore(createEmptyCatalog()),
      "happy",
      "  기분 좋음  ",
    );
    const withReplacement = setVisualAssetEmotionDescription(
      withDescription,
      "happy",
      "완전 신남",
    );
    const withCleared = setVisualAssetEmotionDescription(
      withReplacement,
      "happy",
      "   ",
    );

    expect(getClaudeCatalog(withDescription).emotionDescriptions).toEqual([
      {
        emotion: "happy",
        description: "기분 좋음",
      },
    ]);
    expect(getClaudeCatalog(withReplacement).emotionDescriptions).toEqual([
      {
        emotion: "happy",
        description: "완전 신남",
      },
    ]);
    expect(getClaudeCatalog(withCleared).emotionDescriptions).toEqual([]);
  });
});
