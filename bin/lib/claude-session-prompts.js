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

function createVisualToolUsagePrompt() {
  const emotionUsage = readPromptFile(
    "visual-emotion-usage.md",
    "Call set_visual_overlay with an emotion field when the visible emotional tone should change; use emotion: \"neutral\" to clear it.",
  );
  const lineUsage = readPromptFile(
    "visual-line-usage.md",
    "Call set_visual_overlay with a line field for a short in-character utterance when it helps, and line: null when it no longer does.",
  );

  return [
    "Visual status tools are available in this session.",
    "",
    emotionUsage,
    "",
    lineUsage,
  ].join("\n");
}

module.exports = {
  createVisualToolUsagePrompt,
};
