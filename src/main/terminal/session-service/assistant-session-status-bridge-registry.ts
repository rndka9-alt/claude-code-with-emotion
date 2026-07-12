import path from "node:path";
import {
  createDefaultAssistantStatusSnapshot,
  type AssistantStatusSnapshot,
  type AssistantStatusSnapshotEvent,
} from "../../../shared/assistant-status";
import type { RuntimeLog } from "../../diagnostics";
import { AssistantEventQueueBridge, AssistantStatusStore } from "../../status";
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
  private readonly sessionStatusStores = new Map<
    string,
    AssistantStatusStore
  >();
  private readonly sessionStatusUnsubscribes = new Map<string, () => void>();

  constructor(
    private readonly options: AssistantSessionStatusBridgeRegistryOptions,
  ) {
    clearStaleSessionArtifactDir(options.eventQueueRootDir, (message) => {
      this.options.runtimeLog.write("assistant-event-queue", message);
    });
  }

  getSnapshot(sessionId: string): AssistantStatusSnapshot {
    const statusStore = this.sessionStatusStores.get(sessionId);

    // 종료·정리된 세션의 늦은 조회가 fs.watch 와 폴링 타이머를 재생성해
    // dispose 기회 없이 남는 것을 막기 위해, 조회 경로에서는 세션을 만들지 않는다.
    // 세션 생성은 bootstrapSession 의 ensureSession 이 전담한다.
    if (statusStore === undefined) {
      return createDefaultAssistantStatusSnapshot(Date.now());
    }

    return statusStore.getSnapshot();
  }

  applySessionExitOverlayClear(sessionId: string): void {
    this.sessionStatusStores
      .get(sessionId)
      ?.applyVisualOverlay({ line: null }, "session-exit");
  }

  disposeSession(sessionId: string): void {
    const eventQueueDir = this.resolveEventQueueDir(sessionId);

    this.options.runtimeLog.write(
      "assistant-event-queue",
      `dispose session=${sessionId} queue=${eventQueueDir}`,
    );
    this.sessionEventQueueBridges.get(sessionId)?.stop();
    // store.dispose() 는 pending emit 을 flush 하므로 구독 해제보다 먼저 불러
    // 마지막 스냅샷(예: exit overlay clear)이 구독자에게 전달되게 한다.
    this.sessionStatusStores.get(sessionId)?.dispose();
    this.sessionStatusUnsubscribes.get(sessionId)?.();
    this.sessionEventQueueBridges.delete(sessionId);
    this.sessionStatusUnsubscribes.delete(sessionId);
    this.sessionStatusStores.delete(sessionId);
    removeSessionArtifact(eventQueueDir, (message) => {
      this.options.runtimeLog.write("assistant-event-queue", message);
    });
    removeSessionArtifact(
      `${eventQueueDir}.hook-state.json`,
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
    this.options.runtimeLog.write(
      "assistant-event-queue",
      `ensure session=${sessionId} queue=${eventQueueDir}`,
    );
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
