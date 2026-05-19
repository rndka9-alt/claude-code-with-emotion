export function createPaneId(paneNumber: number): string {
  return `pane-${paneNumber}`;
}

export function createSessionId(sessionNumber: number): string {
  return `session-${sessionNumber}`;
}

export function createSplitId(splitNumber: number): string {
  return `split-${splitNumber}`;
}

export function createTabId(tabNumber: number): string {
  return `tab-${tabNumber}`;
}
