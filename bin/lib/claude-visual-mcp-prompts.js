const fs = require("node:fs");
const path = require("node:path");

function readPromptFile(fileName, fallback) {
  try {
    return fs
      .readFileSync(path.join(__dirname, "..", "prompts", fileName), "utf8")
      .trim();
  } catch {
    return fallback;
  }
}

const emotionSelectionPrompt = readPromptFile(
  "visual-emotion-selection.md",
  "Choose only from the mapped emotions that the app exposes. Use neutral to clear the emotion overlay.",
);

const lineSelectionPrompt = readPromptFile(
  "visual-line-selection.md",
  "Set a short in-character utterance. The app appends the current activity label in parentheses, so do not restate the task.",
);

// emotion 카탈로그(각 emotion 의 설명)는 앱에서 동적으로 바뀌므로 정적인 description 에 박지 않는다.
// 모델은 emotion 의미를 get_available_visual_options 로 조회한다. description 에는 사용 안내만 남긴다.
function buildOverlaySelectionPrompt() {
  return [
    "Update the assistant's visual overlay. Set `emotion`, `line`, or both in one call; omit a field to leave it unchanged.",
    "",
    "emotion:",
    emotionSelectionPrompt,
    "",
    "line:",
    lineSelectionPrompt,
    "Pass `line: null` to clear the line without touching the emotion.",
  ].join("\n");
}

function createVisualPromptHints() {
  return {
    overlaySelectionPrompt: buildOverlaySelectionPrompt(),
  };
}

module.exports = {
  createVisualPromptHints,
};
