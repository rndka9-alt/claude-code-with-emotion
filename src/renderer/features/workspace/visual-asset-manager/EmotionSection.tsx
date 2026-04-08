import {
  useMemo,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactElement,
} from "react";
import { Search, Trash2 } from "lucide-react";
import type { VisualAssetCatalog } from "../../../../shared/visual-assets";
import {
  EMOTION_PRESETS,
  STATE_PRESETS,
  type VisualEmotionPresetId,
  type VisualStatePresetId,
} from "../../../../shared/visual-presets";
import { createStatusPanelAssetUrl } from "../status-panel";
import {
  managerChipClassName,
  managerIconButtonClassName,
  managerIconClassName,
  managerSearchIconWrapperClassName,
  managerSearchInputClassName,
  managerSectionCopyClassName,
} from "./shared";

interface EmotionSectionProps {
  catalog: VisualAssetCatalog;
  onDropFiles: (files: ReadonlyArray<File>) => void;
  onRemoveAsset: (assetId: string) => void;
  onSetDefaultAsset: (assetId: string, isDefault: boolean) => void;
  onToggleEmotion: (
    assetId: string,
    emotion: VisualEmotionPresetId,
    isEnabled: boolean,
  ) => void;
  onToggleState: (
    assetId: string,
    state: VisualStatePresetId,
    isEnabled: boolean,
  ) => void;
  onToggleStateEmotion: (
    assetId: string,
    state: VisualStatePresetId,
    emotion: VisualEmotionPresetId,
    isEnabled: boolean,
  ) => void;
}

const visualAssetDropPathPattern = /\.(png|jpe?g|gif|webp)$/i;

function getDroppedVisualAssetFiles(files: FileList | null): File[] {
  return Array.from(files ?? []).filter((file) => {
    // Electron 32+에서 File.path가 사라졋어서 경로는 더 이상 여기서 체크 못 해요
    // 대신 드랍된 파일명 확장자만 보고 이미지인지 거르고, 실제 경로 해석은 상위 호출자에게 맡김
    return visualAssetDropPathPattern.test(file.name);
  });
}

function assetHasStateMapping(
  catalog: VisualAssetCatalog,
  assetId: string,
  state: VisualStatePresetId,
): boolean {
  return catalog.mappings.some((mapping) => {
    return (
      mapping.assetId === assetId &&
      mapping.state === state &&
      mapping.emotion === undefined
    );
  });
}

function assetHasEmotionMapping(
  catalog: VisualAssetCatalog,
  assetId: string,
  emotion: VisualEmotionPresetId,
): boolean {
  return catalog.mappings.some((mapping) => {
    return (
      mapping.assetId === assetId &&
      mapping.state === undefined &&
      mapping.emotion === emotion
    );
  });
}

function assetHasStateEmotionMapping(
  catalog: VisualAssetCatalog,
  assetId: string,
  state: VisualStatePresetId,
  emotion: VisualEmotionPresetId,
): boolean {
  return catalog.mappings.some((mapping) => {
    return (
      mapping.assetId === assetId &&
      mapping.state === state &&
      mapping.emotion === emotion
    );
  });
}

// 현재 chip 기준에서 "다른 에셋" 이 슬롯을 점유 중이면 그 label 을 반환.
// 본인이 가지고 잇거나 아무도 안 가져갓으면 null. 배열 순서상 첫 유효 매핑만 본다 (resolver 동기화).
function findOtherOwnerLabelForState(
  catalog: VisualAssetCatalog,
  selfAssetId: string,
  state: VisualStatePresetId,
): string | null {
  for (const mapping of catalog.mappings) {
    if (mapping.state !== state || mapping.emotion !== undefined) {
      continue;
    }

    if (mapping.assetId === selfAssetId) {
      return null;
    }

    const ownerAsset = catalog.assets.find((asset) => {
      return asset.id === mapping.assetId;
    });

    if (ownerAsset !== undefined) {
      return ownerAsset.label;
    }
  }

  return null;
}

function findOtherOwnerLabelForEmotion(
  catalog: VisualAssetCatalog,
  selfAssetId: string,
  emotion: VisualEmotionPresetId,
): string | null {
  for (const mapping of catalog.mappings) {
    if (mapping.emotion !== emotion || mapping.state !== undefined) {
      continue;
    }

    if (mapping.assetId === selfAssetId) {
      return null;
    }

    const ownerAsset = catalog.assets.find((asset) => {
      return asset.id === mapping.assetId;
    });

    if (ownerAsset !== undefined) {
      return ownerAsset.label;
    }
  }

  return null;
}

function findOtherOwnerLabelForStateEmotion(
  catalog: VisualAssetCatalog,
  selfAssetId: string,
  state: VisualStatePresetId,
  emotion: VisualEmotionPresetId,
): string | null {
  for (const mapping of catalog.mappings) {
    if (mapping.state !== state || mapping.emotion !== emotion) {
      continue;
    }

    if (mapping.assetId === selfAssetId) {
      return null;
    }

    const ownerAsset = catalog.assets.find((asset) => {
      return asset.id === mapping.assetId;
    });

    if (ownerAsset !== undefined) {
      return ownerAsset.label;
    }
  }

  return null;
}

function buildChipTitle(
  baseDescription: string,
  otherOwnerLabel: string | null,
): string {
  if (otherOwnerLabel === null) {
    return baseDescription;
  }

  return `${baseDescription} · 현재 점유: ${otherOwnerLabel}`;
}

interface AssetMappingBadge {
  key: string;
  label: string;
}

// 검색어 하나로 파일명과 적용된 감정/상태 라벨을 다 훑어요. 사이드바 정렬 순서까진 안 건드림.
function assetMatchesSearchQuery(
  catalog: VisualAssetCatalog,
  assetId: string,
  assetLabel: string,
  normalizedQuery: string,
): boolean {
  if (normalizedQuery.length === 0) {
    return true;
  }

  if (assetLabel.toLowerCase().includes(normalizedQuery)) {
    return true;
  }

  for (const mapping of catalog.mappings) {
    if (mapping.assetId !== assetId) {
      continue;
    }

    if (mapping.state !== undefined) {
      const statePreset = STATE_PRESETS.find((preset) => {
        return preset.id === mapping.state;
      });

      if (
        statePreset !== undefined &&
        (statePreset.label.toLowerCase().includes(normalizedQuery) ||
          statePreset.id.toLowerCase().includes(normalizedQuery))
      ) {
        return true;
      }
    }

    if (mapping.emotion !== undefined) {
      const emotionPreset = EMOTION_PRESETS.find((preset) => {
        return preset.id === mapping.emotion;
      });

      if (
        emotionPreset !== undefined &&
        (emotionPreset.label.toLowerCase().includes(normalizedQuery) ||
          emotionPreset.id.toLowerCase().includes(normalizedQuery))
      ) {
        return true;
      }
    }
  }

  return false;
}

// 라벨 배지는 사이드바에 조용히 서 잇도록 STATE_PRESETS / EMOTION_PRESETS 순서를
// 그대로 따라가게 햇어요. 매핑 추가/삭제에 따라 순서가 춤추면 쭈인님이 어지러우니까...!
function collectAssetMappingBadges(
  catalog: VisualAssetCatalog,
  assetId: string,
): ReadonlyArray<AssetMappingBadge> {
  const pairBadges: AssetMappingBadge[] = [];
  const stateBadges: AssetMappingBadge[] = [];
  const emotionBadges: AssetMappingBadge[] = [];

  for (const statePreset of STATE_PRESETS) {
    for (const emotionPreset of EMOTION_PRESETS) {
      if (emotionPreset.id === "neutral") {
        continue;
      }

      if (
        assetHasStateEmotionMapping(
          catalog,
          assetId,
          statePreset.id,
          emotionPreset.id,
        )
      ) {
        pairBadges.push({
          key: `pair-${statePreset.id}-${emotionPreset.id}`,
          label: `${statePreset.label} + ${emotionPreset.label}`,
        });
      }
    }
  }

  for (const statePreset of STATE_PRESETS) {
    if (assetHasStateMapping(catalog, assetId, statePreset.id)) {
      stateBadges.push({
        key: `state-${statePreset.id}`,
        label: statePreset.label,
      });
    }
  }

  for (const emotionPreset of EMOTION_PRESETS) {
    if (emotionPreset.id === "neutral") {
      continue;
    }

    if (assetHasEmotionMapping(catalog, assetId, emotionPreset.id)) {
      emotionBadges.push({
        key: `emotion-${emotionPreset.id}`,
        label: emotionPreset.label,
      });
    }
  }

  return [...pairBadges, ...stateBadges, ...emotionBadges];
}

export function EmotionSection({
  catalog,
  onDropFiles,
  onRemoveAsset,
  onSetDefaultAsset,
  onToggleEmotion,
  onToggleState,
  onToggleStateEmotion,
}: EmotionSectionProps): ReactElement {
  const [isAssetDropActive, setIsAssetDropActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const filteredAssets = useMemo(() => {
    return catalog.assets.filter((asset) => {
      return assetMatchesSearchQuery(
        catalog,
        asset.id,
        asset.label,
        normalizedSearchQuery,
      );
    });
  }, [catalog, normalizedSearchQuery]);

  const handleAssetDragLeave = (event: DragEvent<HTMLDivElement>): void => {
    const nextTarget = event.relatedTarget;

    if (
      nextTarget instanceof Node &&
      event.currentTarget.contains(nextTarget)
    ) {
      return;
    }

    setIsAssetDropActive(false);
  };

  const handleAssetDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setIsAssetDropActive(false);

    const droppedFiles = getDroppedVisualAssetFiles(event.dataTransfer.files);

    if (droppedFiles.length > 0) {
      onDropFiles(droppedFiles);
    }
  };

  return (
    <>
      <div className="mb-4">
        <h3 className="m-0">Emotion Asset Mapping</h3>
        <p className={managerSectionCopyClassName}>
          상태 preset이 기본 축이고, 감정 preset은 선택적으로 얹혀요.
        </p>
      </div>
      <div
        aria-label="Image drop zone"
        className={[
          "mb-4 border border-dashed px-4 py-3 transition-colors duration-150",
          isAssetDropActive
            ? "border-border-strong bg-surface-elevated-active"
            : "border-border-soft bg-surface-elevated",
        ].join(" ")}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsAssetDropActive(true);
        }}
        onDragLeave={handleAssetDragLeave}
        onDragOver={(event) => {
          event.preventDefault();
          setIsAssetDropActive(true);
        }}
        onDrop={handleAssetDrop}
      >
        <p className="m-0 text-sm text-text-secondary">
          이미지를 여기로 여러 장 드래그해서 바로 가져올 수 있어요.
        </p>
        <p className={managerSectionCopyClassName}>
          자동 매칭 규칙: 토큰은 <code>__</code>(언더스코어 2개)로 구분해요. 한
          카테고리만 여러 개 넣으면 해당 슬롯을 전부 차지하고, 상태·감정이
          섞이면 1:1만 결합 슬롯으로 가요. 그 외엔 개수 큰 쪽만 반영되고
          동점이면 감정이 이겨요. 예) <code>working.png</code>,{" "}
          <code>happy.png</code>, <code>working__happy.png</code>,{" "}
          <code>happy__angry__sad.png</code>,{" "}
          <code>default__fallback.png</code>
        </p>
      </div>
      {catalog.assets.length === 0 ? (
        <div className="mt-4 border border-dashed border-border-muted bg-surface-empty p-7 text-text-faint">
          아직 등록된 이미지가 읍어요...! 먼저 파일 몇 장 골라서 붙여보죠.
        </div>
      ) : (
        <>
          <div className="relative mb-3">
            <span className={managerSearchIconWrapperClassName}>
              <Search aria-hidden="true" className={managerIconClassName} />
            </span>
            <input
              aria-label="감정 에셋 검색"
              className={managerSearchInputClassName}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setSearchQuery(event.currentTarget.value);
              }}
              placeholder="파일명 또는 적용된 감정·상태로 검색"
              type="search"
              value={searchQuery}
            />
          </div>
          {filteredAssets.length === 0 ? (
            <div className="border border-dashed border-border-muted bg-surface-empty p-7 text-text-faint">
              검색어에 걸리는 에셋이 읍어요...!
            </div>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-4 p-0">
              {filteredAssets.map((asset) => {
                const stateMappingIdPrefix = `state-${asset.id}`;
                const emotionMappingIdPrefix = `emotion-${asset.id}`;
                const pairMappingIdPrefix = `pair-${asset.id}`;
                const mappingBadges = collectAssetMappingBadges(
                  catalog,
                  asset.id,
                );

                return (
                  <li
                    className="grid gap-4 border border-border-soft bg-surface-chip p-4 min-[901px]:grid-cols-[140px_minmax(0,1fr)]"
                    key={asset.id}
                  >
                    <div className="aspect-square w-[140px] overflow-hidden bg-surface-preview">
                      <img
                        alt={asset.label}
                        className="block h-full w-full object-cover"
                        src={createStatusPanelAssetUrl(asset.path)}
                      />
                    </div>

                    <div className="flex min-w-0 flex-col gap-[14px]">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex min-w-0 flex-col gap-2">
                          <h3 className="m-0 break-all">{asset.label}</h3>
                          {mappingBadges.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {mappingBadges.map((badge) => {
                                return (
                                  <span
                                    className="inline-flex items-center border border-border-soft bg-surface-elevated px-2 py-0.5 text-xs text-text-secondary"
                                    key={badge.key}
                                  >
                                    {badge.label}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <p className={managerSectionCopyClassName}>
                              아직 연결된 감정·상태가 읍어요...
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5">
                          <label className={managerChipClassName}>
                            <input
                              checked={asset.isDefault === true}
                              className="accent-terminal-blue"
                              onChange={(
                                event: ChangeEvent<HTMLInputElement>,
                              ) => {
                                onSetDefaultAsset(
                                  asset.id,
                                  event.currentTarget.checked,
                                );
                              }}
                              type="checkbox"
                            />
                            Default
                          </label>

                          <button
                            aria-label={`Remove ${asset.label}`}
                            className={managerIconButtonClassName}
                            onClick={() => {
                              onRemoveAsset(asset.id);
                            }}
                            type="button"
                          >
                            <Trash2
                              aria-hidden="true"
                              className={managerIconClassName}
                            />
                          </button>
                        </div>
                      </div>

                      <details className="group flex flex-col gap-[14px]">
                        <summary className="flex cursor-pointer list-none items-center justify-between border border-border-soft bg-surface-elevated px-3 py-2 text-sm text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-text-highlight [&::-webkit-details-marker]:hidden">
                          <span>매핑 설정</span>
                          <span className="text-xs text-text-subtle transition-transform duration-150 group-open:rotate-180">
                            ▾
                          </span>
                        </summary>

                        <div className="flex flex-col gap-2">
                          <h4 className="m-0">State Presets</h4>
                          <div className="flex flex-wrap gap-2">
                            {STATE_PRESETS.map((preset) => {
                              const inputId = `${stateMappingIdPrefix}-${preset.id}`;
                              const otherOwnerLabel =
                                findOtherOwnerLabelForState(
                                  catalog,
                                  asset.id,
                                  preset.id,
                                );

                              return (
                                <label
                                  className={managerChipClassName}
                                  htmlFor={inputId}
                                  key={preset.id}
                                  title={buildChipTitle(
                                    preset.description,
                                    otherOwnerLabel,
                                  )}
                                >
                                  <input
                                    checked={assetHasStateMapping(
                                      catalog,
                                      asset.id,
                                      preset.id,
                                    )}
                                    className="accent-terminal-blue"
                                    id={inputId}
                                    onChange={(
                                      event: ChangeEvent<HTMLInputElement>,
                                    ) => {
                                      onToggleState(
                                        asset.id,
                                        preset.id,
                                        event.currentTarget.checked,
                                      );
                                    }}
                                    type="checkbox"
                                  />
                                  <span>{preset.label}</span>
                                  {otherOwnerLabel !== null ? (
                                    <span
                                      aria-hidden="true"
                                      className="inline-block h-1.5 w-1.5 rounded-full bg-text-warning"
                                    />
                                  ) : null}
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <h4 className="m-0">Emotion Presets</h4>
                          <div className="flex flex-wrap gap-2">
                            {EMOTION_PRESETS.map((preset) => {
                              if (preset.id === "neutral") {
                                return null;
                              }

                              const inputId = `${emotionMappingIdPrefix}-${preset.id}`;
                              const otherOwnerLabel =
                                findOtherOwnerLabelForEmotion(
                                  catalog,
                                  asset.id,
                                  preset.id,
                                );

                              return (
                                <label
                                  className={managerChipClassName}
                                  htmlFor={inputId}
                                  key={preset.id}
                                  title={buildChipTitle(
                                    preset.description,
                                    otherOwnerLabel,
                                  )}
                                >
                                  <input
                                    checked={assetHasEmotionMapping(
                                      catalog,
                                      asset.id,
                                      preset.id,
                                    )}
                                    className="accent-terminal-blue"
                                    id={inputId}
                                    onChange={(
                                      event: ChangeEvent<HTMLInputElement>,
                                    ) => {
                                      onToggleEmotion(
                                        asset.id,
                                        preset.id,
                                        event.currentTarget.checked,
                                      );
                                    }}
                                    type="checkbox"
                                  />
                                  <span>{preset.label}</span>
                                  {otherOwnerLabel !== null ? (
                                    <span
                                      aria-hidden="true"
                                      className="inline-block h-1.5 w-1.5 rounded-full bg-text-warning"
                                    />
                                  ) : null}
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <details className="group/exact flex flex-col gap-2">
                          <summary className="flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
                            <h4 className="m-0">Exact State + Emotion</h4>
                            <span className="text-xs text-text-subtle transition-transform duration-150 group-open/exact:rotate-180">
                              ▾
                            </span>
                          </summary>
                          <p className={managerSectionCopyClassName}>
                            이건 state-only, emotion-only보다 먼저 잡혀요. 진짜
                            전용 표정 카드예요...!
                          </p>
                          <div className="flex flex-col gap-2.5">
                            {EMOTION_PRESETS.map((emotionPreset) => {
                              if (emotionPreset.id === "neutral") {
                                return null;
                              }

                              return (
                                <div
                                  className="grid items-start gap-2.5 min-[901px]:grid-cols-[92px_minmax(0,1fr)]"
                                  key={emotionPreset.id}
                                >
                                  <div className="pt-1.5 text-xs text-text-soft">
                                    {emotionPreset.label}
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    {STATE_PRESETS.map((statePreset) => {
                                      const inputId = `${pairMappingIdPrefix}-${statePreset.id}-${emotionPreset.id}`;
                                      const otherOwnerLabel =
                                        findOtherOwnerLabelForStateEmotion(
                                          catalog,
                                          asset.id,
                                          statePreset.id,
                                          emotionPreset.id,
                                        );

                                      return (
                                        <label
                                          className={`${managerChipClassName} text-xs`}
                                          htmlFor={inputId}
                                          key={`${statePreset.id}-${emotionPreset.id}`}
                                          title={buildChipTitle(
                                            `${statePreset.label} + ${emotionPreset.label}`,
                                            otherOwnerLabel,
                                          )}
                                        >
                                          <input
                                            checked={assetHasStateEmotionMapping(
                                              catalog,
                                              asset.id,
                                              statePreset.id,
                                              emotionPreset.id,
                                            )}
                                            className="accent-terminal-blue"
                                            id={inputId}
                                            onChange={(
                                              event: ChangeEvent<HTMLInputElement>,
                                            ) => {
                                              onToggleStateEmotion(
                                                asset.id,
                                                statePreset.id,
                                                emotionPreset.id,
                                                event.currentTarget.checked,
                                              );
                                            }}
                                            type="checkbox"
                                          />
                                          <span>{statePreset.label}</span>
                                          {otherOwnerLabel !== null ? (
                                            <span
                                              aria-hidden="true"
                                              className="inline-block h-1.5 w-1.5 rounded-full bg-text-warning"
                                            />
                                          ) : null}
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      </details>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </>
  );
}
