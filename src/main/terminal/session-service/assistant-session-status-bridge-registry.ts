import path from "node:path";
import type {
  AssistantStatusSnapshot,
  AssistantStatusSnapshotEvent,
} from "../../../shared/assistant-status";
import type { RuntimeLog } from "../../diagnostics";
import {
  AssistantEventQueueBridge,
  AssistantStatusStore,
} from "../../status";
import {
  clearStaleSessionArtifactDir,
  removeSessionArtifact,
} from "./session-artifacts";

interface AssistantSessionStatusBridgeRegistryOptions {
  eventQueueRootDir: string;
  runtimeLog: RuntimeLog;
  sendAssistantStatusSnapshot: (event: AssistantStatusSnapshotEvent) => void;
}

export class AssistantSessionStatusBridgeRegistry {
  private readonly sessionEventQueueBridges = new Map<
    string,
    AssistantEventQueueBridge
  >();
  private readonly sessionStatusStores = new Map<string, AssistantStatusStore>();
  private readonly sessionStatusUnsubscribes = new Map<string, () => void>();

  constructor(
    private readonly options: AssistantSessionStatusBridgeRegistryOptions,
  ) {
    clearStaleSessionArtifactDir(options.eventQueueRootDir, (message) => {
      this.options.runtimeLog.write("assistant-event-queue", message);
    });
  }

  getSnapshot(sessionId: string): AssistantStatusSnapshot {
    this.ensureSession(sessionId);

    const statusStore = this.sessionStatusStores.get(sessionId);

    if (statusStore === undefined) {
      throw new Error(
        `Assistant status store was not created for session ${sessionId}.`,
      );
    }

    return statusStore.getSnapshot();
  }

  applySessionExitOverlayClear(sessionId: string): void {
    this.sessionStatusStores
      .get(sessionId)
      ?.applyVisualOverlay({ line: null }, "session-exit");
  }

  disposeSession(sessionId: string): void {
    this.sessionEventQueueBridges.get(sessionId)?.stop();
    this.sessionStatusUnsubscribes.get(sessionId)?.();
    this.sessionStatusStores.get(sessionId)?.dispose();
    this.sessionEventQueueBridges.delete(sessionId);
    this.sessionStatusUnsubscribes.delete(sessionId);
    this.sessionStatusStores.delete(sessionId);
    removeSessionArtifact(this.resolveEventQueueDir(sessionId), (message) => {
      this.options.runtimeLog.write("assistant-event-queue", message);
    });
    removeSessionArtifact(
      `${this.resolveEventQueueDir(sessionId)}.hook-state.json`,
      (message) => {
        this.options.runtimeLog.write("assistant-event-queue", message);
      },
    );
  }

  dispose(): void {
    for (const sessionId of [...this.sessionStatusStores.keys()]) {
      this.disposeSession(sessionId);
    }
  }

  ensureSession(sessionId: string): void {
    if (this.sessionStatusStores.has(sessionId)) {
      return;
    }

    const statusStore = new AssistantStatusStore(Date.now(), (message) => {
      this.options.runtimeLog.write(
        "assistant-status-store",
        `session=${sessionId} ${message}`,
      );
    });
    const eventQueueDir = this.resolveEventQueueDir(sessionId);
    const eventQueueBridge = new AssistantEventQueueBridge(
      eventQueueDir,
      statusStore,
      (message) => {
        this.options.runtimeLog.write(
          "assistant-event-queue",
          `session=${sessionId} ${message}`,
        );
      },
    );
    const unsubscribe = statusStore.subscribe(
      (snapshot: AssistantStatusSnapshot) => {
        const payload: AssistantStatusSnapshotEvent = { sessionId, snapshot };
        this.options.sendAssistantStatusSnapshot(payload);
      },
    );

    this.sessionStatusStores.set(sessionId, statusStore);
    this.sessionEventQueueBridges.set(sessionId, eventQueueBridge);
    this.sessionStatusUnsubscribes.set(sessionId, unsubscribe);
    eventQueueBridge.start();
  }

  resolveEventQueueDir(sessionId: string): string {
    return path.join(
      this.options.eventQueueRootDir,
      `${process.pid}-${sessionId}`,
    );
  }
}
