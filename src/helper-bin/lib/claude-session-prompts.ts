import fs from "node:fs";
import { ENV_KEYS } from "../../shared/env-keys";
import { collectAvailableVisualOptions } from "../../shared/visual-assets";
import emotionUsage from "../prompts/visual-emotion-usage.md";
import lineUsage from "../prompts/visual-line-usage.md";

// 세션 시작 시 catalog 를 읽어 사용 가능한 emotion 목록과 의미를 1회 주입한다.
// (과거엔 get_available_visual_options 도구로 매 턴 조회해 컨텍스트가 누적됐다.)
// 커스텀 설명이 없으면 collect 가 EMOTION_PRESETS 기본 설명으로 폴백한다.
function buildEmotionCatalogSection(): string {
  const catalogFilePath = process.env[ENV_KEYS.VISUAL_ASSET_CATALOG_FILE];

  if (typeof catalogFilePath !== "string" || catalogFilePath.length === 0) {
    return "";
  }

  let options: ReturnType<typeof collectAvailableVisualOptions>;

  try {
    const text = fs.readFileSync(catalogFilePath, "utf8");
    const parsed: unknown = JSON.parse(text);
    const providerId =
      process.env[ENV_KEYS.ASSISTANT_PROVIDER_ID] === "codex"
        ? "codex"
        : "claude";

    options = collectAvailableVisualOptions(parsed, providerId);
  } catch {
    return "";
  }

  if (options.emotions.length === 0) {
    return "";
  }

  const lines = options.emotions.map((emotion) => {
    const description = options.emotionDescriptions[emotion];

    return typeof description === "string" && description.length > 0
      ? `- \`${emotion}\`: ${description}`
      : `- \`${emotion}\``;
  });

  return ["Available emotion ids and when to use them:", ...lines].join("\n");
}

export function createVisualToolUsagePrompt(): string {
  const emotionCatalog = buildEmotionCatalogSection();

  return [
    "Visual status tools are available in this session.",
    "",
    emotionUsage.trim(),
    ...(emotionCatalog.length > 0 ? ["", emotionCatalog] : []),
    "",
    lineUsage.trim(),
  ].join("\n");
}
