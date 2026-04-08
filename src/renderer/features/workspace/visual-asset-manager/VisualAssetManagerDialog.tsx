import { useEffect, useState, type ReactElement } from "react";
import { ImagePlus, X } from "lucide-react";
import type { VisualAssetCatalog } from "../../../../shared/visual-assets";
import type {
  VisualEmotionPresetId,
  VisualStatePresetId,
} from "../../../../shared/visual-presets";
import type { AppThemeId, AppThemeOption } from "../../../../shared/theme";
import { EmotionDescriptionsSection } from "./EmotionDescriptionsSection";
import { EmotionSection } from "./EmotionSection";
import { GeneralSection } from "./GeneralSection";
import {
  getManagerTabClassName,
  managerActionButtonClassName,
  managerIconButtonClassName,
  managerIconClassName,
  managerSectionCopyClassName,
} from "./shared";
import { StatusLinesSection } from "./StatusLinesSection";
import { ThemeSection } from "./ThemeSection";

interface VisualAssetManagerDialogProps {
  availableThemes: AppThemeOption[];
  catalog: VisualAssetCatalog;
  currentThemeId: AppThemeId;
  isInstallingVisualMcp: boolean;
  mcpSetupError: string | null;
  mcpSetupInstalled: boolean;
  onClose: () => void;
  onDropFiles: (files: ReadonlyArray<File>) => void;
  onInstallVisualMcp: () => void;
  onPickFiles: () => void;
  onRemoveAsset: (assetId: string) => void;
  onSelectTheme: (themeId: AppThemeId) => void;
  onSetDefaultAsset: (assetId: string, isDefault: boolean) => void;
  onSetEmotionDescription: (
    emotion: VisualEmotionPresetId,
    description: string,
  ) => void;
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

type VisualAssetManagerTabId =
  | "general"
  | "theme"
  | "assets"
  | "messages"
  | "emotion-descriptions";

export function VisualAssetManagerDialog({
  availableThemes,
  catalog,
  currentThemeId,
  isInstallingVisualMcp,
  mcpSetupError,
  mcpSetupInstalled,
  onClose,
  onDropFiles,
  onInstallVisualMcp,
  onPickFiles,
  onRemoveAsset,
  onSelectTheme,
  onSetDefaultAsset,
  onSetEmotionDescription,
  onSetStateLine,
  onToggleEmotion,
  onToggleState,
  onToggleStateEmotion,
}: VisualAssetManagerDialogProps): ReactElement {
  const [activeTab, setActiveTab] =
    useState<VisualAssetManagerTabId>("general");

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
      className="fixed inset-0 z-20 flex items-center justify-center bg-surface-overlay p-6"
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
        className="flex max-h-[min(720px,100%)] w-[min(1080px,100%)] flex-col border border-border-muted bg-surface-dialog shadow-dialog"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-5 border-b border-border-soft px-5 py-[18px]">
          <div>
            <h2 className="m-0">Settings</h2>
            <p className={managerSectionCopyClassName}>
              테마, Visual MCP, 감정 에셋, 상태 텍스트, 감정 설명을 한 군데서
              만져요.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {activeTab === "assets" ? (
              <button
                className={managerActionButtonClassName}
                onClick={onPickFiles}
                type="button"
              >
                <ImagePlus
                  aria-hidden="true"
                  className={managerIconClassName}
                />
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
              aria-controls="visual-assets-panel"
              aria-selected={activeTab === "assets"}
              className={getManagerTabClassName(activeTab === "assets")}
              id="visual-assets-tab"
              onClick={() => {
                setActiveTab("assets");
              }}
              role="tab"
              type="button"
            >
              감정 에셋
            </button>
            <button
              aria-controls="situation-messages-panel"
              aria-selected={activeTab === "messages"}
              className={getManagerTabClassName(activeTab === "messages")}
              id="situation-messages-tab"
              onClick={() => {
                setActiveTab("messages");
              }}
              role="tab"
              type="button"
            >
              상태 텍스트
            </button>
            <button
              aria-controls="emotion-descriptions-panel"
              aria-selected={activeTab === "emotion-descriptions"}
              className={getManagerTabClassName(
                activeTab === "emotion-descriptions",
              )}
              id="emotion-descriptions-tab"
              onClick={() => {
                setActiveTab("emotion-descriptions");
              }}
              role="tab"
              type="button"
            >
              감정 설명
            </button>
          </div>

          <section
            aria-labelledby="general-settings-tab"
            hidden={activeTab !== "general"}
            id="general-settings-panel"
            role="tabpanel"
          >
            <GeneralSection
              isInstallingVisualMcp={isInstallingVisualMcp}
              mcpSetupError={mcpSetupError}
              mcpSetupInstalled={mcpSetupInstalled}
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
            aria-labelledby="visual-assets-tab"
            hidden={activeTab !== "assets"}
            id="visual-assets-panel"
            role="tabpanel"
          >
            <EmotionSection
              catalog={catalog}
              onDropFiles={onDropFiles}
              onRemoveAsset={onRemoveAsset}
              onSetDefaultAsset={onSetDefaultAsset}
              onToggleEmotion={onToggleEmotion}
              onToggleState={onToggleState}
              onToggleStateEmotion={onToggleStateEmotion}
            />
          </section>

          <section
            aria-labelledby="situation-messages-tab"
            hidden={activeTab !== "messages"}
            id="situation-messages-panel"
            role="tabpanel"
          >
            <StatusLinesSection
              catalog={catalog}
              onSetStateLine={onSetStateLine}
            />
          </section>

          <section
            aria-labelledby="emotion-descriptions-tab"
            hidden={activeTab !== "emotion-descriptions"}
            id="emotion-descriptions-panel"
            role="tabpanel"
          >
            <EmotionDescriptionsSection
              catalog={catalog}
              onSetEmotionDescription={onSetEmotionDescription}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
