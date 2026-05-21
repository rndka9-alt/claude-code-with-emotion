import { useEffect, useState, type ReactElement } from "react";
import { X } from "lucide-react";
import {
  BASE_VISUAL_ASSET_PROVIDER_ID,
  getVisualAssetProviderOverride,
  getVisualAssetProviderStateMetadata,
  VISUAL_ASSET_PROVIDER_OPTIONS,
  type VisualAssetCatalog,
  type VisualAssetProviderId,
} from "../../../../shared/visual-assets";
import type {
  VisualMcpSetupOverview,
  VisualMcpSetupTargetId,
} from "../../../../shared/mcp-setup-bridge";
import {
  STATE_PRESETS,
  type VisualEmotionPresetId,
  type VisualStatePresetId,
} from "../../../../shared/visual-presets";
import type { AppThemeId, AppThemeOption } from "../../../../shared/theme";
import {
  EmotionDescriptionsSection,
  EmotionSection,
  GeneralSection,
  StatusLinesSection,
  ThemeSection,
} from "./_components";
import {
  getManagerTabClassName,
  managerIconButtonClassName,
  managerIconClassName,
  managerInputClassName,
  managerSectionCopyClassName,
} from "./_utils";

interface VisualAssetManagerDialogProps {
  availableThemes: AppThemeOption[];
  catalog: VisualAssetCatalog;
  currentThemeId: AppThemeId;
  installingVisualMcpTargetId: VisualMcpSetupTargetId | null;
  mcpSetupErrorsByTargetId: Partial<Record<VisualMcpSetupTargetId, string>>;
  mcpSetupStatus: VisualMcpSetupOverview | null;
  onClose: () => void;
  onDropFiles: (
    files: ReadonlyArray<File>,
    providerId: VisualAssetProviderId,
  ) => void;
  onInstallVisualMcp: (targetId?: VisualMcpSetupTargetId) => void;
  onPickFiles: (providerId: VisualAssetProviderId) => void;
  onRemoveAsset: (assetId: string) => void;
  onSelectTheme: (themeId: AppThemeId) => void;
  onSetDefaultAsset: (
    assetId: string,
    isDefault: boolean,
    providerId: VisualAssetProviderId,
  ) => void;
  onSetEmotionDescription: (
    emotion: VisualEmotionPresetId,
    description: string,
    providerId: VisualAssetProviderId,
  ) => void;
  onSetProviderFallback: (
    providerId: VisualAssetProviderId,
    useBaseProviderWhenMissing: boolean,
  ) => void;
  onSetStateLine: (
    state: VisualStatePresetId,
    line: string,
    providerId: VisualAssetProviderId,
  ) => void;
  onToggleEmotion: (
    assetId: string,
    emotion: VisualEmotionPresetId,
    isEnabled: boolean,
    providerId: VisualAssetProviderId,
  ) => void;
  onToggleState: (
    assetId: string,
    state: VisualStatePresetId,
    isEnabled: boolean,
    providerId: VisualAssetProviderId,
  ) => void;
  onToggleStateEmotion: (
    assetId: string,
    state: VisualStatePresetId,
    emotion: VisualEmotionPresetId,
    isEnabled: boolean,
    providerId: VisualAssetProviderId,
  ) => void;
}

type VisualAssetManagerTabId =
  | "general"
  | "theme"
  | "status-panel";

type StatusPanelSettingsTabId =
  | "assets"
  | "messages"
  | "emotion-descriptions";

export function VisualAssetManagerDialog({
  availableThemes,
  catalog,
  currentThemeId,
  installingVisualMcpTargetId,
  mcpSetupErrorsByTargetId,
  mcpSetupStatus,
  onClose,
  onDropFiles,
  onInstallVisualMcp,
  onPickFiles,
  onRemoveAsset,
  onSelectTheme,
  onSetDefaultAsset,
  onSetEmotionDescription,
  onSetProviderFallback,
  onSetStateLine,
  onToggleEmotion,
  onToggleState,
  onToggleStateEmotion,
}: VisualAssetManagerDialogProps): ReactElement {
  const [activeTab, setActiveTab] =
    useState<VisualAssetManagerTabId>("general");
  const [activeStatusPanelTab, setActiveStatusPanelTab] =
    useState<StatusPanelSettingsTabId>("assets");
  const [activeProviderId, setActiveProviderId] =
    useState<VisualAssetProviderId>(BASE_VISUAL_ASSET_PROVIDER_ID);
  const activeProviderOverride = getVisualAssetProviderOverride(
    catalog,
    activeProviderId,
  );
  const activeStateMetadata =
    getVisualAssetProviderStateMetadata(activeProviderId);
  const activeStateIds = new Set(
    activeStateMetadata.map((metadata) => metadata.state),
  );
  const activeStatePresets = STATE_PRESETS.filter((preset) => {
    return activeStateIds.has(preset.id);
  });

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleWindowKeyDown);

    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [onClose]);

  return (
    <div
      aria-label="Settings overlay"
      className="bg-surface-overlay fixed inset-0 z-20 flex items-center justify-center p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        aria-label="Settings"
        aria-modal="true"
        className="border-border-muted bg-surface-dialog shadow-dialog flex max-h-[min(720px,100%)] w-[min(1080px,100%)] flex-col border"
        role="dialog"
      >
        <header className="border-border-soft flex items-start justify-between gap-5 border-b px-5 py-[18px]">
          <div>
            <h2 className="m-0">Settings</h2>
            <p className={managerSectionCopyClassName}>
              테마, Visual MCP, 상태창 에셋과 문구를 한 군데서 만져요.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
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
              aria-selected={activeTab === "general"}
              className={getManagerTabClassName(activeTab === "general")}
              id="general-settings-tab"
              onClick={() => {
                setActiveTab("general");
              }}
              role="tab"
              type="button"
            >
              일반
            </button>
            <button
              aria-controls="theme-settings-panel"
              aria-selected={activeTab === "theme"}
              className={getManagerTabClassName(activeTab === "theme")}
              id="theme-settings-tab"
              onClick={() => {
                setActiveTab("theme");
              }}
              role="tab"
              type="button"
            >
              테마
            </button>
            <button
              aria-controls="status-panel-settings-panel"
              aria-selected={activeTab === "status-panel"}
              className={getManagerTabClassName(activeTab === "status-panel")}
              id="status-panel-settings-tab"
              onClick={() => {
                setActiveTab("status-panel");
              }}
              role="tab"
              type="button"
            >
              상태창
            </button>
          </div>

          <section
            aria-labelledby="general-settings-tab"
            hidden={activeTab !== "general"}
            id="general-settings-panel"
            role="tabpanel"
          >
            <GeneralSection
              installingVisualMcpTargetId={installingVisualMcpTargetId}
              mcpSetupErrorsByTargetId={mcpSetupErrorsByTargetId}
              mcpSetupStatus={mcpSetupStatus}
              onInstallVisualMcp={onInstallVisualMcp}
            />
          </section>

          <section
            aria-labelledby="theme-settings-tab"
            hidden={activeTab !== "theme"}
            id="theme-settings-panel"
            role="tabpanel"
          >
            <ThemeSection
              availableThemes={availableThemes}
              currentThemeId={currentThemeId}
              onSelectTheme={onSelectTheme}
            />
          </section>

          <section
            aria-labelledby="status-panel-settings-tab"
            hidden={activeTab !== "status-panel"}
            id="status-panel-settings-panel"
            role="tabpanel"
          >
            <div className="flex flex-col gap-4">
              <div className="border-border-soft flex flex-col gap-2 border-b pb-4">
                <label
                  className="text-text-secondary text-xs font-semibold"
                  htmlFor="status-panel-provider"
                >
                  Provider
                </label>
                <select
                  aria-label="상태창 provider"
                  className={managerInputClassName}
                  onChange={(event) => {
                    const nextProviderId =
                      event.currentTarget.value === "codex"
                        ? "codex"
                        : BASE_VISUAL_ASSET_PROVIDER_ID;
                    setActiveProviderId(nextProviderId);
                  }}
                  value={activeProviderId}
                  id="status-panel-provider"
                >
                  {VISUAL_ASSET_PROVIDER_OPTIONS.map((option) => {
                    return (
                      <option key={option.id} value={option.id}>
                        {option.label}
                        {option.isBase ? " (default)" : ""}
                      </option>
                    );
                  })}
                </select>
                {activeProviderId !== BASE_VISUAL_ASSET_PROVIDER_ID ? (
                  <label className="text-text-secondary flex items-center gap-2 text-xs">
                    <input
                      checked={
                        activeProviderOverride.useBaseProviderWhenMissing !==
                        false
                      }
                      className="accent-terminal-blue"
                      onChange={(event) => {
                        onSetProviderFallback(
                          activeProviderId,
                          event.currentTarget.checked,
                        );
                      }}
                      type="checkbox"
                    />
                    없으면 Claude Code 사용
                  </label>
                ) : null}
              </div>

              <div
                aria-label="상태창 설정"
                className="flex gap-2"
                role="tablist"
              >
                <button
                  aria-controls="status-panel-assets-panel"
                  aria-selected={activeStatusPanelTab === "assets"}
                  className={getManagerTabClassName(
                    activeStatusPanelTab === "assets",
                  )}
                  id="status-panel-assets-tab"
                  onClick={() => {
                    setActiveStatusPanelTab("assets");
                  }}
                  role="tab"
                  type="button"
                >
                  에셋
                </button>
                <button
                  aria-controls="status-panel-messages-panel"
                  aria-selected={activeStatusPanelTab === "messages"}
                  className={getManagerTabClassName(
                    activeStatusPanelTab === "messages",
                  )}
                  id="status-panel-messages-tab"
                  onClick={() => {
                    setActiveStatusPanelTab("messages");
                  }}
                  role="tab"
                  type="button"
                >
                  상태 텍스트
                </button>
                <button
                  aria-controls="status-panel-emotion-descriptions-panel"
                  aria-selected={
                    activeStatusPanelTab === "emotion-descriptions"
                  }
                  className={getManagerTabClassName(
                    activeStatusPanelTab === "emotion-descriptions",
                  )}
                  id="status-panel-emotion-descriptions-tab"
                  onClick={() => {
                    setActiveStatusPanelTab("emotion-descriptions");
                  }}
                  role="tab"
                  type="button"
                >
                  감정 설명
                </button>
              </div>

              <section
                aria-labelledby="status-panel-assets-tab"
                hidden={activeStatusPanelTab !== "assets"}
                id="status-panel-assets-panel"
                role="tabpanel"
              >
                <EmotionSection
                  catalog={catalog}
                  onDropFiles={(files) => {
                    onDropFiles(files, activeProviderId);
                  }}
                  onPickFiles={() => {
                    onPickFiles(activeProviderId);
                  }}
                  onRemoveAsset={onRemoveAsset}
                  onSetDefaultAsset={(assetId, isDefault) => {
                    onSetDefaultAsset(assetId, isDefault, activeProviderId);
                  }}
                  onToggleEmotion={(assetId, emotion, isEnabled) => {
                    onToggleEmotion(
                      assetId,
                      emotion,
                      isEnabled,
                      activeProviderId,
                    );
                  }}
                  onToggleState={(assetId, state, isEnabled) => {
                    onToggleState(assetId, state, isEnabled, activeProviderId);
                  }}
                  onToggleStateEmotion={(
                    assetId,
                    state,
                    emotion,
                    isEnabled,
                  ) => {
                    onToggleStateEmotion(
                      assetId,
                      state,
                      emotion,
                      isEnabled,
                      activeProviderId,
                    );
                  }}
                  providerId={activeProviderId}
                  statePresets={activeStatePresets}
                />
              </section>

              <section
                aria-labelledby="status-panel-messages-tab"
                hidden={activeStatusPanelTab !== "messages"}
                id="status-panel-messages-panel"
                role="tabpanel"
              >
                <StatusLinesSection
                  catalog={catalog}
                  onSetStateLine={(state, line) => {
                    onSetStateLine(state, line, activeProviderId);
                  }}
                  providerId={activeProviderId}
                  stateMetadata={activeStateMetadata}
                />
              </section>

              <section
                aria-labelledby="status-panel-emotion-descriptions-tab"
                hidden={activeStatusPanelTab !== "emotion-descriptions"}
                id="status-panel-emotion-descriptions-panel"
                role="tabpanel"
              >
                <EmotionDescriptionsSection
                  catalog={catalog}
                  onSetEmotionDescription={(emotion, description) => {
                    onSetEmotionDescription(
                      emotion,
                      description,
                      activeProviderId,
                    );
                  }}
                  providerId={activeProviderId}
                />
              </section>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
