import {
  mergePickedVisualAssets,
  removeVisualAsset,
  setVisualAssetDefault,
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

  it("ignores ambiguous filename matches", () => {
    const catalog = mergePickedVisualAssets(
      {
        version: 1,
        assets: [],
        mappings: [],
        stateLines: [],
      },
      [
        {
          label: "working__idle.png",
          path: "/tmp/working__idle.png",
        },
        {
          label: "happy__sad.png",
          path: "/tmp/happy__sad.png",
        },
      ],
      (() => {
        const ids = ["asset-a", "asset-b"];

        return () => {
          const nextId = ids.shift();

          if (nextId === undefined) {
            throw new Error("Expected another visual asset id");
          }

          return nextId;
        };
      })(),
    );

    expect(catalog.mappings).toEqual([]);
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
      },
      "asset-a",
    );

    expect(catalog).toEqual({
      version: 1,
      assets: [],
      mappings: [],
      stateLines: [],
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
});
