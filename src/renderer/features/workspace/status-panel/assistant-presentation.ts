import type { AssistantStatusSnapshot } from "../../../../shared/assistant-status";
import {
  createEmptyVisualAssetCatalogStore,
  createVisualAssetCatalogForProvider,
  normalizeVisualAssetProviderId,
  type VisualAssetCatalogStore,
  type VisualAssetProviderId,
} from "../../../../shared/visual-assets";
import { formatStatusPanelLine } from "./status-panel-line";
import {
  resolveStatusPanelVisual,
  type StatusPanelVisual,
} from "./status-panel-visual";

export interface AssistantPresentation {
  line: string;
  snapshot: AssistantStatusSnapshot;
  visual: StatusPanelVisual | null;
}

export function resolveAssistantPresentation(
  assistantStatus: AssistantStatusSnapshot,
  catalog: VisualAssetCatalogStore = createEmptyVisualAssetCatalogStore(),
  providerId: VisualAssetProviderId = normalizeVisualAssetProviderId(
    assistantStatus.assistantProviderId,
  ),
): AssistantPresentation {
  const effectiveCatalog = createVisualAssetCatalogForProvider(
    catalog,
    providerId,
  );

  return {
    line: formatStatusPanelLine(assistantStatus, effectiveCatalog),
    snapshot: assistantStatus,
    visual: resolveStatusPanelVisual(assistantStatus, effectiveCatalog),
  };
}
