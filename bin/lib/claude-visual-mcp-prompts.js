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

function createVisualPromptHints() {
  return {
    emotionSelectionPrompt,
    lineSelectionPrompt,
  };
}

module.exports = {
  createVisualPromptHints,
};
