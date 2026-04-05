const fs = require("node:fs");
const path = require("node:path");
// TS 원본(`src/shared/visual-emotion-catalog.ts`)은 tsconfig.node.json 이 CommonJS 로 컴파일해 주므로 MCP·렌더러가 같은 소스를 공유한다.
const {
  buildEmotionCatalogSection,
} = require("../../dist/shared/visual-emotion-catalog");

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

function buildOverlaySelectionPrompt(availableEmotionIds) {
  const emotionCatalog = buildEmotionCatalogSection(availableEmotionIds);

  const sections = [
    "Update the assistant's visual overlay. Set `emotion`, `line`, or both in one call; omit a field to leave it unchanged.",
    "",
    "emotion:",
    emotionSelectionPrompt,
  ];

  // 매핑된 감정이 하나도 업으면 neutral 만 나와 의미가 약하므로 카탈로그 섹션은 내용이 비지 않을 때만 붙인다.
  if (emotionCatalog.length > 0) {
    sections.push("", "Available emotions:", emotionCatalog);
  }

  sections.push(
    "",
    "line:",
    lineSelectionPrompt,
    "Pass `line: null` to clear the line without touching the emotion.",
  );

  return sections.join("\n");
}

function createVisualPromptHints(availableEmotionIds = []) {
  return {
    overlaySelectionPrompt: buildOverlaySelectionPrompt(availableEmotionIds),
  };
}

module.exports = {
  createVisualPromptHints,
};
