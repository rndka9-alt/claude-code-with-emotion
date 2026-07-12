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
} from "../visual-mcp-setup";
import type { VisualMcpSetupTargetId } from "../../../shared/mcp-setup-bridge";
import { createTerminalSessionManager } from "../session";
import { AssistantSessionStatusBridgeRegistry } from "./assistant-session-status-bridge-registry";
import { clearStaleTerminalOutputLogs } from "./session-artifacts";
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
    clearStaleTerminalOutputLogs(options.terminalOutputRootDir, (message) => {
      options.runtimeLog.write("terminal-output-cleanup", message);
    });
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
        // 자연 PTY 종료도 closeSession 경로와 동일하게 상태 감시 리소스를 정리한다.
        // 안 하면 세션별 fs.watch + 폴링 타이머가 앱 종료까지 남는다.
        // (이후 getSnapshot 이 오면 ensureSession 이 재생성하므로 조회는 계속 동작한다)
        this.sessionStatusBridgeRegistry.disposeSession(sessionId);
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
    return getVisualMcpSetupStatus(
      this.options.assistantStatusHelperBinDir,
      this.options.visualMcpStateFilePath,
    );
  }

  installVisualMcpUserSetup(
    targetId?: VisualMcpSetupTargetId,
  ): ReturnType<typeof installVisualMcpUserSetup> {
    return installVisualMcpUserSetup(
      this.options.assistantStatusHelperBinDir,
      this.options.visualMcpStateFilePath,
      targetId,
    );
  }

  removeVisualMcpUserSetup(
    targetId?: VisualMcpSetupTargetId,
  ): ReturnType<typeof removeVisualMcpUserSetup> {
    return removeVisualMcpUserSetup(
      this.options.assistantStatusHelperBinDir,
      this.options.visualMcpStateFilePath,
      targetId,
    );
  }

  async bootstrapSession(
    request: TerminalBootstrapRequest,
  ): Promise<TerminalBootstrapResponse> {
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
    this.options.runtimeLog.write(
      "visual-mcp-state",
      `write session=${request.sessionId} queue=${sessionEventQueueDir} stateFile=${this.options.visualMcpStateFilePath} trace=${this.options.assistantStatusTraceFilePath} catalog=${this.options.visualAssetCatalogFilePath}`,
    );

    try {
      return await this.terminalSessionManager.bootstrapSession(
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
