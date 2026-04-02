import type { ReactElement } from 'react';
import { PaneStack } from './features/workspace/PaneStack';
import { StatusPanel } from './features/workspace/StatusPanel';
import { TabBar } from './features/workspace/TabBar';
import { VisualAssetManagerDialog } from './features/workspace/VisualAssetManagerDialog';
import { useWorkspaceScreenViewModel } from './features/workspace/use-workspace-screen-view-model';

export function App(): ReactElement {
  const {
    activateTab,
    activeTabId,
    availableThemes,
    assistantSnapshot,
    closeAssetManager,
    closeTab,
    currentThemeId,
    createTab,
    handleLaunchClaude,
    isVisualAssetManagerOpen,
    isInstallingVisualMcp,
    installVisualMcp,
    mcpSetupError,
    mcpSetupStatus,
    openAssetManager,
    paneSizes,
    pickVisualAssets,
    removeAsset,
    reorderTab,
    resizePane,
    setThemeId,
    setDefaultAsset,
    setStateLine,
    statusLine,
    statusVisual,
    terminalFocusRequestKey,
    tabs,
    toggleEmotion,
    toggleState,
    toggleStateEmotion,
    updateTabTitle,
    visualAssetCatalog,
    visibleTabs,
  } = useWorkspaceScreenViewModel();
  const panelId = visibleTabs[0] !== undefined ? `panel-${visibleTabs[0].id}` : 'panel-stack';

  return (
    <div className="flex h-full min-h-full flex-col overflow-hidden bg-[var(--color-app-bg)]">
      <TabBar
        activeTabId={activeTabId}
        onActivateTab={activateTab}
        onCloseTab={closeTab}
        onCreateTab={createTab}
        onRenameTab={(tabId, title) => {
          updateTabTitle(tabId, title, 'manual');
        }}
        onReorderTab={reorderTab}
        tabs={tabs}
      />

      <main className="flex min-h-0 flex-1 flex-col gap-2 px-2 pt-1 pb-2">
        <section
          aria-label="Active terminal workspace"
          className="flex min-h-0 flex-1 flex-col overflow-hidden border border-[var(--color-border-subtle)] bg-[var(--color-surface-terminal)] pt-1"
          id={panelId}
          role="tabpanel"
        >
          <PaneStack
            onResizePane={resizePane}
            paneSizes={paneSizes}
            onSyncTabTitle={(tabId, title) => {
              updateTabTitle(tabId, title, 'terminal');
            }}
            terminalFocusRequestKey={terminalFocusRequestKey}
            tabs={visibleTabs}
          />
        </section>

        <StatusPanel
          assistantStatus={assistantSnapshot}
          currentThemeId={currentThemeId}
          availableThemes={availableThemes}
          isInstallingVisualMcp={isInstallingVisualMcp}
          mcpSetupError={mcpSetupError}
          mcpSetupInstalled={mcpSetupStatus?.installed ?? true}
          onInstallVisualMcp={installVisualMcp}
          onLaunchClaude={handleLaunchClaude}
          onOpenAssetManager={openAssetManager}
          onSelectTheme={setThemeId}
          statusLine={statusLine}
          statusVisual={statusVisual}
        />
      </main>

      {isVisualAssetManagerOpen ? (
        <VisualAssetManagerDialog
          catalog={visualAssetCatalog}
          onClose={closeAssetManager}
          onPickFiles={pickVisualAssets}
          onRemoveAsset={removeAsset}
          onSetDefaultAsset={setDefaultAsset}
          onSetStateLine={setStateLine}
          onToggleEmotion={toggleEmotion}
          onToggleState={toggleState}
          onToggleStateEmotion={toggleStateEmotion}
        />
      ) : null}
    </div>
  );
}
