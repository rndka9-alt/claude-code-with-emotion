import { spawnSync } from "node:child_process";

describe("claude session prompts", () => {
  it("combines the visual emotion and line usage prompts for session startup", () => {
    const result = spawnSync(
      process.execPath,
      [
        "-e",
        "process.stdout.write(require('./bin/lib/claude-session-prompts.js').createVisualToolUsagePrompt())",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("set_visual_overlay");
    expect(result.stdout).toContain("emotion");
    expect(result.stdout).toContain("line");
  });
});
