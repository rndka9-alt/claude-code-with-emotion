import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

describe("claude-visual-state", () => {
  it("writes an emotion overlay payload", () => {
    const overlayFilePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "claude-visual-overlay-")),
      "overlay.json",
    );
    const result = spawnSync(
      "node",
      ["./bin/claude-visual-state", "--emotion", "sad"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE: overlayFilePath,
        },
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(overlayFilePath, "utf8"))).toEqual({
      emotion: "sad",
    });
  });

  it("clears the emotion overlay when neutral is requested", () => {
    const overlayFilePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "claude-visual-overlay-")),
      "overlay.json",
    );
    const result = spawnSync(
      "node",
      ["./bin/claude-visual-state", "--emotion", "neutral"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE: overlayFilePath,
        },
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(overlayFilePath, "utf8"))).toEqual({
      emotion: null,
    });
  });

  it("writes and clears a visual line overlay payload", () => {
    const overlayFilePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "claude-visual-overlay-")),
      "overlay.json",
    );
    const setResult = spawnSync(
      "node",
      ["./bin/claude-visual-state", "--line", "문제를 더 파볼게요!"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE: overlayFilePath,
        },
        encoding: "utf8",
      },
    );

    expect(setResult.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(overlayFilePath, "utf8"))).toEqual({
      line: "문제를 더 파볼게요!",
    });

    const clearResult = spawnSync(
      "node",
      ["./bin/claude-visual-state", "--clear-line"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE: overlayFilePath,
        },
        encoding: "utf8",
      },
    );

    expect(clearResult.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(overlayFilePath, "utf8"))).toEqual({
      line: null,
    });
  });

  it("merges new payload with existing overlay fields", () => {
    const overlayFilePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "claude-visual-overlay-")),
      "overlay.json",
    );

    // emotion 을 먼저 쓰고 line 을 뒤이어 쓰면 두 필드가 모두 살아잇어야 한다.
    const emotionResult = spawnSync(
      "node",
      ["./bin/claude-visual-state", "--emotion", "happy"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE: overlayFilePath,
        },
        encoding: "utf8",
      },
    );

    expect(emotionResult.status).toBe(0);

    const lineResult = spawnSync(
      "node",
      ["./bin/claude-visual-state", "--line", "야호"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE: overlayFilePath,
        },
        encoding: "utf8",
      },
    );

    expect(lineResult.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(overlayFilePath, "utf8"))).toEqual({
      emotion: "happy",
      line: "야호",
    });
  });

  it("overwrites an existing field when re-set", () => {
    const overlayFilePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "claude-visual-overlay-")),
      "overlay.json",
    );

    spawnSync("node", ["./bin/claude-visual-state", "--emotion", "sad"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE: overlayFilePath,
      },
      encoding: "utf8",
    });
    const secondResult = spawnSync(
      "node",
      ["./bin/claude-visual-state", "--emotion", "happy"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE: overlayFilePath,
        },
        encoding: "utf8",
      },
    );

    expect(secondResult.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(overlayFilePath, "utf8"))).toEqual({
      emotion: "happy",
    });
  });

  it("accepts a JSON payload that sets both fields at once", () => {
    const overlayFilePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "claude-visual-overlay-")),
      "overlay.json",
    );
    const result = spawnSync(
      "node",
      [
        "./bin/claude-visual-state",
        JSON.stringify({ emotion: "happy", line: "동시에 간다!" }),
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE: overlayFilePath,
        },
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(overlayFilePath, "utf8"))).toEqual({
      emotion: "happy",
      line: "동시에 간다!",
    });
  });
});
