import {
  collectAvailableVisualOptions,
  resolveVisualAsset,
  resolveVisualStateLine,
  type VisualAssetCatalog,
} from "./visual-assets";

function createCatalog(): VisualAssetCatalog {
  return {
    version: 1,
    assets: [
      {
        id: "asset-default",
        isDefault: true,
        kind: "image",
        label: "Default",
        path: "/tmp/default.png",
      },
      {
        id: "asset-working",
        kind: "image",
        label: "Working",
        path: "/tmp/working.png",
      },
      {
        id: "asset-happy",
        kind: "image",
        label: "Happy",
        path: "/tmp/happy.png",
      },
      {
        id: "asset-working-happy",
        kind: "image",
        label: "Working Happy",
        path: "/tmp/working-happy.png",
      },
    ],
    stateLines: [
      {
        state: "working",
        line: "작업 몰빵 중...!",
      },
    ],
    mappings: [
      {
        assetId: "asset-working",
        state: "working",
      },
      {
        assetId: "asset-happy",
        emotion: "happy",
      },
      {
        assetId: "asset-working-happy",
        state: "working",
        emotion: "happy",
      },
    ],
  };
}

describe("visual asset resolver", () => {
  it("prefers an exact state and emotion match over looser fallbacks", () => {
    const resolution = resolveVisualAsset(createCatalog(), {
      state: "working",
      emotion: "happy",
    });

    expect(resolution?.asset.id).toBe("asset-working-happy");
    expect(resolution?.match).toBe("state-and-emotion");
  });

  it("falls back to a state-only mapping when no exact pair exists", () => {
    const resolution = resolveVisualAsset(createCatalog(), {
      state: "working",
      emotion: "sad",
    });

    expect(resolution?.asset.id).toBe("asset-working");
    expect(resolution?.match).toBe("state");
  });

  it("uses an emotion-only mapping when no state+emotion combo exists", () => {
    const resolution = resolveVisualAsset(createCatalog(), {
      state: "idle",
      emotion: "happy",
    });

    expect(resolution?.asset.id).toBe("asset-happy");
    expect(resolution?.match).toBe("emotion");
  });

  it("prefers an emotion-only mapping over a state-only mapping when emotion is set", () => {
    // state 와 emotion 이 각각 따로 매핑댓고 조합 매핑이 없을 때, 명시적으로
    // 설정된 emotion 자산이 state 자산에 가려지지 않아야 한다. state 가 이기면
    // MCP 툴로 emotion 을 바꿔도 화면에 안 보여서 툴이 장식품이 댄다.
    const catalog: VisualAssetCatalog = {
      version: 1,
      assets: [
        {
          id: "asset-working",
          kind: "image",
          label: "Working",
          path: "/tmp/working.png",
        },
        {
          id: "asset-sad",
          kind: "image",
          label: "Sad",
          path: "/tmp/sad.png",
        },
      ],
      mappings: [
        { assetId: "asset-working", state: "working" },
        { assetId: "asset-sad", emotion: "sad" },
      ],
      stateLines: [],
    };

    const resolution = resolveVisualAsset(catalog, {
      state: "working",
      emotion: "sad",
    });

    expect(resolution?.asset.id).toBe("asset-sad");
    expect(resolution?.match).toBe("emotion");
  });

  it("returns the default asset when no specific mapping is available", () => {
    const resolution = resolveVisualAsset(createCatalog(), {
      state: "waiting",
      emotion: "sad",
    });

    expect(resolution?.asset.id).toBe("asset-default");
    expect(resolution?.match).toBe("default");
  });

  it("reports only mapped preset options for future MCP exposure", () => {
    const availableOptions = collectAvailableVisualOptions(createCatalog());

    expect(availableOptions.states).toEqual(["working"]);
    expect(availableOptions.emotions).toEqual(["happy"]);
  });

  it("resolves a custom state line when one exists", () => {
    expect(resolveVisualStateLine(createCatalog(), "working")).toBe(
      "작업 몰빵 중...!",
    );
  });
});
