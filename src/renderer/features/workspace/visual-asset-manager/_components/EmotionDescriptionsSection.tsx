import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactElement,
} from "react";
import {
  CircleAlert,
  CircleHelp,
  Image as ImageIcon,
  Search,
} from "lucide-react";
import type { VisualAssetCatalog } from "../../../../../shared/visual-assets";
import {
  EMOTION_PRESETS,
  type VisualEmotionPresetId,
} from "../../../../../shared/visual-presets";
import { createStatusPanelAssetUrl } from "../../status-panel";
import {
  managerIconClassName,
  managerInputClassName,
  managerSearchIconWrapperClassName,
  managerSearchInputClassName,
  managerSectionCopyClassName,
} from "../_utils";

interface EmotionDescriptionsSectionProps {
  catalog: VisualAssetCatalog;
  onSetEmotionDescription: (
    emotion: VisualEmotionPresetId,
    description: string,
  ) => void;
}

function createEmotionDescriptionDrafts(
  catalog: VisualAssetCatalog,
): Record<VisualEmotionPresetId, string> {
  const drafts: Record<VisualEmotionPresetId, string> = {
    angry: "",
    annoyed: "",
    bored: "",
    confused: "",
    contemptuous: "",
    crying: "",
    curious: "",
    determined: "",
    dumbfounded: "",
    embarrassed: "",
    excited: "",
    exhausted: "",
    happy: "",
    laughing: "",
    nervous: "",
    neutral: "",
    proud: "",
    sad: "",
    scared: "",
    serious: "",
    shy: "",
    smile: "",
    smirk: "",
    smug: "",
    surprised: "",
  };

  for (const mapping of catalog.emotionDescriptions) {
    drafts[mapping.emotion] = mapping.description;
  }

  return drafts;
}

function collectMappedEmotions(
  catalog: VisualAssetCatalog,
): ReadonlySet<VisualEmotionPresetId> {
  const mapped = new Set<VisualEmotionPresetId>();

  for (const mapping of catalog.mappings) {
    if (mapping.emotion !== undefined) {
      mapped.add(mapping.emotion);
    }
  }

  return mapped;
}

const tooltipClassName =
  "pointer-events-none absolute top-full left-0 z-[1] mt-2 block w-[220px] -translate-y-1 border border-tab-border bg-surface-tooltip px-3 py-2.5 text-xs leading-[1.45] text-text-tooltip opacity-0 shadow-tooltip transition-[opacity,transform] duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100";

export function EmotionDescriptionsSection({
  catalog,
  onSetEmotionDescription,
}: EmotionDescriptionsSectionProps): ReactElement {
  const [descriptionDrafts, setDescriptionDrafts] = useState<
    Record<VisualEmotionPresetId, string>
  >(() => createEmotionDescriptionDrafts(catalog));
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setDescriptionDrafts(createEmotionDescriptionDrafts(catalog));
  }, [catalog]);

  const mappedEmotions = useMemo(
    () => collectMappedEmotions(catalog),
    [catalog],
  );

  // emotion-only 매핑만 추려서 미리 Map 으로 두면 렌더 루프가 n*m 스캔을 피한다.
  const emotionAssetUrls = useMemo(() => {
    const urls = new Map<VisualEmotionPresetId, string>();

    for (const mapping of catalog.mappings) {
      if (mapping.emotion === undefined || mapping.state !== undefined) {
        continue;
      }

      const asset = catalog.assets.find(
        (candidate) => candidate.id === mapping.assetId,
      );

      if (asset === undefined) {
        continue;
      }

      urls.set(mapping.emotion, createStatusPanelAssetUrl(asset.path));
    }

    return urls;
  }, [catalog]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  // draft 값(사용자가 덮어쓴 설명)도 검색 대상에 넣어야 스크롤 뒤에 숨은 편집 내용도 잡혀요.
  const filteredPresets = useMemo(() => {
    if (normalizedSearchQuery.length === 0) {
      return EMOTION_PRESETS;
    }

    return EMOTION_PRESETS.filter((preset) => {
      if (
        preset.label.toLowerCase().includes(normalizedSearchQuery) ||
        preset.id.toLowerCase().includes(normalizedSearchQuery) ||
        preset.description.toLowerCase().includes(normalizedSearchQuery)
      ) {
        return true;
      }

      const draft = descriptionDrafts[preset.id];

      return draft.toLowerCase().includes(normalizedSearchQuery);
    });
  }, [normalizedSearchQuery, descriptionDrafts]);

  return (
    <section className="flex flex-col gap-2">
      <h3 className="m-0">Emotion Descriptions</h3>
      <p className={managerSectionCopyClassName}>
        감정별 설명을 덮어써서 Claude 에게 다른 가이드를 넘겨요. 비워두면 기본
        프리셋 설명이 그대로 사용돼요.
      </p>
      <div className="relative">
        <span className={managerSearchIconWrapperClassName}>
          <Search aria-hidden="true" className={managerIconClassName} />
        </span>
        <input
          aria-label="감정 설명 검색"
          className={managerSearchInputClassName}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setSearchQuery(event.currentTarget.value);
          }}
          placeholder="감정 또는 설명으로 검색"
          type="search"
          value={searchQuery}
        />
      </div>
      {filteredPresets.length === 0 ? (
        <div className="border border-dashed border-border-muted bg-surface-empty p-7 text-text-faint">
          검색어에 걸리는 감정이 읍어요...!
        </div>
      ) : null}
      <div className="grid gap-3 min-[901px]:grid-cols-2">
        {filteredPresets.map((preset) => {
          const inputId = `emotion-description-${preset.id}`;
          const isNeutral = preset.id === "neutral";
          const isUnmapped = !isNeutral && !mappedEmotions.has(preset.id);
          const assetUrl = emotionAssetUrls.get(preset.id) ?? null;

          return (
            <div className="flex flex-col gap-1.5" key={preset.id}>
              <div className="flex items-center gap-1.5">
                <label
                  className="text-xs font-semibold text-text-secondary"
                  htmlFor={inputId}
                >
                  {preset.label}
                </label>
                {isNeutral ? (
                  <span className="group relative inline-flex items-center">
                    <button
                      aria-label="neutral 감정 설명 편집이 불가한 이유 보기"
                      className="inline-flex h-[18px] w-[18px] items-center justify-center bg-transparent text-text-accent"
                      type="button"
                    >
                      <CircleHelp
                        aria-hidden="true"
                        className={managerIconClassName}
                      />
                    </button>
                    <span className={tooltipClassName} role="tooltip">
                      neutral 은 감정 오버레이를 해제하는 용도라 설명 커스텀이
                      필요 업서요.
                    </span>
                  </span>
                ) : null}
                {isUnmapped ? (
                  <span className="group relative inline-flex items-center">
                    <button
                      aria-label={`${preset.label} 감정은 매핑된 이미지가 업음`}
                      className="inline-flex h-[18px] w-[18px] items-center justify-center bg-transparent text-text-warning"
                      type="button"
                    >
                      <CircleAlert
                        aria-hidden="true"
                        className={managerIconClassName}
                      />
                    </button>
                    <span className={tooltipClassName} role="tooltip">
                      매핑된 이미지가 없어 적용되지 않습니다.
                    </span>
                  </span>
                ) : null}
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
                disabled={isNeutral}
                id={inputId}
                onBlur={() => {
                  if (isNeutral) {
                    return;
                  }

                  onSetEmotionDescription(
                    preset.id,
                    descriptionDrafts[preset.id],
                  );
                }}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const nextDescription = event.currentTarget.value;

                  setDescriptionDrafts((current) => {
                    return {
                      ...current,
                      [preset.id]: nextDescription,
                    };
                  });
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                placeholder={preset.description}
                type="text"
                value={descriptionDrafts[preset.id]}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
