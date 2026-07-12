import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { RuntimeLog } from "../../diagnostics";
import { AssistantSessionStatusBridgeRegistry } from "./assistant-session-status-bridge-registry";

function createFakeRuntimeLog(): RuntimeLog {
  return {
    filePath: "/tmp/assistant-session-status-registry-test.log",
    write: vi.fn(),
    writeError: vi.fn(),
  };
}

describe("AssistantSessionStatusBridgeRegistry", () => {
  it("returns a default snapshot for an unknown session without creating watch resources", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "assistant-status-registry-"),
    );
    const registry = new AssistantSessionStatusBridgeRegistry({
      eventQueueRootDir: tempDir,
      runtimeLog: createFakeRuntimeLog(),
      sendAssistantStatusSnapshot: vi.fn(),
    });

    try {
      const snapshot = registry.getSnapshot("session-unknown");

      expect(snapshot.state).toBe("disconnected");
      expect(
        fs.existsSync(registry.resolveEventQueueDir("session-unknown")),
      ).toBe(false);
    } finally {
      registry.dispose();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("delivers a pending throttled snapshot before disposing a session", () => {
    vi.useFakeTimers();
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "assistant-status-registry-"),
    );
    const sendAssistantStatusSnapshot = vi.fn();
    const registry = new AssistantSessionStatusBridgeRegistry({
      eventQueueRootDir: tempDir,
      runtimeLog: createFakeRuntimeLog(),
      sendAssistantStatusSnapshot,
    });

    try {
      registry.ensureSession("session-1");
      registry.applySessionExitOverlayClear("session-1");
      expect(sendAssistantStatusSnapshot).toHaveBeenCalledTimes(1);

      // throttle 윈도우 안의 두 번째 변경은 trailing emit 으로만 예약된다.
      registry.applySessionExitOverlayClear("session-1");
      expect(sendAssistantStatusSnapshot).toHaveBeenCalledTimes(1);

      registry.disposeSession("session-1");

      expect(sendAssistantStatusSnapshot).toHaveBeenCalledTimes(2);
    } finally {
      registry.dispose();
      vi.useRealTimers();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
