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
  const visualOverlayFilePath =
    env.CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE ||
    (typeof state?.visualOverlayFilePath === "string"
      ? state.visualOverlayFilePath
      : "");

  return {
    traceFilePath,
    visualAssetCatalogFilePath,
    visualOverlayFilePath,
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
    ...(runtime.visualOverlayFilePath.length > 0
      ? {
          CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE:
            runtime.visualOverlayFilePath,
        }
      : {}),
  };
}

module.exports = {
  createVisualMcpChildEnv,
  readVisualMcpState,
  resolveVisualMcpRuntime,
};
