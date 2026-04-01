import type { ChangeEvent, ReactElement } from 'react';
import { ImagePlus, Trash2, X } from 'lucide-react';
import type { VisualAssetCatalog } from '../../../shared/visual-assets';
import {
  EMOTION_PRESETS,
  STATE_PRESETS,
  type VisualEmotionPresetId,
  type VisualStatePresetId,
} from '../../../shared/visual-presets';
import { createStatusPanelAssetUrl } from './status-panel-visual';

interface VisualAssetManagerDialogProps {
  catalog: VisualAssetCatalog;
  onClose: () => void;
  onPickFiles: () => void;
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

export function VisualAssetManagerDialog({
  catalog,
  onClose,
  onPickFiles,
  onRemoveAsset,
  onSetDefaultAsset,
  onToggleEmotion,
  onToggleState,
  onToggleStateEmotion,
}: VisualAssetManagerDialogProps): ReactElement {
  return (
    <div
      aria-label="Visual asset manager overlay"
      className="visual-asset-manager"
      role="presentation"
    >
      <div
        aria-label="Visual asset manager"
        aria-modal="true"
        className="visual-asset-manager__dialog"
        role="dialog"
      >
        <header className="visual-asset-manager__header">
          <div>
            <h2 className="visual-asset-manager__title">Visual Assets</h2>
            <p className="visual-asset-manager__copy">
              상태 preset이 기본 축이에요. 감정 preset은 선택적으로 얹혀요.
            </p>
          </div>

          <div className="visual-asset-manager__actions">
            <button
              className="visual-asset-manager__add-button"
              onClick={onPickFiles}
              type="button"
            >
              <ImagePlus aria-hidden="true" className="visual-asset-manager__icon" />
              Add Images
            </button>

            <button
              aria-label="Close visual asset manager"
              className="visual-asset-manager__close-button"
              onClick={onClose}
              type="button"
            >
              <X aria-hidden="true" className="visual-asset-manager__icon" />
            </button>
          </div>
        </header>

        <div className="visual-asset-manager__body">
          {catalog.assets.length === 0 ? (
            <div className="visual-asset-manager__empty">
              아직 등록된 이미지가 읍어요...! 먼저 파일 몇 장 골라서 붙여보죠.
            </div>
          ) : (
            <ul className="visual-asset-manager__asset-list">
              {catalog.assets.map((asset) => {
                const stateMappingIdPrefix = `state-${asset.id}`;
                const emotionMappingIdPrefix = `emotion-${asset.id}`;
                const pairMappingIdPrefix = `pair-${asset.id}`;

                return (
                  <li className="visual-asset-manager__asset" key={asset.id}>
                    <div className="visual-asset-manager__asset-preview">
                      <img
                        alt={asset.label}
                        className="visual-asset-manager__asset-image"
                        src={createStatusPanelAssetUrl(asset.path)}
                      />
                    </div>

                    <div className="visual-asset-manager__asset-meta">
                      <div className="visual-asset-manager__asset-heading">
                        <div>
                          <h3 className="visual-asset-manager__asset-label">
                            {asset.label}
                          </h3>
                          <p className="visual-asset-manager__asset-path">
                            {asset.path}
                          </p>
                        </div>

                        <div className="visual-asset-manager__asset-buttons">
                          <label className="visual-asset-manager__toggle">
                            <input
                              checked={asset.isDefault === true}
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
                            className="visual-asset-manager__remove-button"
                            onClick={() => {
                              onRemoveAsset(asset.id);
                            }}
                            type="button"
                          >
                            <Trash2
                              aria-hidden="true"
                              className="visual-asset-manager__icon"
                            />
                          </button>
                        </div>
                      </div>

                      <div className="visual-asset-manager__mapping-group">
                        <h4 className="visual-asset-manager__mapping-title">
                          State Presets
                        </h4>
                        <div className="visual-asset-manager__chips">
                          {STATE_PRESETS.map((preset) => {
                            const inputId = `${stateMappingIdPrefix}-${preset.id}`;

                            return (
                              <label
                                className="visual-asset-manager__chip"
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

                      <div className="visual-asset-manager__mapping-group">
                        <h4 className="visual-asset-manager__mapping-title">
                          Emotion Presets
                        </h4>
                        <div className="visual-asset-manager__chips">
                          {EMOTION_PRESETS.map((preset) => {
                            if (preset.id === 'neutral') {
                              return null;
                            }

                            const inputId = `${emotionMappingIdPrefix}-${preset.id}`;

                            return (
                              <label
                                className="visual-asset-manager__chip"
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

                      <div className="visual-asset-manager__mapping-group">
                        <h4 className="visual-asset-manager__mapping-title">
                          Exact State + Emotion
                        </h4>
                        <p className="visual-asset-manager__mapping-copy">
                          이건 state-only, emotion-only보다 먼저 잡혀요. 진짜 전용 표정 카드예요...!
                        </p>
                        <div className="visual-asset-manager__pair-grid">
                          {EMOTION_PRESETS.map((emotionPreset) => {
                            if (emotionPreset.id === 'neutral') {
                              return null;
                            }

                            return (
                              <div
                                className="visual-asset-manager__pair-row"
                                key={emotionPreset.id}
                              >
                                <div className="visual-asset-manager__pair-label">
                                  {emotionPreset.label}
                                </div>

                                <div className="visual-asset-manager__chips">
                                  {STATE_PRESETS.map((statePreset) => {
                                    const inputId = `${pairMappingIdPrefix}-${statePreset.id}-${emotionPreset.id}`;

                                    return (
                                      <label
                                        className="visual-asset-manager__chip visual-asset-manager__chip--pair"
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
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
