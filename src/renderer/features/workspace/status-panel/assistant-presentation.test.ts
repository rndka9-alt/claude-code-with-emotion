import type { AssistantStatusSnapshot } from "../../../../shared/assistant-status";
import { resolveAssistantPresentation } from "./assistant-presentation";

const baseSnapshot: AssistantStatusSnapshot = {
  activityLabel: "컴퓨터 작업중",
  emotion: null,
  overlayLine: null,
  state: "working",
  line: "작업 중...",
  currentTask: "Testing",
  updatedAtMs: 1,
  intensity: "medium",
  source: "test",
};

describe("resolveAssistantPresentation", () => {
  it("combines the status snapshot with resolved line and visual asset", () => {
    const presentation = resolveAssistantPresentation(baseSnapshot, {
      version: 1,
      assets: [
        {
          id: "asset-working",
          kind: "image",
          label: "Working Fox",
          path: "/tmp/working.png",
        },
      ],
      mappings: [
        {
          assetId: "asset-working",
          state: "working",
        },
      ],
      stateLines: [
        {
          state: "working",
          line: "작업을 척척 처리 중이에요...!",
        },
      ],
      emotionDescriptions: [],
    });

    expect(presentation.snapshot).toBe(baseSnapshot);
    expect(presentation.line).toBe("작업을 척척 처리 중이에요...!\n(컴퓨터 작업중)");
    expect(presentation.visual?.assetUrl).toBe("file:///tmp/working.png");
    expect(presentation.visual?.resolution.match).toBe("state");
  });
});
