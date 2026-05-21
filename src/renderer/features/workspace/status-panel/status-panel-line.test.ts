import type { AssistantStatusSnapshot } from "../../../../shared/assistant-status";
import {
  createVisualAssetCatalogForProvider,
  type VisualAssetCatalog,
} from "../../../../shared/visual-assets";
import { formatStatusPanelLine } from "./status-panel-line";

const baseSnapshot: AssistantStatusSnapshot = {
  activityLabel: "자료를 찾는 중",
  emotion: null,
  overlayLine: null,
  state: "thinking",
  line: "질문 읽고 흐름 잡는 중이에요...!",
  currentTask: "Reading docs",
  updatedAtMs: 1,
  intensity: "medium",
  source: "test",
};

describe("formatStatusPanelLine", () => {
  it("renders the shared default state line in parentheses when no overlay line exists", () => {
    expect(formatStatusPanelLine(baseSnapshot)).toBe(
      "(질문 읽고 흐름 잡는 중이에요...!)",
    );
  });

  it("combines a custom overlay line with the current activity label", () => {
    expect(
      formatStatusPanelLine({
        ...baseSnapshot,
        overlayLine: "문제를 좀 더 파볼게요!",
        line: "문제를 좀 더 파볼게요!",
      }),
    ).toBe("문제를 좀 더 파볼게요!\n(자료를 찾는 중)");
  });

  it("falls back to the raw line when no activity label exists", () => {
    expect(
      formatStatusPanelLine({
        ...baseSnapshot,
        activityLabel: "",
        overlayLine: null,
      }),
    ).toBe("질문 읽고 흐름 잡는 중이에요...!");
  });

  it("uses a custom state line before the raw hook line", () => {
    expect(
      formatStatusPanelLine(baseSnapshot, {
        version: 1,
        assets: [],
        mappings: [],
        stateLines: [
          {
            state: "thinking",
            line: "상황 파악중...!",
          },
        ],
        emotionDescriptions: [],
      }),
    ).toBe("상황 파악중...!\n(자료를 찾는 중)");
  });

  it("resolves Codex state lines before Claude fallback lines", () => {
    const catalog: VisualAssetCatalog = {
      version: 1,
      assets: [],
      mappings: [],
      providerOverrides: {
        codex: {
          defaultAssetId: undefined,
          emotionDescriptions: [],
          mappings: [],
          stateLines: [
            {
              state: "thinking",
              line: "Codex가 생각 정리 중이에요...!",
            },
          ],
          useBaseProviderWhenMissing: true,
        },
      },
      stateLines: [
        {
          state: "thinking",
          line: "Claude가 생각 정리 중이에요...!",
        },
      ],
      emotionDescriptions: [],
    };

    const effectiveCatalog = createVisualAssetCatalogForProvider(
      catalog,
      "codex",
    );

    expect(
      formatStatusPanelLine(
        {
          ...baseSnapshot,
          assistantProviderId: "codex",
        },
        effectiveCatalog,
      ),
    ).toBe("Codex가 생각 정리 중이에요...!\n(자료를 찾는 중)");
  });

  it("uses a command-provided disconnected line before the Claude default line", () => {
    expect(
      formatStatusPanelLine({
        ...baseSnapshot,
        activityLabel: "연결 대기 중",
        currentTask: "Waiting for Codex CLI to start",
        line: "Codex CLI 세션이 종료돼서 지금은 미연결 상태예요...!",
        source: "assistant-command",
        state: "disconnected",
      }),
    ).toBe("Codex CLI 세션이 종료돼서 지금은 미연결 상태예요...!");
  });
});
