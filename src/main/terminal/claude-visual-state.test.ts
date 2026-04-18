import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ENV_KEYS } from "../../shared/env-keys";

function readLatestQueueEvent(
  queueDir: string,
): Record<string, unknown> {
  const files = fs
    .readdirSync(queueDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  const lastFile = files[files.length - 1];

  if (lastFile === undefined) {
    throw new Error("No queue event files found");
  }

  return JSON.parse(
    fs.readFileSync(path.join(queueDir, lastFile), "utf8"),
  ) as Record<string, unknown>;
}

describe("claude-visual-state", () => {
  it("writes an emotion overlay payload", () => {
    const eventQueueDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "claude-visual-queue-"),
    );
    const result = spawnSync(
      "node",
      ["./bin/claude-visual-state", "--emotion", "sad"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          [ENV_KEYS.EVENT_QUEUE_DIR]: eventQueueDir,
        },
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);

    const event = readLatestQueueEvent(eventQueueDir);
    expect(event.type).toBe("overlay");
    expect(event.emotion).toBe("sad");
  });

  it("clears the emotion overlay when neutral is requested", () => {
    const eventQueueDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "claude-visual-queue-"),
    );
    const result = spawnSync(
      "node",
      ["./bin/claude-visual-state", "--emotion", "neutral"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          [ENV_KEYS.EVENT_QUEUE_DIR]: eventQueueDir,
        },
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);

    const event = readLatestQueueEvent(eventQueueDir);
    expect(event.type).toBe("overlay");
    expect(event.emotion).toBeNull();
  });

  it("resets both emotion and line with --reset", () => {
    const eventQueueDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "claude-visual-queue-"),
    );

    spawnSync(
      "node",
      [
        "./bin/claude-visual-state",
        JSON.stringify({ emotion: "happy", line: "야호" }),
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          [ENV_KEYS.EVENT_QUEUE_DIR]: eventQueueDir,
        },
        encoding: "utf8",
      },
    );

    const resetResult = spawnSync(
      "node",
      ["./bin/claude-visual-state", "--reset"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          [ENV_KEYS.EVENT_QUEUE_DIR]: eventQueueDir,
        },
        encoding: "utf8",
      },
    );

    expect(resetResult.status).toBe(0);

    const event = readLatestQueueEvent(eventQueueDir);
    expect(event.type).toBe("overlay");
    expect(event.emotion).toBeNull();
    expect(event.line).toBeNull();
  });

  it("writes and clears a visual line overlay payload", () => {
    const eventQueueDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "claude-visual-queue-"),
    );
    const setResult = spawnSync(
      "node",
      ["./bin/claude-visual-state", "--line", "문제를 더 파볼게요!"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          [ENV_KEYS.EVENT_QUEUE_DIR]: eventQueueDir,
        },
        encoding: "utf8",
      },
    );

    expect(setResult.status).toBe(0);

    const setEvent = readLatestQueueEvent(eventQueueDir);
    expect(setEvent.type).toBe("overlay");
    expect(setEvent.line).toBe("문제를 더 파볼게요!");

    const clearResult = spawnSync(
      "node",
      ["./bin/claude-visual-state", "--clear-line"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          [ENV_KEYS.EVENT_QUEUE_DIR]: eventQueueDir,
        },
        encoding: "utf8",
      },
    );

    expect(clearResult.status).toBe(0);

    const clearEvent = readLatestQueueEvent(eventQueueDir);
    expect(clearEvent.type).toBe("overlay");
    expect(clearEvent.line).toBeNull();
  });

  it("creates separate queue events for each invocation", () => {
    const eventQueueDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "claude-visual-queue-"),
    );

    const emotionResult = spawnSync(
      "node",
      ["./bin/claude-visual-state", "--emotion", "happy"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          [ENV_KEYS.EVENT_QUEUE_DIR]: eventQueueDir,
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
          [ENV_KEYS.EVENT_QUEUE_DIR]: eventQueueDir,
        },
        encoding: "utf8",
      },
    );

    expect(lineResult.status).toBe(0);

    // Each invocation creates its own queue event file.
    const files = fs
      .readdirSync(eventQueueDir)
      .filter((f) => f.endsWith(".json"))
      .sort();

    expect(files.length).toBe(2);

    const firstEvent = JSON.parse(
      fs.readFileSync(path.join(eventQueueDir, files[0] as string), "utf8"),
    ) as Record<string, unknown>;

    expect(firstEvent.type).toBe("overlay");
    expect(firstEvent.emotion).toBe("happy");

    const secondEvent = JSON.parse(
      fs.readFileSync(path.join(eventQueueDir, files[1] as string), "utf8"),
    ) as Record<string, unknown>;

    expect(secondEvent.type).toBe("overlay");
    expect(secondEvent.line).toBe("야호");
  });

  it("overwrites an existing field when re-set", () => {
    const eventQueueDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "claude-visual-queue-"),
    );

    spawnSync("node", ["./bin/claude-visual-state", "--emotion", "sad"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        [ENV_KEYS.EVENT_QUEUE_DIR]: eventQueueDir,
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
          [ENV_KEYS.EVENT_QUEUE_DIR]: eventQueueDir,
        },
        encoding: "utf8",
      },
    );

    expect(secondResult.status).toBe(0);

    const event = readLatestQueueEvent(eventQueueDir);
    expect(event.type).toBe("overlay");
    expect(event.emotion).toBe("happy");
  });

  it("accepts a JSON payload that sets both fields at once", () => {
    const eventQueueDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "claude-visual-queue-"),
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
          [ENV_KEYS.EVENT_QUEUE_DIR]: eventQueueDir,
        },
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);

    const event = readLatestQueueEvent(eventQueueDir);
    expect(event.type).toBe("overlay");
    expect(event.emotion).toBe("happy");
    expect(event.line).toBe("동시에 간다!");
  });
});
