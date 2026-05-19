import {
  type AssistantSnapshotsBySessionId,
  createDefaultAssistantStatusSnapshot,
  createInitialAssistantSnapshotsBySessionIdArgument,
  parseAssistantSnapshotsBySessionId,
  parseInitialAssistantSnapshotsBySessionIdFromArguments,
} from "./assistant-status";

describe("assistant status serialization", () => {
  it("round-trips initial assistant snapshots through a window argument", () => {
    const snapshotsBySessionId: AssistantSnapshotsBySessionId = {
      "session-test": {
        ...createDefaultAssistantStatusSnapshot(10_000),
        currentTask: "handoff task",
        line: "handoff line",
        source: "assistant-status-test",
        state: "working",
      },
    };

    const argument =
      createInitialAssistantSnapshotsBySessionIdArgument(snapshotsBySessionId);

    expect(
      parseInitialAssistantSnapshotsBySessionIdFromArguments([argument]),
    ).toEqual(snapshotsBySessionId);
  });

  it("rejects invalid assistant snapshot handoff payloads", () => {
    expect(() => {
      parseAssistantSnapshotsBySessionId({
        "session-test": {
          ...createDefaultAssistantStatusSnapshot(10_000),
          state: "confused",
        },
      });
    }).toThrow("Assistant status snapshot payload is invalid.");
  });
});
