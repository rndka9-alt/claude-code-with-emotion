import type { AssistantStatusSnapshot } from "../../../../shared/assistant-status";
import {
  createEmptyVisualAssetCatalog,
  resolveVisualStateLine,
  type VisualAssetCatalog,
} from "../../../../shared/visual-assets";
import {
  getDefaultVisualStateLine,
  normalizeAssistantVisualSelection,
} from "../../../../shared/visual-presets";

export function formatStatusPanelLine(
  assistantStatus: AssistantStatusSnapshot,
  catalog: VisualAssetCatalog = createEmptyVisualAssetCatalog(),
): string {
  const normalizedSelection = normalizeAssistantVisualSelection({
    state: assistantStatus.state,
    emotion: assistantStatus.emotion,
  });
  const activityLabel =
    typeof assistantStatus.activityLabel === "string"
      ? assistantStatus.activityLabel.trim()
      : "";
  const overlayLine = assistantStatus.overlayLine?.trim() ?? "";
  const customStateLine =
    resolveVisualStateLine(catalog, normalizedSelection.state)?.trim() ?? "";
  const defaultStateLine = getDefaultVisualStateLine(
    normalizedSelection.state,
  ).trim();

  if (overlayLine.length > 0 && activityLabel.length > 0) {
    return `${overlayLine}\n(${activityLabel})`;
  }

  if (overlayLine.length > 0) {
    return overlayLine;
  }

  if (customStateLine.length > 0 && activityLabel.length > 0) {
    return `${customStateLine}\n(${activityLabel})`;
  }

  if (customStateLine.length > 0) {
    return customStateLine;
  }

  if (defaultStateLine.length > 0 && activityLabel.length > 0) {
    return `(${defaultStateLine})`;
  }

  if (defaultStateLine.length > 0) {
    return defaultStateLine;
  }

  if (activityLabel.length > 0) {
    return `(${activityLabel})`;
  }

  return assistantStatus.line;
}
