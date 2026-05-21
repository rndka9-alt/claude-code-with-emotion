import type {
  VisualAssetCatalog,
  VisualAssetMapping,
  VisualAssetRecord,
  VisualAssetResolution,
  VisualAssetResolutionRequest,
} from "../types/visual-asset-types";

function findAssetRecord(
  assets: ReadonlyArray<VisualAssetRecord>,
  assetId: string,
): VisualAssetRecord | null {
  const asset = assets.find((candidate) => candidate.id === assetId);

  return asset !== undefined ? asset : null;
}

function resolveFromMapping(
  assets: ReadonlyArray<VisualAssetRecord>,
  mappings: ReadonlyArray<VisualAssetMapping>,
  matcher: (mapping: VisualAssetMapping) => boolean,
  match: VisualAssetResolution["match"],
): VisualAssetResolution | null {
  for (const mapping of mappings) {
    if (!matcher(mapping)) {
      continue;
    }

    const asset = findAssetRecord(assets, mapping.assetId);

    if (asset !== null) {
      return {
        asset,
        mapping,
        match,
      };
    }
  }

  return null;
}

function resolveVisualAssetFromMappings(
  assets: ReadonlyArray<VisualAssetRecord>,
  mappings: ReadonlyArray<VisualAssetMapping>,
  defaultAssetId: string | undefined,
  request: VisualAssetResolutionRequest,
): VisualAssetResolution | null {
  if (request.emotion !== null) {
    const exactMatch = resolveFromMapping(
      assets,
      mappings,
      (mapping) =>
        mapping.state === request.state && mapping.emotion === request.emotion,
      "state-and-emotion",
    );

    if (exactMatch !== null) {
      return exactMatch;
    }

    const emotionOnlyMatch = resolveFromMapping(
      assets,
      mappings,
      (mapping) =>
        mapping.state === undefined && mapping.emotion === request.emotion,
      "emotion",
    );

    if (emotionOnlyMatch !== null) {
      return emotionOnlyMatch;
    }
  }

  const stateOnlyMatch = resolveFromMapping(
    assets,
    mappings,
    (mapping) =>
      mapping.state === request.state && mapping.emotion === undefined,
    "state",
  );

  if (stateOnlyMatch !== null) {
    return stateOnlyMatch;
  }

  if (defaultAssetId === undefined) {
    return null;
  }

  const defaultAsset = findAssetRecord(assets, defaultAssetId);

  if (defaultAsset === null) {
    return null;
  }

  return {
    asset: defaultAsset,
    mapping: null,
    match: "default",
  };
}

export function resolveVisualAsset(
  catalog: VisualAssetCatalog,
  request: VisualAssetResolutionRequest,
): VisualAssetResolution | null {
  // 우선순위: state+emotion 조합 > emotion 전용 > state 전용 > 기본값.
  // emotion 이 명시적으로 설정댓을 때(MCP 툴 호출 등) 그 emotion 자산이 state
  // 자산에 가려지지 않도록 state 전용보다 먼저 본다. emotion 이 null 이면
  // emotion 전용 단계는 건너뛰고 state 전용이 주인공 역할을 한다.
  return resolveVisualAssetFromMappings(
    catalog.assets,
    catalog.mappings,
    catalog.assets.find((asset) => asset.isDefault === true)?.id,
    request,
  );
}
