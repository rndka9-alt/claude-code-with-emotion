import { useEffect, useState, type ChangeEvent, type ReactElement } from 'react';
import { CircleHelp, ImagePlus, Trash2, X } from 'lucide-react';
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
  onSetStateLine: (state: VisualStatePresetId, line: string) => void;
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

type VisualAssetManagerTabId = 'assets' | 'messages';

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

function createStateLineDrafts(
  catalog: VisualAssetCatalog,
): Record<VisualStatePresetId, string> {
  const drafts = {} as Record<VisualStatePresetId, string>;

  for (const preset of STATE_PRESETS) {
    drafts[preset.id] =
      catalog.stateLines.find((mapping) => mapping.state === preset.id)?.line ?? '';
  }

  return drafts;
}

function getSituationMessageDescription(state: VisualStatePresetId): string {
  if (state === 'disconnected') {
    return 'Claude 세션이 아직 연결되지 않은 상태예요.';
  }

  if (state === 'idle') {
    return '연결은 되어 있지만, 눈에 띄는 작업은 없는 쉬는 구간이에요.';
  }

  if (state === 'thinking') {
    return '질문을 읽거나 다음 행동을 정리하면서 흐름을 잡는 상태예요.';
  }

  if (state === 'working') {
    return '툴을 쓰거나 파일을 수정하면서 실제 작업을 진행 중인 상태예요.';
  }

  if (state === 'responding') {
    return '쭈인님에게 답변을 작성하거나 스트리밍해서 보내는 상태예요.';
  }

  if (state === 'waiting') {
    return '작업이 잠시 멈춰 있고 다음 입력이나 이벤트를 기다리는 상태예요.';
  }

  if (state === 'permission_wait') {
    return '권한 허용이 필요해서 다음 툴 작업으로 못 넘어가고 멈춘 상태예요.';
  }

  if (state === 'interrupted') {
    return '현재 턴 작업이 중간에 끊긴 상태예요.';
  }

  if (state === 'completed') {
    return '작업이 끝나고 마무리된 상태예요.';
  }

  if (state === 'tool_failed') {
    return '세션은 살아 있지만 특정 툴 시도가 실패한 상태예요.';
  }

  return '오류가 발생해서 정상 흐름에서 벗어난 상태예요.';
}

function getSituationMessagePlaceholder(state: VisualStatePresetId): string {
  if (state === 'disconnected') {
    return 'Claude 아직 미연결이에요. 준비되면 바로 붙을게요...!';
  }

  if (state === 'idle') {
    return '잠깐 숨 고르는 중이에요...!';
  }

  if (state === 'thinking') {
    return '질문 읽고 흐름 잡는 중이에요...!';
  }

  if (state === 'working') {
    return '손 움직이는 중이에요. 파일이랑 로그를 뒤져보는 중...!';
  }

  if (state === 'responding') {
    return '답변 정리해서 보내는 중이에요...!';
  }

  if (state === 'waiting') {
    return '다음 입력이나 신호를 기다리는 중이에요.';
  }

  if (state === 'permission_wait') {
    return '권한 허용이 필요해서 여기서 잠깐 멈췃어요.';
  }

  if (state === 'interrupted') {
    return '작업이 중간에 멈췃어요. 흐름 다시 잡아볼게요.';
  }

  if (state === 'completed') {
    return '작업 마무리 완료예요...!';
  }

  if (state === 'tool_failed') {
    return '툴이 한번 삐끗햇어요. 원인 다시 볼게요.';
  }

  return '오류가 나서 상태를 점검하는 중이에요.';
}

export function VisualAssetManagerDialog({
  catalog,
  onClose,
  onPickFiles,
  onRemoveAsset,
  onSetDefaultAsset,
  onSetStateLine,
  onToggleEmotion,
  onToggleState,
  onToggleStateEmotion,
}: VisualAssetManagerDialogProps): ReactElement {
  const [activeTab, setActiveTab] = useState<VisualAssetManagerTabId>('assets');
  const [stateLineDrafts, setStateLineDrafts] = useState<
    Record<VisualStatePresetId, string>
  >(() => createStateLineDrafts(catalog));

  useEffect(() => {
    setStateLineDrafts(createStateLineDrafts(catalog));
  }, [catalog]);

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
            {activeTab === 'assets' ? (
              <button
                className="visual-asset-manager__add-button"
                onClick={onPickFiles}
                type="button"
              >
                <ImagePlus aria-hidden="true" className="visual-asset-manager__icon" />
                Add Images
              </button>
            ) : null}

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
          <div
            aria-label="Visual asset manager sections"
            className="visual-asset-manager__tabs"
            role="tablist"
          >
            <button
              aria-controls="visual-assets-panel"
              aria-selected={activeTab === 'assets'}
              className="visual-asset-manager__tab"
              id="visual-assets-tab"
              onClick={() => {
                setActiveTab('assets');
              }}
              role="tab"
              type="button"
            >
              이미지 에셋
            </button>
            <button
              aria-controls="situation-messages-panel"
              aria-selected={activeTab === 'messages'}
              className="visual-asset-manager__tab"
              id="situation-messages-tab"
              onClick={() => {
                setActiveTab('messages');
              }}
              role="tab"
              type="button"
            >
              상태 메시지
            </button>
          </div>

          <section
            aria-labelledby="visual-assets-tab"
            className="visual-asset-manager__panel"
            hidden={activeTab !== 'assets'}
            id="visual-assets-panel"
            role="tabpanel"
          >
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
          </section>

          <section
            aria-labelledby="situation-messages-tab"
            className="visual-asset-manager__panel"
            hidden={activeTab !== 'messages'}
            id="situation-messages-panel"
            role="tabpanel"
          >
            <section className="visual-asset-manager__mapping-group">
              <h3 className="visual-asset-manager__mapping-title">
                Situation Messages
              </h3>
              <p className="visual-asset-manager__mapping-copy">
                상태별 기본 한 줄을 덮어써요. Claude가 직접 띄운 overlay 문구는 여전히 먼저 보여요.
              </p>
              <div className="visual-asset-manager__message-grid">
                {STATE_PRESETS.map((preset) => {
                  const inputId = `state-line-${preset.id}`;

                  return (
                    <div
                      className="visual-asset-manager__message-field"
                      key={preset.id}
                    >
                      <div className="visual-asset-manager__message-heading">
                        <label
                          className="visual-asset-manager__message-label"
                          htmlFor={inputId}
                        >
                          {preset.label}
                        </label>
                        <span className="visual-asset-manager__tooltip">
                          <button
                            aria-label={`${preset.label} 상태 설명 보기`}
                            className="visual-asset-manager__tooltip-button"
                            type="button"
                          >
                            <CircleHelp
                              aria-hidden="true"
                              className="visual-asset-manager__icon"
                            />
                          </button>
                          <span
                            className="visual-asset-manager__tooltip-bubble"
                            role="tooltip"
                          >
                            {getSituationMessageDescription(preset.id)}
                          </span>
                        </span>
                      </div>
                      <input
                        className="visual-asset-manager__message-input"
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
                          if (event.key === 'Enter') {
                            event.currentTarget.blur();
                          }
                        }}
                        placeholder={getSituationMessagePlaceholder(preset.id)}
                        type="text"
                        value={stateLineDrafts[preset.id]}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          </section>
        </div>
      </div>
    </div>
  );
}
