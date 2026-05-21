import type { AssistantStatusSnapshot } from "../../../../shared/assistant-status";
import {
  createEmptyVisualAssetCatalog,
  normalizeVisualAssetProviderId,
  type VisualAssetCatalog,
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
  catalog: VisualAssetCatalog = createEmptyVisualAssetCatalog(),
  providerId: VisualAssetProviderId = normalizeVisualAssetProviderId(
    assistantStatus.assistantProviderId,
  ),
): AssistantPresentation {
  return {
    line: formatStatusPanelLine(assistantStatus, catalog, providerId),
    snapshot: assistantStatus,
    visual: resolveStatusPanelVisual(assistantStatus, catalog, providerId),
  };
}
