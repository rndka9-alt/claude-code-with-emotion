import type { AssistantStatusSnapshot } from '../../../shared/assistant-status';
import {
  createEmptyVisualAssetCatalog,
  resolveVisualStateLine,
  type VisualAssetCatalog,
} from '../../../shared/visual-assets';
import { normalizeAssistantVisualSelection } from '../../../shared/visual-presets';

export function formatStatusPanelLine(
  assistantStatus: AssistantStatusSnapshot,
  catalog: VisualAssetCatalog = createEmptyVisualAssetCatalog(),
): string {
  const activityLabel =
    typeof assistantStatus.activityLabel === 'string'
      ? assistantStatus.activityLabel.trim()
      : '';
  const overlayLine = assistantStatus.overlayLine?.trim() ?? '';
  const customStateLine =
    resolveVisualStateLine(
      catalog,
      normalizeAssistantVisualSelection({
        state: assistantStatus.state,
        emotion: assistantStatus.emotion,
      }).state,
    )?.trim() ?? '';

  if (overlayLine.length > 0 && activityLabel.length > 0) {
    return `${overlayLine} (${activityLabel})`;
  }

  if (overlayLine.length > 0) {
    return overlayLine;
  }

  if (customStateLine.length > 0 && activityLabel.length > 0) {
    return `${customStateLine} (${activityLabel})`;
  }

  if (customStateLine.length > 0) {
    return customStateLine;
  }

  if (activityLabel.length > 0) {
    return `(${activityLabel})`;
  }

  return assistantStatus.line;
}
