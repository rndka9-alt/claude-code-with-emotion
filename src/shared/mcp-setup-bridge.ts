export type VisualMcpSetupTargetId = "claude" | "codex";

export interface VisualMcpSetupTargetStatus {
  displayName: string;
  installed: boolean;
  stateFilePath: string;
  targetId: VisualMcpSetupTargetId;
}

export type VisualMcpSetupTargetsStatus = Record<
  VisualMcpSetupTargetId,
  VisualMcpSetupTargetStatus
>;

export interface VisualMcpSetupStatus {
  installed: boolean;
  stateFilePath: string;
}

export interface VisualMcpSetupOverview extends VisualMcpSetupStatus {
  targets: VisualMcpSetupTargetsStatus;
}

export interface VisualMcpSetupRequest {
  targetId?: VisualMcpSetupTargetId;
}

export interface VisualMcpSetupBridge {
  getStatus: () => Promise<VisualMcpSetupOverview>;
  install: (request?: VisualMcpSetupRequest) => Promise<VisualMcpSetupOverview>;
  remove: (request?: VisualMcpSetupRequest) => Promise<VisualMcpSetupOverview>;
}

export const MCP_SETUP_CHANNELS = {
  getStatus: "mcp-setup:get-status",
  install: "mcp-setup:install",
  remove: "mcp-setup:remove",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseVisualMcpSetupTargetId(value: unknown): VisualMcpSetupTargetId {
  if (value === "claude" || value === "codex") {
    return value;
  }

  throw new Error("Visual MCP setup target must be claude or codex.");
}

export function parseVisualMcpSetupRequest(
  value: unknown,
): VisualMcpSetupRequest {
  if (value === undefined) {
    return {};
  }

  if (!isRecord(value)) {
    throw new Error("Visual MCP setup request must be an object.");
  }

  if (value.targetId === undefined) {
    return {};
  }

  return {
    targetId: parseVisualMcpSetupTargetId(value.targetId),
  };
}
