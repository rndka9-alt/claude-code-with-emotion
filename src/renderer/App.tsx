import { Grip } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { PaneStack } from './features/workspace/PaneStack';
import { StatusPanel } from './features/workspace/StatusPanel';
import { TabBar } from './features/workspace/TabBar';
import { VisualAssetManagerDialog } from './features/workspace/VisualAssetManagerDialog';
import { useWorkspaceScreenViewModel } from './features/workspace/use-workspace-screen-view-model';

export function App(): ReactElement {
  const [isStatusPanelCollapsed, setIsStatusPanelCollapsed] = useState(false);
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
  const statusPanelToggleLabel = isStatusPanelCollapsed
    ? 'Expand assistant status panel'
    : 'Collapse assistant status panel';
  const statusPanelHandleClassName = [
    'absolute top-0 left-1/2 z-10 inline-flex h-6 w-12 -translate-x-1/2 -translate-y-px items-center justify-center border border-[var(--color-border-panel)] bg-[var(--color-surface-panel)] text-[var(--color-text-subtle)] transition-[background-color,border-color,color] duration-150 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text-highlight)]',
    isStatusPanelCollapsed
      ? 'rounded-[10px] shadow-[0_10px_24px_rgba(0,0,0,0.24)]'
      : 'rounded-t-[10px] border-b-0',
  ].join(' ');

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

      <main className="flex min-h-0 flex-1 flex-col px-2 pt-1 pb-2">
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

        <div className="relative flex flex-none flex-col pt-3">
          {isStatusPanelCollapsed ? null : (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-3 right-0 left-0 border-t border-[var(--color-border-panel)]"
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
          </div>
        </div>
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
