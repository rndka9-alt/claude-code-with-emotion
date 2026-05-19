import { parseWorkspaceState, type WorkspaceState } from "./workspace-state";

export const WORKSPACE_WINDOW_CHANNELS: {
  openDetached: string;
} = {
  openDetached: "workspace-window:open-detached",
};

export interface OpenDetachedWorkspaceWindowRequest {
  initialWorkspaceState: WorkspaceState;
}

export interface WorkspaceWindowBridge {
  openDetachedWorkspaceWindow: (
    request: OpenDetachedWorkspaceWindowRequest,
  ) => Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseOpenDetachedWorkspaceWindowRequest(
  value: unknown,
): OpenDetachedWorkspaceWindowRequest {
  if (!isRecord(value)) {
    throw new Error("Detached workspace window request must be an object.");
  }

  return {
    initialWorkspaceState: parseWorkspaceState(value.initialWorkspaceState),
  };
}
