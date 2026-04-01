import type { AssistantStatusSnapshot } from '../../../shared/assistant-status';
import {
  createEmptyVisualAssetCatalog,
  resolveVisualAsset,
  type VisualAssetCatalog,
  type VisualAssetResolution,
} from '../../../shared/visual-assets';
import { normalizeAssistantVisualSelection } from '../../../shared/visual-presets';

export interface StatusPanelVisual {
  assetUrl: string;
  resolution: VisualAssetResolution;
}

export function createStatusPanelAssetUrl(filePath: string): string {
  const normalizedPath = filePath.replaceAll('\\', '/');
  const rootedPath =
    normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;

  return encodeURI(`file://${rootedPath}`);
}

export function resolveStatusPanelVisual(
  assistantStatus: AssistantStatusSnapshot,
  catalog: VisualAssetCatalog = createEmptyVisualAssetCatalog(),
): StatusPanelVisual | null {
  const selection = normalizeAssistantVisualSelection({
    state: assistantStatus.state,
    emotion: assistantStatus.emotion,
  });
  const resolution = resolveVisualAsset(catalog, selection);

  if (resolution === null) {
    return null;
  }

  return {
    assetUrl: createStatusPanelAssetUrl(resolution.asset.path),
    resolution,
  };
}
