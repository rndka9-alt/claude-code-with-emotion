import { BASE_VISUAL_ASSET_PROVIDER_ID } from "../constants/provider-metadata";
import type { VisualAssetProviderId } from "../types/visual-asset-types";

export function normalizeVisualAssetProviderId(
  providerId: string | null | undefined,
): VisualAssetProviderId {
  return providerId === "codex" ? "codex" : BASE_VISUAL_ASSET_PROVIDER_ID;
}
