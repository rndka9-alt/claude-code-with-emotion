import type { AssistantStatusSnapshot } from "../../../../shared/assistant-status";
import { resolveStatusPanelVisual } from "./status-panel-visual";

const baseSnapshot: AssistantStatusSnapshot = {
  activityLabel: "컴퓨터 작업중",
  emotion: null,
  overlayLine: null,
  state: "working",
  line: "작업 중...",
  currentTask: "Testing",
  updatedAtMs: 1,
  intensity: "medium",
  source: "test",
};

describe("resolveStatusPanelVisual", () => {
  it("uses exact state matches for asset selection", () => {
    const visual = resolveStatusPanelVisual(baseSnapshot, {
      version: 1,
      assets: [
        {
          id: "asset-working",
          kind: "image",
          label: "Working Fox",
          path: "/tmp/working fox.png",
        },
      ],
      mappings: [
        {
          assetId: "asset-working",
          state: "working",
        },
      ],
      stateLines: [],
      emotionDescriptions: [],
    });

    expect(visual).toEqual({
      assetUrl: "file:///tmp/working%20fox.png",
      resolution: {
        asset: {
          id: "asset-working",
          kind: "image",
          label: "Working Fox",
          path: "/tmp/working fox.png",
        },
        mapping: {
          assetId: "asset-working",
          state: "working",
        },
        match: "state",
      },
    });
  });

  it("falls back to an emotion-only asset when no state+emotion mapping exists", () => {
    const visual = resolveStatusPanelVisual(
      {
        ...baseSnapshot,
        emotion: "happy",
        state: "completed",
      },
      {
        version: 1,
        assets: [
          {
            id: "asset-happy",
            kind: "image",
            label: "Happy Fox",
            path: "/tmp/happy.png",
          },
        ],
        mappings: [
          {
            assetId: "asset-happy",
            emotion: "happy",
          },
        ],
        stateLines: [],
        emotionDescriptions: [],
      },
    );

    expect(visual?.resolution.match).toBe("emotion");
    expect(visual?.resolution.asset.label).toBe("Happy Fox");
  });

  it("returns null when the catalog has no usable asset", () => {
    const visual = resolveStatusPanelVisual(baseSnapshot);

    expect(visual).toBeNull();
  });

  it("uses a Codex provider default before falling back to Claude mappings", () => {
    const visual = resolveStatusPanelVisual(
      {
        ...baseSnapshot,
        assistantProviderId: "codex",
      },
      {
        version: 1,
        assets: [
          {
            id: "asset-claude-working",
            kind: "image",
            label: "Claude Working",
            path: "/tmp/claude-working.png",
          },
          {
            id: "asset-codex-default",
            kind: "image",
            label: "Codex Default",
            path: "/tmp/codex-default.png",
          },
        ],
        mappings: [
          {
            assetId: "asset-claude-working",
            state: "working",
          },
        ],
        providerOverrides: {
          codex: {
            defaultAssetId: "asset-codex-default",
            emotionDescriptions: [],
            mappings: [],
            stateLines: [],
            useBaseProviderWhenMissing: true,
          },
        },
        stateLines: [],
        emotionDescriptions: [],
      },
    );

    expect(visual?.resolution.asset.id).toBe("asset-codex-default");
    expect(visual?.resolution.match).toBe("default");
  });
});
