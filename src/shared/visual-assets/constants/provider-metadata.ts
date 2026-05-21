import { STATE_PRESETS } from "../../visual-presets";
import type {
  VisualAssetProviderId,
  VisualAssetProviderOption,
  VisualProviderStateMetadata,
} from "../types/visual-asset-types";

export const BASE_VISUAL_ASSET_PROVIDER_ID = "claude";

export const VISUAL_ASSET_PROVIDER_OPTIONS: ReadonlyArray<VisualAssetProviderOption> =
  [
    {
      id: "claude",
      isBase: true,
      label: "Claude Code",
    },
    {
      id: "codex",
      isBase: false,
      label: "Codex",
    },
  ];

export const VISUAL_PROVIDER_STATE_METADATA: Record<
  VisualAssetProviderId,
  ReadonlyArray<VisualProviderStateMetadata>
> = {
  claude: STATE_PRESETS.map((preset) => {
    return {
      description: preset.description,
      eventNames: [],
      state: preset.id,
    };
  }),
  codex: [
    {
      description: "Codex CLI가 아직 연결되지 않았거나 종료된 상태예요.",
      eventNames: ["Codex wrapper start/end"],
      state: "disconnected",
    },
    {
      description: "Codex가 요청을 읽거나 도구 결과를 정리하는 상태예요.",
      eventNames: ["UserPromptSubmit", "PostToolUse"],
      state: "thinking",
    },
    {
      description: "Codex가 도구 실행을 준비하거나 실제 작업으로 들어가는 상태예요.",
      eventNames: ["PreToolUse", "Codex wrapper start"],
      state: "working",
    },
    {
      description: "Codex가 다음 입력을 기다리는 상태예요.",
      eventNames: ["SessionStart", "Stop"],
      state: "waiting",
    },
    {
      description: "Codex가 권한 확인 응답을 기다리는 상태예요.",
      eventNames: ["PermissionRequest"],
      state: "permission_wait",
    },
    {
      description: "Codex가 대화 맥락을 압축하는 상태예요.",
      eventNames: ["PreCompact"],
      state: "compacting",
    },
    {
      description: "Codex가 대화 맥락 압축을 마친 상태예요.",
      eventNames: ["PostCompact"],
      state: "completed",
    },
    {
      description: "Codex CLI 실행이 오류로 끝난 상태예요.",
      eventNames: ["Codex wrapper error"],
      state: "error",
    },
  ],
};
