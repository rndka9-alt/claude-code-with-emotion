import { createVisualToolUsagePrompt } from "./claude-session-prompts";

describe("claude session prompts", () => {
  it("combines the visual emotion and line usage prompts for session startup", () => {
    const prompt = createVisualToolUsagePrompt();

    expect(prompt).toContain("set_visual_overlay");
    expect(prompt).toContain("emotion");
    expect(prompt).toContain("line");
  });
});
