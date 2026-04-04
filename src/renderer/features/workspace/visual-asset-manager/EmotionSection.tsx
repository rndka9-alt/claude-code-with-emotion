import {
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactElement,
} from 'react';
import { Trash2 } from 'lucide-react';
import type { VisualAssetCatalog } from '../../../../shared/visual-assets';
import {
  EMOTION_PRESETS,
  STATE_PRESETS,
  type VisualEmotionPresetId,
  type VisualStatePresetId,
} from '../../../../shared/visual-presets';
import { createStatusPanelAssetUrl } from '../status-panel-visual';
import {
  managerChipClassName,
  managerIconButtonClassName,
  managerIconClassName,
  managerSectionCopyClassName,
} from './shared';

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

  const handleAssetDragLeave = (event: DragEvent<HTMLDivElement>): void => {
    const nextTarget = event.relatedTarget;

    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
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
          'mb-4 border border-dashed px-4 py-3 transition-colors duration-150',
          isAssetDropActive
            ? 'border-border-strong bg-surface-elevated-active'
            : 'border-border-soft bg-surface-elevated',
        ].join(' ')}
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
          자동 매칭 규칙: <code>working.png</code>, <code>happy.png</code>,{' '}
          <code>working__happy.png</code>, <code>default__fallback.png</code>
        </p>
      </div>
      {catalog.assets.length === 0 ? (
        <div className="mt-4 border border-dashed border-border-muted bg-surface-empty p-7 text-text-faint">
          아직 등록된 이미지가 읍어요...! 먼저 파일 몇 장 골라서 붙여보죠.
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {catalog.assets.map((asset) => {
            const stateMappingIdPrefix = `state-${asset.id}`;
            const emotionMappingIdPrefix = `emotion-${asset.id}`;
            const pairMappingIdPrefix = `pair-${asset.id}`;

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
                    <div>
                      <h3 className="m-0 break-all">{asset.label}</h3>
                      <p className={`${managerSectionCopyClassName} break-all`}>
                        {asset.path}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <label className={managerChipClassName}>
                        <input
                          checked={asset.isDefault === true}
                          className="accent-terminal-blue"
                          onChange={(event: ChangeEvent<HTMLInputElement>) => {
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

                          return (
                            <label
                              className={managerChipClassName}
                              htmlFor={inputId}
                              key={preset.id}
                              title={preset.description}
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
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <h4 className="m-0">Emotion Presets</h4>
                      <div className="flex flex-wrap gap-2">
                        {EMOTION_PRESETS.map((preset) => {
                          if (preset.id === 'neutral') {
                            return null;
                          }

                          const inputId = `${emotionMappingIdPrefix}-${preset.id}`;

                          return (
                            <label
                              className={managerChipClassName}
                              htmlFor={inputId}
                              key={preset.id}
                              title={preset.description}
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
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <h4 className="m-0">Exact State + Emotion</h4>
                      <p className={managerSectionCopyClassName}>
                        이건 state-only, emotion-only보다 먼저 잡혀요. 진짜 전용 표정 카드예요...!
                      </p>
                      <div className="flex flex-col gap-2.5">
                        {EMOTION_PRESETS.map((emotionPreset) => {
                          if (emotionPreset.id === 'neutral') {
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

                                  return (
                                    <label
                                      className={`${managerChipClassName} text-xs`}
                                      htmlFor={inputId}
                                      key={`${statePreset.id}-${emotionPreset.id}`}
                                      title={`${statePreset.label} + ${emotionPreset.label}`}
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
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </details>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
