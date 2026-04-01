import type { AssistantStatusSnapshot } from '../../../shared/assistant-status';

export function formatStatusPanelLine(
  assistantStatus: AssistantStatusSnapshot,
): string {
  const activityLabel =
    typeof assistantStatus.activityLabel === 'string'
      ? assistantStatus.activityLabel.trim()
      : '';
  const overlayLine = assistantStatus.overlayLine?.trim() ?? '';

  if (overlayLine.length > 0 && activityLabel.length > 0) {
    return `${overlayLine} (${activityLabel})`;
  }

  if (overlayLine.length > 0) {
    return overlayLine;
  }

  if (activityLabel.length > 0) {
    return `(${activityLabel})`;
  }

  return assistantStatus.line;
}
