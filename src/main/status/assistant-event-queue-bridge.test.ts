import { parseAssistantVisualOverlayEvent } from "./assistant-event-queue-bridge";

describe("AssistantEventQueueBridge", () => {
  it("accepts shared visual emotion presets through overlay events", () => {
    expect(
      parseAssistantVisualOverlayEvent({
        type: "overlay",
        emotion: "determined",
        line: "getData() 시대의 종말...!",
      }),
    ).toEqual({
      emotion: "determined",
      line: "getData() 시대의 종말...!",
    });
  });
});
