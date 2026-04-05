import { buildEmotionCatalogSection } from "./visual-emotion-catalog";

describe("buildEmotionCatalogSection", () => {
  it("always includes neutral even when no emotions are mapped", () => {
    const section = buildEmotionCatalogSection([]);

    expect(section).toBe(
      "- neutral: No extra emotional coloring is being applied.",
    );
  });

  it("lists mapped emotions with their preset descriptions by default", () => {
    const section = buildEmotionCatalogSection(["happy"]);

    expect(section).toContain(
      "- happy: A positive completion or upbeat reaction.",
    );
    expect(section).toContain(
      "- neutral: No extra emotional coloring is being applied.",
    );
  });

  it("replaces preset descriptions with user overrides when provided", () => {
    const section = buildEmotionCatalogSection(["happy"], {
      happy: "완전 신난 상태!!",
    });

    expect(section).toContain("- happy: 완전 신난 상태!!");
    expect(section).not.toContain(
      "- happy: A positive completion or upbeat reaction.",
    );
  });

  it("falls back to the preset description when an override is empty or missing", () => {
    const section = buildEmotionCatalogSection(["happy"], {
      // 해당 키의 override 가 업스면 기본 description 으로 폴백해야 함
    });

    expect(section).toContain(
      "- happy: A positive completion or upbeat reaction.",
    );
  });

  it("keeps preset order when multiple emotions are included", () => {
    const section = buildEmotionCatalogSection(["happy", "angry"]);
    const angryIndex = section.indexOf("- angry:");
    const happyIndex = section.indexOf("- happy:");
    const neutralIndex = section.indexOf("- neutral:");

    expect(angryIndex).toBeGreaterThanOrEqual(0);
    expect(happyIndex).toBeGreaterThan(angryIndex);
    expect(neutralIndex).toBeGreaterThan(happyIndex);
  });
});
