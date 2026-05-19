import path from "node:path";
import {
  type AssistantStatusSnapshot,
  type AssistantStatusSnapshotEvent,
  type AssistantStatusSnapshotRequest,
} from "../../../shared/assistant-status";
import {
  type TerminalBootstrapRequest,
  type TerminalBootstrapResponse,
  type TerminalCloseRequest,
  type TerminalExitEvent,
  type TerminalInputRequest,
  type TerminalOutputEvent,
  type TerminalResizeRequest,
} from "../../../shared/terminal-bridge";
import type { RuntimeLog } from "../../diagnostics";
import {
  getVisualMcpSetupStatus,
  installVisualMcpUserSetup,
  removeVisualMcpUserSetup,
} from "../assistant-provider";
import { createTerminalSessionManager } from "../session";
import { AssistantSessionStatusBridgeRegistry } from "./assistant-session-status-bridge-registry";
import { writeVisualMcpState } from "./visual-mcp-state";

interface TerminalSessionServiceOptions {
  assistantStatusHelperBinDir: string;
  assistantStatusTraceFilePath: string;
  runtimeLog: RuntimeLog;
  sendAssistantStatusSnapshot: (event: AssistantStatusSnapshotEvent) => void;
  sendTerminalExit: (event: TerminalExitEvent) => void;
  sendTerminalOutput: (event: TerminalOutputEvent) => void;
  terminalOutputRootDir: string;
  userDataPath: string;
  visualAssetCatalogFilePath: string;
  visualMcpStateFilePath: string;
}

export class TerminalSessionService {
  private readonly eventQueueRootDir: string;
  private readonly sessionStatusBridgeRegistry: AssistantSessionStatusBridgeRegistry;
  private readonly terminalSessionManager;

  constructor(private readonly options: TerminalSessionServiceOptions) {
    this.eventQueueRootDir = path.join(
      options.userDataPath,
      "assistant-event-queue",
    );
    this.sessionStatusBridgeRegistry = new AssistantSessionStatusBridgeRegistry(
      {
        eventQueueRootDir: this.eventQueueRootDir,
        runtimeLog: options.runtimeLog,
        sendAssistantStatusSnapshot: options.sendAssistantStatusSnapshot,
      },
    );
    this.terminalSessionManager = createTerminalSessionManager(
      (sessionId, event) => {
        this.options.sendTerminalOutput({
          sessionId,
          data: event.data,
          outputVersion: event.outputVersion,
        });
      },
      (sessionId, event) => {
        this.options.runtimeLog.write(
          "terminal",
          `exit session=${sessionId} code=${event.exitCode} signal=${event.signal}`,
        );
        this.sessionStatusBridgeRegistry.applySessionExitOverlayClear(
          sessionId,
        );
        this.options.sendTerminalExit({
          sessionId,
          exitCode: event.exitCode,
          signal: event.signal,
        });
      },
      options.assistantStatusHelperBinDir,
      options.assistantStatusTraceFilePath,
      options.visualAssetCatalogFilePath,
      options.terminalOutputRootDir,
      options.userDataPath,
    );
  }

  getAssistantStatusSnapshot(
    request: AssistantStatusSnapshotRequest,
  ): AssistantStatusSnapshot {
    return this.sessionStatusBridgeRegistry.getSnapshot(request.sessionId);
  }

  getVisualMcpSetupStatus(): ReturnType<typeof getVisualMcpSetupStatus> {
    return getVisualMcpSetupStatus(this.options.visualMcpStateFilePath);
  }

  installVisualMcpUserSetup(): ReturnType<typeof installVisualMcpUserSetup> {
    return installVisualMcpUserSetup(
      this.options.assistantStatusHelperBinDir,
      this.options.visualMcpStateFilePath,
    );
  }

  removeVisualMcpUserSetup(): ReturnType<typeof removeVisualMcpUserSetup> {
    return removeVisualMcpUserSetup(this.options.visualMcpStateFilePath);
  }

  bootstrapSession(
    request: TerminalBootstrapRequest,
  ): TerminalBootstrapResponse {
    this.options.runtimeLog.write(
      "terminal",
      `bootstrap session=${request.sessionId} cwd=${request.cwd} command=${request.command} cols=${request.cols} rows=${request.rows}`,
    );
    this.sessionStatusBridgeRegistry.ensureSession(request.sessionId);
    const sessionEventQueueDir =
      this.sessionStatusBridgeRegistry.resolveEventQueueDir(request.sessionId);
    writeVisualMcpState({
      eventQueueDir: sessionEventQueueDir,
      traceFilePath: this.options.assistantStatusTraceFilePath,
      visualAssetCatalogFilePath: this.options.visualAssetCatalogFilePath,
      visualMcpStateFilePath: this.options.visualMcpStateFilePath,
    });

    try {
      return this.terminalSessionManager.bootstrapSession(
        request,
        sessionEventQueueDir,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown terminal error";

      this.options.runtimeLog.write(
        "terminal-error",
        `bootstrap failed for ${request.sessionId}: ${message}`,
      );
      throw error;
    }
  }

  sendInput(request: TerminalInputRequest): void {
    this.terminalSessionManager.sendInput(request);
  }

  resizeSession(request: TerminalResizeRequest): void {
    this.terminalSessionManager.resizeSession(request);
  }

  closeSession(request: TerminalCloseRequest): void {
    this.options.runtimeLog.write(
      "terminal",
      `close session=${request.sessionId}`,
    );
    this.terminalSessionManager.closeSession(request);
    this.sessionStatusBridgeRegistry.disposeSession(request.sessionId);
  }

  dispose(): void {
    this.sessionStatusBridgeRegistry.dispose();
    this.terminalSessionManager.dispose();
  }
}
