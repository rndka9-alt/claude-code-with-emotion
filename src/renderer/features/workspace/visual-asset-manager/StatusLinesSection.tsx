import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactElement,
} from "react";
import { CircleHelp, Image as ImageIcon, Search } from "lucide-react";
import type { VisualAssetCatalog } from "../../../../shared/visual-assets";
import {
  getDefaultVisualStateLine,
  STATE_PRESETS,
  type VisualStatePresetId,
} from "../../../../shared/visual-presets";
import { createStatusPanelAssetUrl } from "../status-panel";
import {
  managerIconClassName,
  managerInputClassName,
  managerSearchIconWrapperClassName,
  managerSearchInputClassName,
  managerSectionCopyClassName,
} from "./shared";

interface StatusLinesSectionProps {
  catalog: VisualAssetCatalog;
  onSetStateLine: (state: VisualStatePresetId, line: string) => void;
}

function createStateLineDrafts(
  catalog: VisualAssetCatalog,
): Record<VisualStatePresetId, string> {
  const drafts: Record<VisualStatePresetId, string> = {
    disconnected: "",
    thinking: "",
    working: "",
    waiting: "",
    permission_wait: "",
    interrupted: "",
    compacting: "",
    completed: "",
    error: "",
    tool_failed: "",
  };

  for (const preset of STATE_PRESETS) {
    drafts[preset.id] =
      catalog.stateLines.find((mapping) => mapping.state === preset.id)?.line ??
      "";
  }

  return drafts;
}

function getSituationMessageDescription(state: VisualStatePresetId): string {
  if (state === "disconnected") {
    return "Claude 세션이 아직 연결되지 않은 상태예요.";
  }

  if (state === "thinking") {
    return "질문을 읽거나 다음 행동을 정리하면서 흐름을 잡는 상태예요.";
  }

  if (state === "working") {
    return "툴을 쓰거나 파일을 수정하면서 실제 작업을 진행 중인 상태예요.";
  }

  if (state === "waiting") {
    return "작업이 잠시 멈춰 있고 다음 입력이나 이벤트를 기다리는 상태예요.";
  }

  if (state === "permission_wait") {
    return "권한 허용이 필요해서 다음 툴 작업으로 못 넘어가고 멈춘 상태예요.";
  }

  if (state === "interrupted") {
    return "현재 턴 작업이 중간에 끊긴 상태예요.";
  }

  if (state === "compacting") {
    return "대화 내용을 compact 하는 중이라 잠깐 자리를 비운 상태예요.";
  }

  if (state === "completed") {
    return "작업이 끝나고 마무리된 상태예요.";
  }

  if (state === "tool_failed") {
    return "세션은 살아 있지만 특정 툴 시도가 실패한 상태예요.";
  }

  return "오류가 발생해서 정상 흐름에서 벗어난 상태예요.";
}

export function StatusLinesSection({
  catalog,
  onSetStateLine,
}: StatusLinesSectionProps): ReactElement {
  const [stateLineDrafts, setStateLineDrafts] = useState<
    Record<VisualStatePresetId, string>
  >(() => createStateLineDrafts(catalog));
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setStateLineDrafts(createStateLineDrafts(catalog));
  }, [catalog]);

  // 매핑된 이미지를 preset 루프 안에서 즉석으로 찾으면 스캔이 n*m 으로 늘어나니
  // state-only mapping 만 골라 미리 Map 으로 만들어 둔다.
  const stateAssetUrls = useMemo(() => {
    const urls = new Map<VisualStatePresetId, string>();

    for (const mapping of catalog.mappings) {
      if (mapping.state === undefined || mapping.emotion !== undefined) {
        continue;
      }

      const asset = catalog.assets.find(
        (candidate) => candidate.id === mapping.assetId,
      );

      if (asset === undefined) {
        continue;
      }

      urls.set(mapping.state, createStatusPanelAssetUrl(asset.path));
    }

    return urls;
  }, [catalog]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const filteredPresets = useMemo(() => {
    if (normalizedSearchQuery.length === 0) {
      return STATE_PRESETS;
    }

    return STATE_PRESETS.filter((preset) => {
      return (
        preset.label.toLowerCase().includes(normalizedSearchQuery) ||
        preset.id.toLowerCase().includes(normalizedSearchQuery) ||
        getSituationMessageDescription(preset.id)
          .toLowerCase()
          .includes(normalizedSearchQuery)
      );
    });
  }, [normalizedSearchQuery]);

  return (
    <section className="flex flex-col gap-2">
      <h3 className="m-0">Status Text</h3>
      <p className={managerSectionCopyClassName}>
        상태별 기본 한 줄을 덮어써요. Claude가 직접 띄운 overlay 문구는 여전히
        먼저 보여요.
      </p>
      <div className="relative">
        <span className={managerSearchIconWrapperClassName}>
          <Search aria-hidden="true" className={managerIconClassName} />
        </span>
        <input
          aria-label="상태 설명 검색"
          className={managerSearchInputClassName}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setSearchQuery(event.currentTarget.value);
          }}
          placeholder="상태 또는 설명으로 검색"
          type="search"
          value={searchQuery}
        />
      </div>
      {filteredPresets.length === 0 ? (
        <div className="border border-dashed border-border-muted bg-surface-empty p-7 text-text-faint">
          검색어에 걸리는 상태가 읍어요...!
        </div>
      ) : null}
      <div className="grid gap-3 min-[901px]:grid-cols-2">
        {filteredPresets.map((preset) => {
          const inputId = `state-line-${preset.id}`;
          const assetUrl = stateAssetUrls.get(preset.id) ?? null;

          return (
            <div className="flex flex-col gap-1.5" key={preset.id}>
              <div className="flex items-center gap-1.5">
                <label
                  className="text-xs font-semibold text-text-secondary"
                  htmlFor={inputId}
                >
                  {preset.label}
                </label>
                <span className="group relative inline-flex items-center">
                  <button
                    aria-label={`${preset.label} 상태 설명 보기`}
                    className="inline-flex h-[18px] w-[18px] items-center justify-center bg-transparent text-text-accent"
                    type="button"
                  >
                    <CircleHelp
                      aria-hidden="true"
                      className={managerIconClassName}
                    />
                  </button>
                  <span
                    className="pointer-events-none absolute top-full left-0 z-[1] mt-2 block w-[220px] -translate-y-1 border border-tab-border bg-surface-tooltip px-3 py-2.5 text-xs leading-[1.45] text-text-tooltip opacity-0 shadow-tooltip transition-[opacity,transform] duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
                    role="tooltip"
                  >
                    {getSituationMessageDescription(preset.id)}
                  </span>
                </span>
                {assetUrl !== null ? (
                  <span className="group relative inline-flex items-center">
                    <button
                      aria-label={`${preset.label} 매핑 이미지 미리보기`}
                      className="inline-flex h-[18px] w-[18px] items-center justify-center bg-transparent text-text-accent"
                      type="button"
                    >
                      <ImageIcon
                        aria-hidden="true"
                        className={managerIconClassName}
                      />
                    </button>
                    <span
                      className="pointer-events-none absolute top-full left-0 z-[1] mt-2 block w-32 -translate-y-1 border border-tab-border bg-surface-tooltip opacity-0 shadow-tooltip transition-[opacity,transform] duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
                      role="tooltip"
                    >
                      <img
                        alt=""
                        className="block aspect-square w-full object-cover"
                        src={assetUrl}
                      />
                    </span>
                  </span>
                ) : null}
              </div>
              <input
                className={managerInputClassName}
                id={inputId}
                onBlur={() => {
                  onSetStateLine(preset.id, stateLineDrafts[preset.id]);
                }}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const nextLine = event.currentTarget.value;

                  setStateLineDrafts((current) => {
                    return {
                      ...current,
                      [preset.id]: nextLine,
                    };
                  });
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                placeholder={getDefaultVisualStateLine(preset.id)}
                type="text"
                value={stateLineDrafts[preset.id]}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
