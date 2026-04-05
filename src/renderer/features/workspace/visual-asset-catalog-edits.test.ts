import {
  findVisualAssetEmotionOwner,
  findVisualAssetStateEmotionOwner,
  findVisualAssetStateOwner,
  mergePickedVisualAssets,
  removeVisualAsset,
  setVisualAssetDefault,
  setVisualAssetEmotionDescription,
  setVisualAssetEmotionMapping,
  setVisualAssetStateLine,
  setVisualAssetStateEmotionMapping,
  setVisualAssetStateMapping,
} from "./visual-asset-catalog-edits";

describe("visual asset catalog edits", () => {
  it("merges picked files without duplicating existing paths", () => {
    const catalog = mergePickedVisualAssets(
      {
        version: 1,
        assets: [
          {
            id: "asset-a",
            kind: "image",
            label: "A",
            path: "/tmp/a.png",
          },
        ],
        mappings: [],
        stateLines: [],
        emotionDescriptions: [],
      },
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

    expect(catalog.assets.map((asset) => asset.id)).toEqual([
      "asset-a",
      "asset-b",
    ]);
  });

  it("auto-maps imported assets from filename rules and updates conflicting slots", () => {
    const catalog = mergePickedVisualAssets(
      {
        version: 1,
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
        stateLines: [],
        emotionDescriptions: [],
      },
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

    expect(catalog.assets).toEqual([
      {
        id: "asset-default-old",
        isDefault: false,
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
      {
        id: "asset-working-new",
        kind: "image",
        label: "working.png",
        path: "/tmp/working.png",
      },
      {
        id: "asset-happy-new",
        kind: "image",
        label: "happy.png",
        path: "/tmp/happy.png",
      },
      {
        id: "asset-working-happy-new",
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
    expect(catalog.mappings).toEqual([
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

  it("fans out same-category filenames into multiple slots", () => {
    const catalog = mergePickedVisualAssets(
      {
        version: 1,
        assets: [],
        mappings: [],
        stateLines: [],
        emotionDescriptions: [],
      },
      [
        {
          label: "working__waiting.png",
          path: "/tmp/working__waiting.png",
        },
        {
          label: "happy__angry__sad.png",
          path: "/tmp/happy__angry__sad.png",
        },
      ],
      (() => {
        const ids = ["asset-states", "asset-emotions"];

        return () => {
          const nextId = ids.shift();

          if (nextId === undefined) {
            throw new Error("Expected another visual asset id");
          }

          return nextId;
        };
      })(),
    );

    expect(catalog.mappings).toEqual([
      { assetId: "asset-states", state: "working" },
      { assetId: "asset-states", state: "waiting" },
      { assetId: "asset-emotions", emotion: "happy" },
      { assetId: "asset-emotions", emotion: "angry" },
      { assetId: "asset-emotions", emotion: "sad" },
    ]);
  });

  it("keeps only the larger side on mixed N:M filenames and breaks ties toward emotions", () => {
    const catalog = mergePickedVisualAssets(
      {
        version: 1,
        assets: [],
        mappings: [],
        stateLines: [],
        emotionDescriptions: [],
      },
      // 파일마다 서로 겹치지 않는 슬롯을 쓰게 해서 나중 파일이 앞 매핑을 뺏지 않도록 구성.
      [
        // 상태 2 vs 감정 1 → 상태가 이겨서 happy 는 버려짐
        {
          label: "working__waiting__happy.png",
          path: "/tmp/states-win.png",
        },
        // 상태 1 vs 감정 2 → 감정이 이겨서 thinking 은 버려짐
        {
          label: "thinking__curious__serious.png",
          path: "/tmp/emotions-win.png",
        },
        // 동점(2:2) → 감정 우선이라 completed/error 는 버려짐
        {
          label: "completed__error__proud__surprised.png",
          path: "/tmp/tie.png",
        },
      ],
      (() => {
        const ids = ["asset-states-win", "asset-emotions-win", "asset-tie"];

        return () => {
          const nextId = ids.shift();

          if (nextId === undefined) {
            throw new Error("Expected another visual asset id");
          }

          return nextId;
        };
      })(),
    );

    expect(catalog.mappings).toEqual([
      { assetId: "asset-states-win", state: "working" },
      { assetId: "asset-states-win", state: "waiting" },
      { assetId: "asset-emotions-win", emotion: "curious" },
      { assetId: "asset-emotions-win", emotion: "serious" },
      { assetId: "asset-tie", emotion: "proud" },
      { assetId: "asset-tie", emotion: "surprised" },
    ]);
  });

  it("keeps only one default asset at a time", () => {
    const catalog = setVisualAssetDefault(
      {
        version: 1,
        assets: [
          {
            id: "asset-a",
            isDefault: true,
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
        mappings: [],
        stateLines: [],
        emotionDescriptions: [],
      },
      "asset-b",
      true,
    );

    expect(catalog.assets).toEqual([
      {
        id: "asset-a",
        isDefault: false,
        kind: "image",
        label: "A",
        path: "/tmp/a.png",
      },
      {
        id: "asset-b",
        isDefault: true,
        kind: "image",
        label: "B",
        path: "/tmp/b.png",
      },
    ]);
  });

  it("adds and removes state-only and emotion-only mappings independently", () => {
    const withState = setVisualAssetStateMapping(
      {
        version: 1,
        assets: [
          {
            id: "asset-a",
            kind: "image",
            label: "A",
            path: "/tmp/a.png",
          },
        ],
        mappings: [],
        stateLines: [],
        emotionDescriptions: [],
      },
      "asset-a",
      "working",
      true,
    );
    const withEmotion = setVisualAssetEmotionMapping(
      withState,
      "asset-a",
      "happy",
      true,
    );
    const withoutState = setVisualAssetStateMapping(
      withEmotion,
      "asset-a",
      "working",
      false,
    );

    expect(withEmotion.mappings).toEqual([
      {
        assetId: "asset-a",
        state: "working",
      },
      {
        assetId: "asset-a",
        emotion: "happy",
      },
    ]);
    expect(withoutState.mappings).toEqual([
      {
        assetId: "asset-a",
        emotion: "happy",
      },
    ]);
  });

  it("removes asset mappings together with the asset", () => {
    const catalog = removeVisualAsset(
      {
        version: 1,
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
        stateLines: [],
        emotionDescriptions: [],
      },
      "asset-a",
    );

    expect(catalog).toEqual({
      version: 1,
      assets: [],
      mappings: [],
      stateLines: [],
      emotionDescriptions: [],
    });
  });

  it("adds and removes exact state-and-emotion mappings independently", () => {
    const withPair = setVisualAssetStateEmotionMapping(
      {
        version: 1,
        assets: [
          {
            id: "asset-a",
            kind: "image",
            label: "A",
            path: "/tmp/a.png",
          },
        ],
        mappings: [],
        stateLines: [],
        emotionDescriptions: [],
      },
      "asset-a",
      "working",
      "sad",
      true,
    );
    const withoutPair = setVisualAssetStateEmotionMapping(
      withPair,
      "asset-a",
      "working",
      "sad",
      false,
    );

    expect(withPair.mappings).toEqual([
      {
        assetId: "asset-a",
        state: "working",
        emotion: "sad",
      },
    ]);
    expect(withoutPair.mappings).toEqual([]);
  });

  it("sets and clears state lines independently from asset mappings", () => {
    const withLine = setVisualAssetStateLine(
      {
        version: 1,
        assets: [],
        mappings: [],
        stateLines: [],
        emotionDescriptions: [],
      },
      "thinking",
      "읽는 중이에요...!",
    );
    const withoutLine = setVisualAssetStateLine(withLine, "thinking", "   ");

    expect(withLine.stateLines).toEqual([
      {
        state: "thinking",
        line: "읽는 중이에요...!",
      },
    ]);
    expect(withoutLine.stateLines).toEqual([]);
  });

  it("steals emotion/state/pair slots away from previous owners on enable", () => {
    const baseCatalog = {
      version: 1 as const,
      assets: [
        {
          id: "asset-a",
          kind: "image" as const,
          label: "A",
          path: "/tmp/a.png",
        },
        {
          id: "asset-b",
          kind: "image" as const,
          label: "B",
          path: "/tmp/b.png",
        },
      ],
      mappings: [
        { assetId: "asset-a", emotion: "happy" as const },
        { assetId: "asset-a", state: "working" as const },
        {
          assetId: "asset-a",
          state: "working" as const,
          emotion: "sad" as const,
        },
      ],
      stateLines: [],
      emotionDescriptions: [],
    };

    const stolenEmotion = setVisualAssetEmotionMapping(
      baseCatalog,
      "asset-b",
      "happy",
      true,
    );
    const stolenState = setVisualAssetStateMapping(
      baseCatalog,
      "asset-b",
      "working",
      true,
    );
    const stolenPair = setVisualAssetStateEmotionMapping(
      baseCatalog,
      "asset-b",
      "working",
      "sad",
      true,
    );

    expect(stolenEmotion.mappings).toEqual([
      { assetId: "asset-a", state: "working" },
      { assetId: "asset-a", state: "working", emotion: "sad" },
      { assetId: "asset-b", emotion: "happy" },
    ]);
    expect(stolenState.mappings).toEqual([
      { assetId: "asset-a", emotion: "happy" },
      { assetId: "asset-a", state: "working", emotion: "sad" },
      { assetId: "asset-b", state: "working" },
    ]);
    expect(stolenPair.mappings).toEqual([
      { assetId: "asset-a", emotion: "happy" },
      { assetId: "asset-a", state: "working" },
      { assetId: "asset-b", state: "working", emotion: "sad" },
    ]);
  });

  it("reports the current slot owner or null when the slot is free", () => {
    const catalog = {
      version: 1 as const,
      assets: [
        {
          id: "asset-a",
          kind: "image" as const,
          label: "A",
          path: "/tmp/a.png",
        },
        {
          id: "asset-orphan",
          kind: "image" as const,
          label: "Orphan",
          path: "/tmp/orphan.png",
        },
      ],
      mappings: [
        { assetId: "asset-a", emotion: "happy" as const },
        { assetId: "asset-a", state: "working" as const },
        {
          assetId: "asset-a",
          state: "working" as const,
          emotion: "sad" as const,
        },
        // 좀비 매핑: assetId 가 카탈로그에 읍는 경우는 owner 가 아니에요.
        { assetId: "asset-ghost", emotion: "angry" as const },
      ],
      stateLines: [],
      emotionDescriptions: [],
    };

    expect(findVisualAssetEmotionOwner(catalog, "happy")).toEqual("asset-a");
    expect(findVisualAssetEmotionOwner(catalog, "angry")).toEqual(null);
    expect(findVisualAssetEmotionOwner(catalog, "bored")).toEqual(null);
    expect(findVisualAssetStateOwner(catalog, "working")).toEqual("asset-a");
    expect(findVisualAssetStateOwner(catalog, "thinking")).toEqual(null);
    expect(
      findVisualAssetStateEmotionOwner(catalog, "working", "sad"),
    ).toEqual("asset-a");
    expect(
      findVisualAssetStateEmotionOwner(catalog, "working", "happy"),
    ).toEqual(null);
  });

  it("sets, replaces, and clears emotion description overrides", () => {
    const base = {
      version: 1 as const,
      assets: [],
      mappings: [],
      stateLines: [],
      emotionDescriptions: [],
    };
    const withDescription = setVisualAssetEmotionDescription(
      base,
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

    expect(withDescription.emotionDescriptions).toEqual([
      {
        emotion: "happy",
        description: "기분 좋음",
      },
    ]);
    expect(withReplacement.emotionDescriptions).toEqual([
      {
        emotion: "happy",
        description: "완전 신남",
      },
    ]);
    expect(withCleared.emotionDescriptions).toEqual([]);
  });
});
