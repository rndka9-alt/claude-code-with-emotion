import { useEffect, useState, type ChangeEvent, type ReactElement } from 'react';
import { CircleHelp, ImagePlus, Wrench, Trash2, X } from 'lucide-react';
import type { VisualAssetCatalog } from '../../../shared/visual-assets';
import {
  EMOTION_PRESETS,
  STATE_PRESETS,
  type VisualEmotionPresetId,
  type VisualStatePresetId,
} from '../../../shared/visual-presets';
import {
  APP_THEME_PRESETS,
  isAppThemeId,
  type AppThemeId,
  type AppThemeOption,
} from '../../../shared/theme';
import { createStatusPanelAssetUrl } from './status-panel-visual';

interface VisualAssetManagerDialogProps {
  availableThemes: AppThemeOption[];
  catalog: VisualAssetCatalog;
  currentThemeId: AppThemeId;
  isInstallingVisualMcp: boolean;
  mcpSetupError: string | null;
  mcpSetupInstalled: boolean;
  onClose: () => void;
  onInstallVisualMcp: () => void;
  onPickFiles: () => void;
  onRemoveAsset: (assetId: string) => void;
  onSelectTheme: (themeId: AppThemeId) => void;
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

type VisualAssetManagerTabId = 'general' | 'theme' | 'assets' | 'messages';

const managerIconClassName = 'h-3.5 w-3.5';
const managerActionButtonClassName =
  'inline-flex items-center justify-center gap-2 border border-[var(--color-border-muted)] bg-[var(--color-surface-elevated)] px-2.5 py-2 text-[var(--color-text-strong)] transition-colors duration-150 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-highlight)]';
const managerIconButtonClassName =
  'inline-flex h-[34px] w-[34px] items-center justify-center border border-[var(--color-border-muted)] bg-[var(--color-surface-elevated)] text-[var(--color-text-strong)] transition-colors duration-150 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-highlight)]';
const managerSectionCopyClassName =
  'mt-1 text-xs text-[var(--color-text-subtle)]';
const managerChipClassName =
  'inline-flex items-center gap-2 border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] px-2.5 py-1.5 text-[var(--color-text-secondary)]';
const managerInputClassName =
  'w-full border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] px-3 py-2.5 text-[var(--color-text-tooltip)] outline-none transition-colors duration-150 focus:border-[var(--color-border-strong)]';

function getManagerTabClassName(isActive: boolean): string {
  return [
    'border px-[14px] py-[9px] transition-colors duration-150',
    isActive
      ? 'border-[var(--color-border-strong)] bg-[var(--color-surface-elevated-active)] text-[var(--color-text-primary)]'
      : 'border-[var(--color-border-soft)] bg-[var(--color-surface-elevated-muted)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text-highlight)]',
  ].join(' ');
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

function createStateLineDrafts(
  catalog: VisualAssetCatalog,
): Record<VisualStatePresetId, string> {
  const drafts: Record<VisualStatePresetId, string> = {
    disconnected: '',
    idle: '',
    thinking: '',
    working: '',
    responding: '',
    waiting: '',
    permission_wait: '',
    interrupted: '',
    completed: '',
    error: '',
    tool_failed: '',
  };

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
  availableThemes,
  catalog,
  currentThemeId,
  isInstallingVisualMcp,
  mcpSetupError,
  mcpSetupInstalled,
  onClose,
  onInstallVisualMcp,
  onPickFiles,
  onRemoveAsset,
  onSelectTheme,
  onSetDefaultAsset,
  onSetStateLine,
  onToggleEmotion,
  onToggleState,
  onToggleStateEmotion,
}: VisualAssetManagerDialogProps): ReactElement {
  const [activeTab, setActiveTab] = useState<VisualAssetManagerTabId>('general');
  const [stateLineDrafts, setStateLineDrafts] = useState<
    Record<VisualStatePresetId, string>
  >(() => createStateLineDrafts(catalog));

  useEffect(() => {
    setStateLineDrafts(createStateLineDrafts(catalog));
  }, [catalog]);

  return (
    <div
      aria-label="Settings overlay"
      className="fixed inset-0 flex items-center justify-center bg-[var(--color-surface-overlay)] p-6"
      role="presentation"
    >
      <div
        aria-label="Settings"
        aria-modal="true"
        className="flex max-h-[min(720px,100%)] w-[min(1080px,100%)] flex-col border border-[var(--color-border-muted)] bg-[var(--color-surface-dialog)] shadow-[var(--shadow-dialog)]"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-5 border-b border-[var(--color-border-soft)] px-5 py-[18px]">
          <div>
            <h2 className="m-0">Settings</h2>
            <p className={managerSectionCopyClassName}>
              테마, Visual MCP, 감정 에셋, 상태 텍스트를 한 군데서 만져요.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {activeTab === 'assets' ? (
              <button
                className={managerActionButtonClassName}
                onClick={onPickFiles}
                type="button"
              >
                <ImagePlus aria-hidden="true" className={managerIconClassName} />
                Add Images
              </button>
            ) : null}

            <button
              aria-label="Close settings"
              className={managerIconButtonClassName}
              onClick={onClose}
              type="button"
            >
              <X aria-hidden="true" className={managerIconClassName} />
            </button>
          </div>
        </header>

        <div className="overflow-auto px-5 pt-[18px] pb-5">
          <div
            aria-label="Settings sections"
            className="mb-[18px] flex gap-2"
            role="tablist"
          >
            <button
              aria-controls="general-settings-panel"
              aria-selected={activeTab === 'general'}
              className={getManagerTabClassName(activeTab === 'general')}
              id="general-settings-tab"
              onClick={() => {
                setActiveTab('general');
              }}
              role="tab"
              type="button"
            >
              일반
            </button>
            <button
              aria-controls="theme-settings-panel"
              aria-selected={activeTab === 'theme'}
              className={getManagerTabClassName(activeTab === 'theme')}
              id="theme-settings-tab"
              onClick={() => {
                setActiveTab('theme');
              }}
              role="tab"
              type="button"
            >
              테마
            </button>
            <button
              aria-controls="visual-assets-panel"
              aria-selected={activeTab === 'assets'}
              className={getManagerTabClassName(activeTab === 'assets')}
              id="visual-assets-tab"
              onClick={() => {
                setActiveTab('assets');
              }}
              role="tab"
              type="button"
            >
              감정 에셋
            </button>
            <button
              aria-controls="situation-messages-panel"
              aria-selected={activeTab === 'messages'}
              className={getManagerTabClassName(activeTab === 'messages')}
              id="situation-messages-tab"
              onClick={() => {
                setActiveTab('messages');
              }}
              role="tab"
              type="button"
            >
              상태 텍스트
            </button>
          </div>

          <section
            aria-labelledby="general-settings-tab"
            hidden={activeTab !== 'general'}
            id="general-settings-panel"
            role="tabpanel"
          >
            <section className="flex flex-col gap-3">
              <div>
                <h3 className="m-0">Visual MCP</h3>
                <p className={managerSectionCopyClassName}>
                  상태 오버레이랑 에셋 연동을 쓰려면 user-scope MCP 서버 설치가 필요해요.
                </p>
              </div>

              {mcpSetupInstalled ? (
                <div className="border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                  Visual MCP가 이미 설치대어 잇어요. 이쪽은 평화롭네요...!
                </div>
              ) : (
                <div className="flex flex-col items-start gap-3 border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] px-4 py-4">
                  <div className="flex items-start gap-2.5">
                    <Wrench
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-accent)]"
                    />
                    <p className="m-0 text-sm leading-6 text-[var(--color-text-secondary)]">
                      아직 설치 안 된 상태예요. 여기서 바로 설치하면 상태창 비주얼
                      연결이 살아나요.
                    </p>
                  </div>
                  <button
                    className="inline-flex h-[34px] items-center justify-center border border-[var(--color-border-launch)] bg-[var(--color-surface-launch)] px-3 text-sm font-semibold tracking-[0.01em] text-[var(--color-text-tooltip)] transition-colors duration-150 hover:bg-[var(--color-surface-launch-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isInstallingVisualMcp}
                    onClick={onInstallVisualMcp}
                    type="button"
                  >
                    {isInstallingVisualMcp ? '설치중...' : 'Visual MCP 설치'}
                  </button>
                  {mcpSetupError !== null ? (
                    <p className="m-0 text-sm leading-6 text-[#ffb4b4]">
                      {mcpSetupError}
                    </p>
                  ) : null}
                </div>
              )}
            </section>
          </section>

          <section
            aria-labelledby="theme-settings-tab"
            hidden={activeTab !== 'theme'}
            id="theme-settings-panel"
            role="tabpanel"
          >
            <section className="flex flex-col gap-3">
              <div>
                <h3 className="m-0">Theme Preset</h3>
                <p className={managerSectionCopyClassName}>
                  앱 프레임이랑 터미널 톤을 같이 바꿔요.
                </p>
              </div>

              <label className="flex max-w-[340px] flex-col gap-2 text-sm text-[var(--color-text-secondary)]">
                <span>테마 선택</span>
                <select
                  aria-label="App theme"
                  className="min-w-0 border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition-colors duration-150 focus:border-[var(--color-border-strong)]"
                  onChange={(event) => {
                    const nextThemeId = event.currentTarget.value;

                    if (isAppThemeId(nextThemeId)) {
                      onSelectTheme(nextThemeId);
                    }
                  }}
                  value={currentThemeId}
                >
                  {availableThemes.map((themeOption) => {
                    return (
                      <option key={themeOption.id} value={themeOption.id}>
                        {themeOption.label}
                      </option>
                    );
                  })}
                </select>
              </label>

              <div className="border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] px-4 py-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                {APP_THEME_PRESETS[currentThemeId].description}
              </div>
            </section>
          </section>

          <section
            aria-labelledby="visual-assets-tab"
            hidden={activeTab !== 'assets'}
            id="visual-assets-panel"
            role="tabpanel"
          >
            <div className="mb-4">
              <h3 className="m-0">Emotion Asset Mapping</h3>
              <p className={managerSectionCopyClassName}>
                상태 preset이 기본 축이고, 감정 preset은 선택적으로 얹혀요.
              </p>
            </div>
            {catalog.assets.length === 0 ? (
              <div className="mt-4 border border-dashed border-[var(--color-border-muted)] bg-[var(--color-surface-empty)] p-7 text-[var(--color-text-faint)]">
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
                      className="grid gap-4 border border-[var(--color-border-soft)] bg-[var(--color-surface-chip)] p-4 min-[901px]:grid-cols-[140px_minmax(0,1fr)]"
                      key={asset.id}
                    >
                      <div className="aspect-square w-[140px] overflow-hidden bg-[var(--color-surface-preview)]">
                        <img
                          alt={asset.label}
                          className="block h-full w-full object-cover"
                          src={createStatusPanelAssetUrl(asset.path)}
                        />
                      </div>

                      <div className="flex min-w-0 flex-col gap-[14px]">
                        <div className="flex items-start justify-between gap-2.5">
                          <div>
                            <h3 className="m-0">{asset.label}</h3>
                            <p className={managerSectionCopyClassName}>
                              {asset.path}
                            </p>
                          </div>

                          <div className="flex items-center gap-2.5">
                            <label className={managerChipClassName}>
                              <input
                                checked={asset.isDefault === true}
                                className="accent-[var(--color-terminal-blue)]"
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

                        <div className="flex flex-col gap-2">
                          <h4 className="m-0">
                            State Presets
                          </h4>
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
                                    className="accent-[var(--color-terminal-blue)]"
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
                          <h4 className="m-0">
                            Emotion Presets
                          </h4>
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
                                    className="accent-[var(--color-terminal-blue)]"
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
                          <h4 className="m-0">
                            Exact State + Emotion
                          </h4>
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
                                  <div className="pt-1.5 text-xs text-[var(--color-text-soft)]">
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
                                            className="accent-[var(--color-terminal-blue)]"
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
            hidden={activeTab !== 'messages'}
            id="situation-messages-panel"
            role="tabpanel"
          >
            <section className="flex flex-col gap-2">
              <h3 className="m-0">
                Status Text
              </h3>
              <p className={managerSectionCopyClassName}>
                상태별 기본 한 줄을 덮어써요. Claude가 직접 띄운 overlay 문구는 여전히 먼저 보여요.
              </p>
              <div className="grid gap-3 min-[901px]:grid-cols-2">
                {STATE_PRESETS.map((preset) => {
                  const inputId = `state-line-${preset.id}`;

                  return (
                    <div
                      className="flex flex-col gap-1.5"
                      key={preset.id}
                    >
                      <div className="flex items-center gap-1.5">
                        <label
                          className="text-xs font-semibold text-[var(--color-text-secondary)]"
                          htmlFor={inputId}
                        >
                          {preset.label}
                        </label>
                        <span className="group relative inline-flex items-center">
                          <button
                            aria-label={`${preset.label} 상태 설명 보기`}
                            className="inline-flex h-[18px] w-[18px] items-center justify-center bg-transparent text-[var(--color-text-accent)]"
                            type="button"
                          >
                            <CircleHelp
                              aria-hidden="true"
                              className={managerIconClassName}
                            />
                          </button>
                          <span
                            className="pointer-events-none absolute top-full left-1/2 z-[1] mt-2 block w-[220px] -translate-x-1/2 -translate-y-1 border border-[var(--color-tab-border)] bg-[var(--color-surface-tooltip)] px-3 py-2.5 text-xs leading-[1.45] text-[var(--color-text-tooltip)] opacity-0 shadow-[var(--shadow-tooltip)] transition-[opacity,transform] duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
                            role="tooltip"
                          >
                            {getSituationMessageDescription(preset.id)}
                          </span>
                        </span>
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
