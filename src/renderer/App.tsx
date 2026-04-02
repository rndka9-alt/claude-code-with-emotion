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
    assistantSnapshot,
    closeAssetManager,
    closeTab,
    createTab,
    handleLaunchClaude,
    isVisualAssetManagerOpen,
    openAssetManager,
    paneSizes,
    pickVisualAssets,
    removeAsset,
    reorderTab,
    resizePane,
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
    <div className="app-shell">
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

      <main className="workspace">
        <section
          aria-label="Active terminal workspace"
          className="workspace__terminal-area"
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
          onLaunchClaude={handleLaunchClaude}
          onOpenAssetManager={openAssetManager}
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
