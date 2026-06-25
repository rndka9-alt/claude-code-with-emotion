import emotionSelectionPrompt from "../prompts/visual-emotion-selection.md";
import lineSelectionPrompt from "../prompts/visual-line-selection.md";

// emotion 카탈로그(각 emotion 의 설명)는 앱에서 동적으로 바뀌므로 정적인 description 에 박지 않는다.
// 모델은 emotion 의미를 get_available_visual_options 로 조회한다. description 에는 사용 안내만 남긴다.
function buildOverlaySelectionPrompt(): string {
  return [
    "Update the assistant's visual overlay. Set `emotion`, `line`, or both in one call; omit a field to leave it unchanged.",
    "",
    "emotion:",
    emotionSelectionPrompt.trim(),
    "",
    "line:",
    lineSelectionPrompt.trim(),
    "Pass `line: null` to clear the line without touching the emotion.",
  ].join("\n");
}

export function createVisualPromptHints(): { overlaySelectionPrompt: string } {
  return {
    overlaySelectionPrompt: buildOverlaySelectionPrompt(),
  };
}
