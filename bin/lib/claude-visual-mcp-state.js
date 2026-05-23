const fs = require("node:fs");

function readStateFilePath(env = process.env) {
  const stateFilePath = env.CLAUDE_WITH_EMOTION_VISUAL_MCP_STATE_FILE;

  if (typeof stateFilePath === "string" && stateFilePath.length > 0) {
    return stateFilePath;
  }

  return null;
}

function readVisualMcpState(env = process.env) {
  const stateFilePath = readStateFilePath(env);

  if (stateFilePath === null) {
    return null;
  }

  try {
    const fileContents = fs.readFileSync(stateFilePath, "utf8").trim();

    if (fileContents.length === 0) {
      return null;
    }

    const parsed = JSON.parse(fileContents);

    if (typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function resolveVisualMcpRuntime(env = process.env) {
  const state = readVisualMcpState(env);
  const traceFilePath =
    env.CLAUDE_WITH_EMOTION_TRACE_FILE ||
    (typeof state?.traceFilePath === "string" ? state.traceFilePath : "");
  const visualAssetCatalogFilePath =
    env.CLAUDE_WITH_EMOTION_VISUAL_ASSET_CATALOG_FILE ||
    (typeof state?.visualAssetCatalogFilePath === "string"
      ? state.visualAssetCatalogFilePath
      : "");
  const eventQueueDir =
    typeof env.CLAUDE_WITH_EMOTION_EVENT_QUEUE_DIR === "string"
      ? env.CLAUDE_WITH_EMOTION_EVENT_QUEUE_DIR
      : "";
  const assistantProviderId =
    env.CLAUDE_WITH_EMOTION_ASSISTANT_PROVIDER_ID ||
    (typeof state?.assistantProviderId === "string"
      ? state.assistantProviderId
      : "");

  return {
    assistantProviderId,
    traceFilePath,
    visualAssetCatalogFilePath,
    eventQueueDir,
  };
}

function describeVisualMcpRuntimeSources(env = process.env) {
  const stateFilePath = readStateFilePath(env);
  const state = readVisualMcpState(env);

  return {
    assistantProviderIdSource:
      typeof env.CLAUDE_WITH_EMOTION_ASSISTANT_PROVIDER_ID === "string"
        ? "env"
        : typeof state?.assistantProviderId === "string"
          ? "state"
          : "missing",
    eventQueueDirSource:
      typeof env.CLAUDE_WITH_EMOTION_EVENT_QUEUE_DIR === "string"
        ? "env"
        : "missing",
    stateFilePath: stateFilePath ?? "",
    traceFilePathSource:
      typeof env.CLAUDE_WITH_EMOTION_TRACE_FILE === "string"
        ? "env"
        : typeof state?.traceFilePath === "string"
          ? "state"
          : "missing",
    visualAssetCatalogFilePathSource:
      typeof env.CLAUDE_WITH_EMOTION_VISUAL_ASSET_CATALOG_FILE === "string"
        ? "env"
        : typeof state?.visualAssetCatalogFilePath === "string"
          ? "state"
          : "missing",
  };
}

function createVisualMcpChildEnv(env = process.env) {
  const runtime = resolveVisualMcpRuntime(env);

  return {
    ...env,
    ...(runtime.traceFilePath.length > 0
      ? { CLAUDE_WITH_EMOTION_TRACE_FILE: runtime.traceFilePath }
      : {}),
    ...(runtime.visualAssetCatalogFilePath.length > 0
      ? {
          CLAUDE_WITH_EMOTION_VISUAL_ASSET_CATALOG_FILE:
            runtime.visualAssetCatalogFilePath,
        }
      : {}),
    ...(runtime.eventQueueDir.length > 0
      ? {
          CLAUDE_WITH_EMOTION_EVENT_QUEUE_DIR: runtime.eventQueueDir,
        }
      : {}),
    ...(runtime.assistantProviderId.length > 0
      ? {
          CLAUDE_WITH_EMOTION_ASSISTANT_PROVIDER_ID:
            runtime.assistantProviderId,
        }
      : {}),
  };
}

module.exports = {
  createVisualMcpChildEnv,
  describeVisualMcpRuntimeSources,
  readVisualMcpState,
  resolveVisualMcpRuntime,
};
