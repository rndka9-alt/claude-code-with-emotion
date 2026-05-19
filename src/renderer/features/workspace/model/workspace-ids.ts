function createWorkspaceId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createPaneId(): string {
  return createWorkspaceId("pane");
}

export function createSessionId(): string {
  return createWorkspaceId("session");
}

export function createSplitId(): string {
  return createWorkspaceId("split");
}

export function createTabId(): string {
  return createWorkspaceId("tab");
}
