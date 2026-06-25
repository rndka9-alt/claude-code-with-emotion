import fs from "node:fs";
import { ENV_KEYS } from "../../shared/env-keys";

// visual MCP 헬퍼가 의존하는 런타임 컨텍스트. env 가 1순위이고,
// env 가 비어 있을 때 state 파일(VISUAL_MCP_STATE_FILE)로 폴백한다.
interface VisualMcpRuntime {
  assistantProviderId: string;
  eventQueueDir: string;
  traceFilePath: string;
  visualAssetCatalogFilePath: string;
}

type RuntimeSource = "env" | "state" | "missing";

interface VisualMcpRuntimeSources {
  assistantProviderIdSource: RuntimeSource;
  eventQueueDirSource: RuntimeSource;
  stateFilePath: string;
  traceFilePathSource: RuntimeSource;
  visualAssetCatalogFilePathSource: RuntimeSource;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStringMember(
  state: Record<string, unknown> | null,
  key: string,
): string | null {
  if (state === null) {
    return null;
  }

  const value = state[key];

  return typeof value === "string" ? value : null;
}

function readStateFilePath(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const stateFilePath = env[ENV_KEYS.VISUAL_MCP_STATE_FILE];

  if (typeof stateFilePath === "string" && stateFilePath.length > 0) {
    return stateFilePath;
  }

  return null;
}

export function readVisualMcpState(
  env: NodeJS.ProcessEnv = process.env,
): Record<string, unknown> | null {
  const stateFilePath = readStateFilePath(env);

  if (stateFilePath === null) {
    return null;
  }

  try {
    const fileContents = fs.readFileSync(stateFilePath, "utf8").trim();

    if (fileContents.length === 0) {
      return null;
    }

    const parsed: unknown = JSON.parse(fileContents);

    if (isRecord(parsed)) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

export function resolveVisualMcpRuntime(
  env: NodeJS.ProcessEnv = process.env,
): VisualMcpRuntime {
  const state = readVisualMcpState(env);
  const traceFilePath =
    env[ENV_KEYS.TRACE_FILE] || readStringMember(state, "traceFilePath") || "";
  const visualAssetCatalogFilePath =
    env[ENV_KEYS.VISUAL_ASSET_CATALOG_FILE] ||
    readStringMember(state, "visualAssetCatalogFilePath") ||
    "";
  const eventQueueDirValue = env[ENV_KEYS.EVENT_QUEUE_DIR];
  const eventQueueDir =
    typeof eventQueueDirValue === "string" ? eventQueueDirValue : "";
  const assistantProviderId =
    env[ENV_KEYS.ASSISTANT_PROVIDER_ID] ||
    readStringMember(state, "assistantProviderId") ||
    "";

  return {
    assistantProviderId,
    traceFilePath,
    visualAssetCatalogFilePath,
    eventQueueDir,
  };
}

export function describeVisualMcpRuntimeSources(
  env: NodeJS.ProcessEnv = process.env,
): VisualMcpRuntimeSources {
  const stateFilePath = readStateFilePath(env);
  const state = readVisualMcpState(env);

  return {
    assistantProviderIdSource:
      typeof env[ENV_KEYS.ASSISTANT_PROVIDER_ID] === "string"
        ? "env"
        : typeof readStringMember(state, "assistantProviderId") === "string"
          ? "state"
          : "missing",
    eventQueueDirSource:
      typeof env[ENV_KEYS.EVENT_QUEUE_DIR] === "string" ? "env" : "missing",
    stateFilePath: stateFilePath ?? "",
    traceFilePathSource:
      typeof env[ENV_KEYS.TRACE_FILE] === "string"
        ? "env"
        : typeof readStringMember(state, "traceFilePath") === "string"
          ? "state"
          : "missing",
    visualAssetCatalogFilePathSource:
      typeof env[ENV_KEYS.VISUAL_ASSET_CATALOG_FILE] === "string"
        ? "env"
        : typeof readStringMember(state, "visualAssetCatalogFilePath") ===
            "string"
          ? "state"
          : "missing",
  };
}

export function createVisualMcpChildEnv(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const runtime = resolveVisualMcpRuntime(env);

  return {
    ...env,
    ...(runtime.traceFilePath.length > 0
      ? { [ENV_KEYS.TRACE_FILE]: runtime.traceFilePath }
      : {}),
    ...(runtime.visualAssetCatalogFilePath.length > 0
      ? { [ENV_KEYS.VISUAL_ASSET_CATALOG_FILE]: runtime.visualAssetCatalogFilePath }
      : {}),
    ...(runtime.eventQueueDir.length > 0
      ? { [ENV_KEYS.EVENT_QUEUE_DIR]: runtime.eventQueueDir }
      : {}),
    ...(runtime.assistantProviderId.length > 0
      ? { [ENV_KEYS.ASSISTANT_PROVIDER_ID]: runtime.assistantProviderId }
      : {}),
  };
}
