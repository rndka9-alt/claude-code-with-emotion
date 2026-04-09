import { Grip } from "lucide-react";
import { useState, type ReactElement } from "react";
import { ToastProvider } from "./features/toast/ToastProvider";
import {
  PaneStack,
  StatusPanel,
  TabBar,
  VisualAssetManagerDialog,
  useWorkspaceScreenViewModel,
} from "./features/workspace";

export function App(): ReactElement {
  // ToastProvider 가 바깥에 둘러야 view-model 훅에서 useToast 를 쓸 수 있어요.
  // AppContent 를 분리해서 기존 테스트가 <App /> 만 렌더해도 토스트 컨텍스트가 같이 붙어요.
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

function AppContent(): ReactElement {
  const [isStatusPanelCollapsed, setIsStatusPanelCollapsed] = useState(false);
  const {
    activateTab,
    activeTabId,
    activeTab,
    availableThemes,
    assistantSnapshot,
    closePane,
    closeSettingsDialog,
    closeTab,
    currentThemeId,
    createTab,
    dismissNotification,
    dismissMcpSetupPrompt,
    dropVisualAssets,
    handleLaunchClaude,
    isMcpSetupPromptDismissed,
    isInstallingVisualMcp,
    isSettingsDialogOpen,
    installVisualMcp,
    mcpSetupError,
    mcpSetupStatus,
    notifiedTabIds,
    openSettingsDialog,
    pickVisualAssets,
    removeAsset,
    reorderTab,
    resizeSplit,
    sessions,
    setThemeId,
    setDefaultAsset,
    setEmotionDescription,
    setStateLine,
    statusLine,
    statusVisual,
    terminalFocusRequestKey,
    tabs,
    toggleEmotion,
    toggleState,
    toggleStateEmotion,
    focusPane,
    renameTab,
    syncSessionTitle,
    visualAssetCatalog,
  } = useWorkspaceScreenViewModel();
  const panelId = activeTabId.length > 0 ? `panel-${activeTabId}` : "panel-stack";
  const statusPanelToggleLabel = isStatusPanelCollapsed
    ? "Expand assistant status panel"
    : "Collapse assistant status panel";
  const statusPanelHandleClassName = [
    "absolute top-0 left-1/2 z-10 inline-flex h-6 w-12 -translate-x-1/2 -translate-y-px items-center justify-center border border-border-panel bg-surface-panel text-text-subtle transition-[background-color,border-color,color] duration-150 hover:border-border-strong hover:bg-surface-elevated hover:text-text-highlight",
    isStatusPanelCollapsed
      ? "rounded-[10px] shadow-[0_10px_24px_rgba(0,0,0,0.24)]"
      : "rounded-t-[10px] border-b-0",
  ].join(" ");

  return (
    <div className="flex h-full min-h-full flex-col overflow-hidden bg-app-bg">
      <TabBar
        activeTabId={activeTabId}
        notifiedTabIds={notifiedTabIds}
        onActivateTab={activateTab}
        onCloseTab={closeTab}
        onCreateTab={createTab}
        onDismissNotification={dismissNotification}
        onRenameTab={(tabId, title) => {
          renameTab(tabId, title);
        }}
        onReorderTab={reorderTab}
        tabs={tabs}
      />

      <main className="flex min-h-0 flex-1 flex-col px-2 pt-1 pb-2">
        <section
          aria-label="Active terminal workspace"
          className="flex min-h-0 flex-1 flex-col overflow-hidden border border-border-subtle bg-surface-terminal pt-1"
          id={panelId}
          role="tabpanel"
        >
          <PaneStack
            focusedPaneId={activeTab?.focusedPaneId ?? null}
            layout={activeTab?.layout ?? null}
            onClosePane={closePane}
            onFocusPane={focusPane}
            onResizeSplit={resizeSplit}
            onSyncSessionTitle={(sessionId, title) => {
              syncSessionTitle(sessionId, title);
            }}
            sessions={sessions}
            terminalFocusRequestKey={terminalFocusRequestKey}
          />
        </section>

        <div className="relative flex flex-none flex-col pt-3">
          {isStatusPanelCollapsed ? null : (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-3 right-0 left-0 border-t border-border-panel"
            />
          )}

          <button
            aria-controls="assistant-status-panel"
            aria-expanded={!isStatusPanelCollapsed}
            aria-label={statusPanelToggleLabel}
            className={statusPanelHandleClassName}
            onClick={() => {
              setIsStatusPanelCollapsed((currentValue) => !currentValue);
            }}
            type="button"
          >
            <Grip aria-hidden="true" className="h-3.5 w-3.5" />
          </button>

          <div hidden={isStatusPanelCollapsed} id="assistant-status-panel">
            <StatusPanel
              assistantStatus={assistantSnapshot}
              isInstallingVisualMcp={isInstallingVisualMcp}
              isMcpSetupPromptDismissed={isMcpSetupPromptDismissed}
              mcpSetupError={mcpSetupError}
              mcpSetupInstalled={mcpSetupStatus?.installed ?? true}
              onDismissMcpSetupPrompt={dismissMcpSetupPrompt}
              onInstallVisualMcp={installVisualMcp}
              onLaunchClaude={handleLaunchClaude}
              onOpenSettings={openSettingsDialog}
              statusLine={statusLine}
              statusVisual={statusVisual}
            />
          </div>
        </div>
      </main>

      {isSettingsDialogOpen ? (
        <VisualAssetManagerDialog
          availableThemes={availableThemes}
          catalog={visualAssetCatalog}
          currentThemeId={currentThemeId}
          isInstallingVisualMcp={isInstallingVisualMcp}
          mcpSetupError={mcpSetupError}
          mcpSetupInstalled={mcpSetupStatus?.installed ?? true}
          onClose={closeSettingsDialog}
          onDropFiles={dropVisualAssets}
          onInstallVisualMcp={installVisualMcp}
          onPickFiles={pickVisualAssets}
          onRemoveAsset={removeAsset}
          onSelectTheme={setThemeId}
          onSetDefaultAsset={setDefaultAsset}
          onSetEmotionDescription={setEmotionDescription}
          onSetStateLine={setStateLine}
          onToggleEmotion={toggleEmotion}
          onToggleState={toggleState}
          onToggleStateEmotion={toggleStateEmotion}
        />
      ) : null}
    </div>
  );
}
