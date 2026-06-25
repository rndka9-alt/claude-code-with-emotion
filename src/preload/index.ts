import {
  contextBridge,
  ipcRenderer,
  webUtils,
  type IpcRendererEvent,
} from "electron";
import os from "node:os";
import type { ClaudeAppApi } from "../shared/electron-api";
import { parseInitialAssistantProviderMetadataFromArguments } from "../shared/assistant-provider";
import { APP_THEME_CHANNELS } from "../shared/app-theme-bridge";
import type { AppThemeSelection } from "../shared/theme";
import {
  ASSISTANT_STATUS_CHANNELS,
  parseInitialAssistantSnapshotsBySessionIdFromArguments,
  type AssistantStatusSnapshotEvent,
  type AssistantStatusSnapshot,
} from "../shared/assistant-status";
import {
  DIAGNOSTICS_CHANNELS,
  type FrameStallDiagnosticPayload,
  type RendererDiagnosticPayload,
  type RuntimeDiagnosticPayload,
} from "../shared/diagnostics";
import { FORENSICS_STALL_THRESHOLD_MS } from "../shared/forensics";
import {
  FORENSICS_MODE_CHANNELS,
  type ForensicsModeState,
} from "../shared/forensics-bridge";
import { LINKS_CHANNELS } from "../shared/links-bridge";
import { MCP_SETUP_CHANNELS } from "../shared/mcp-setup-bridge";
import {
  TERMINAL_CHANNELS,
  type TerminalExitEvent,
  type TerminalOutputEvent,
} from "../shared/terminal-bridge";
import { VISUAL_ASSET_CHANNELS } from "../shared/visual-assets-bridge";
import type { VisualAssetCatalogStore } from "../shared/visual-assets";
import { WORKSPACE_COMMAND_CHANNELS } from "../shared/workspace-command-bridge";
import {
  parseInitialWorkspaceStateFromArguments,
  type WorkspaceState,
} from "../shared/workspace-state";
import {
  WORKSPACE_WINDOW_CHANNELS,
  parseAttachWorkspaceStateRequest,
  type AttachWorkspaceStateToWindowAtPointRequest,
  type OpenDetachedWorkspaceWindowRequest,
  type WorkspaceTabDragPreviewMoveRequest,
  type WorkspaceTabDragPreviewRequest,
} from "../shared/workspace-window-bridge";
import {
  startFrameStallWatchdog,
  type FrameStallWatchdog,
} from "./frame-stall-watchdog";

// Finder 에서 실행한 패키지 앱은 process.cwd() 가 `/` 로 설정돼서 터미널이 루트에서 열린다.
// 유저 홈 디렉터리를 기본 cwd 로 고정해, 개발(npm run dev) 환경과 패키징 환경 모두 홈에서 시작하도록 맞춘다.
const initialWorkspaceState: WorkspaceState | undefined =
  parseInitialWorkspaceStateFromArguments(process.argv);
const initialAssistantSnapshotsBySessionId =
  parseInitialAssistantSnapshotsBySessionIdFromArguments(process.argv);
const assistantProvider = parseInitialAssistantProviderMetadataFromArguments(
  process.argv,
);

if (assistantProvider === undefined) {
  throw new Error("Assistant provider metadata argument is required.");
}

const claudeAppApi: ClaudeAppApi = {
  appVersion: process.versions.electron,
  assistantProvider,
  ...(initialAssistantSnapshotsBySessionId !== undefined
    ? { initialAssistantSnapshotsBySessionId }
    : {}),
  ...(initialWorkspaceState !== undefined ? { initialWorkspaceState } : {}),
  workspaceCwd: os.homedir(),
  appTheme: {
    getSelection: () => {
      return ipcRenderer.invoke(APP_THEME_CHANNELS.getSelection);
    },
    onSelection: (listener) => {
      const subscription = (
        _event: IpcRendererEvent,
        payload: AppThemeSelection,
      ) => {
        listener(payload);
      };

      ipcRenderer.on(APP_THEME_CHANNELS.selection, subscription);

      return () => {
        ipcRenderer.removeListener(APP_THEME_CHANNELS.selection, subscription);
      };
    },
    saveSelection: (selection) => {
      return ipcRenderer.invoke(APP_THEME_CHANNELS.saveSelection, selection);
    },
  },
  assistantStatus: {
    getSnapshot: (request) => {
      return ipcRenderer.invoke(ASSISTANT_STATUS_CHANNELS.getSnapshot, request);
    },
    onSnapshot: (request, listener) => {
      const subscription = (
        _event: IpcRendererEvent,
        payload: AssistantStatusSnapshotEvent,
      ) => {
        if (payload.sessionId === request.sessionId) {
          listener(payload.snapshot);
        }
      };

      ipcRenderer.on(ASSISTANT_STATUS_CHANNELS.snapshot, subscription);

      return () => {
        ipcRenderer.removeListener(
          ASSISTANT_STATUS_CHANNELS.snapshot,
          subscription,
        );
      };
    },
  },
  diagnostics: {
    onRuntimeEvent: (listener) => {
      const subscription = (
        _event: IpcRendererEvent,
        payload: RuntimeDiagnosticPayload,
      ) => {
        listener(payload);
      };

      ipcRenderer.on(DIAGNOSTICS_CHANNELS.runtimeEvent, subscription);

      return () => {
        ipcRenderer.removeListener(
          DIAGNOSTICS_CHANNELS.runtimeEvent,
          subscription,
        );
      };
    },
  },
  forensics: {
    getState: () => {
      return ipcRenderer.invoke(FORENSICS_MODE_CHANNELS.getState);
    },
    setState: (enabled) => {
      return ipcRenderer.invoke(FORENSICS_MODE_CHANNELS.setState, enabled);
    },
    onStateChange: (listener) => {
      const subscription = (
        _event: IpcRendererEvent,
        payload: ForensicsModeState,
      ) => {
        listener(payload);
      };

      ipcRenderer.on(FORENSICS_MODE_CHANNELS.stateChanged, subscription);

      return () => {
        ipcRenderer.removeListener(
          FORENSICS_MODE_CHANNELS.stateChanged,
          subscription,
        );
      };
    },
  },
  links: {
    openExternal: (url) => {
      return ipcRenderer.invoke(LINKS_CHANNELS.openExternal, url);
    },
  },
  mcpSetup: {
    getStatus: () => {
      return ipcRenderer.invoke(MCP_SETUP_CHANNELS.getStatus);
    },
    install: (request) => {
      return ipcRenderer.invoke(MCP_SETUP_CHANNELS.install, request);
    },
    remove: (request) => {
      return ipcRenderer.invoke(MCP_SETUP_CHANNELS.remove, request);
    },
  },
  terminals: {
    bootstrapSession: (request) => {
      return ipcRenderer.invoke(TERMINAL_CHANNELS.bootstrap, request);
    },
    sendInput: async (request) => {
      await ipcRenderer.invoke(TERMINAL_CHANNELS.input, request);
    },
    resizeSession: async (request) => {
      await ipcRenderer.invoke(TERMINAL_CHANNELS.resize, request);
    },
    closeSession: async (request) => {
      await ipcRenderer.invoke(TERMINAL_CHANNELS.close, request);
    },
    onOutput: (listener) => {
      const subscription = (
        _event: IpcRendererEvent,
        payload: TerminalOutputEvent,
      ) => {
        listener(payload);
      };

      ipcRenderer.on(TERMINAL_CHANNELS.output, subscription);

      return () => {
        ipcRenderer.removeListener(TERMINAL_CHANNELS.output, subscription);
      };
    },
    onExit: (listener) => {
      const subscription = (
        _event: IpcRendererEvent,
        payload: TerminalExitEvent,
      ) => {
        listener(payload);
      };

      ipcRenderer.on(TERMINAL_CHANNELS.exit, subscription);

      return () => {
        ipcRenderer.removeListener(TERMINAL_CHANNELS.exit, subscription);
      };
    },
  },
  visualAssets: {
    getAvailableOptions: () => {
      return ipcRenderer.invoke(VISUAL_ASSET_CHANNELS.getAvailableOptions);
    },
    getCatalog: () => {
      return ipcRenderer.invoke(VISUAL_ASSET_CHANNELS.getCatalog);
    },
    getPathForFile: (file) => {
      return webUtils.getPathForFile(file);
    },
    importFiles: (filePaths) => {
      return ipcRenderer.invoke(VISUAL_ASSET_CHANNELS.importFiles, filePaths);
    },
    onCatalog: (listener) => {
      const subscription = (
        _event: IpcRendererEvent,
        payload: VisualAssetCatalogStore,
      ) => {
        listener(payload);
      };

      ipcRenderer.on(VISUAL_ASSET_CHANNELS.catalog, subscription);

      return () => {
        ipcRenderer.removeListener(VISUAL_ASSET_CHANNELS.catalog, subscription);
      };
    },
    pickFiles: () => {
      return ipcRenderer.invoke(VISUAL_ASSET_CHANNELS.pickFiles);
    },
    printAvailableOptions: () => {
      return ipcRenderer.invoke(VISUAL_ASSET_CHANNELS.printAvailableOptions);
    },
    saveCatalog: (catalog) => {
      return ipcRenderer.invoke(VISUAL_ASSET_CHANNELS.saveCatalog, catalog);
    },
  },
  workspaceCommands: {
    onOpenTerminalSearch: (listener) => {
      const subscription = () => {
        listener();
      };

      ipcRenderer.on(
        WORKSPACE_COMMAND_CHANNELS.openTerminalSearch,
        subscription,
      );

      return () => {
        ipcRenderer.removeListener(
          WORKSPACE_COMMAND_CHANNELS.openTerminalSearch,
          subscription,
        );
      };
    },
  },
  workspaceWindows: {
    attachWorkspaceStateToWindowAtPoint: async (
      request: AttachWorkspaceStateToWindowAtPointRequest,
    ) => {
      return ipcRenderer.invoke(
        WORKSPACE_WINDOW_CHANNELS.attachToWindowAtPoint,
        request,
      );
    },
    closeCurrentWorkspaceWindow: async () => {
      await ipcRenderer.invoke(WORKSPACE_WINDOW_CHANNELS.closeCurrent);
    },
    hideTabDragPreview: () => {
      ipcRenderer.send(WORKSPACE_WINDOW_CHANNELS.hideTabDragPreview);
    },
    moveTabDragPreview: (request: WorkspaceTabDragPreviewMoveRequest) => {
      ipcRenderer.send(WORKSPACE_WINDOW_CHANNELS.moveTabDragPreview, request);
    },
    onAttachWorkspaceState: (listener) => {
      const subscription = (_event: IpcRendererEvent, payload: unknown) => {
        listener(parseAttachWorkspaceStateRequest(payload));
      };

      ipcRenderer.on(WORKSPACE_WINDOW_CHANNELS.attachState, subscription);

      return () => {
        ipcRenderer.removeListener(
          WORKSPACE_WINDOW_CHANNELS.attachState,
          subscription,
        );
      };
    },
    openDetachedWorkspaceWindow: async (
      request: OpenDetachedWorkspaceWindowRequest,
    ) => {
      await ipcRenderer.invoke(WORKSPACE_WINDOW_CHANNELS.openDetached, request);
    },
    showTabDragPreview: (request: WorkspaceTabDragPreviewRequest) => {
      ipcRenderer.send(WORKSPACE_WINDOW_CHANNELS.showTabDragPreview, request);
    },
  },
};

function emitRendererDiagnostic(payload: RendererDiagnosticPayload): void {
  ipcRenderer.send(DIAGNOSTICS_CHANNELS.rendererEvent, payload);
}

function emitUnhandledRendererDiagnostic(
  type: RendererDiagnosticPayload["type"],
  message: string,
  stack?: string,
): void {
  const payload: RendererDiagnosticPayload = {
    type,
    message,
  };

  if (typeof stack === "string" && stack.length > 0) {
    payload.stack = stack;
  }

  emitRendererDiagnostic(payload);
}

window.addEventListener("error", (event: ErrorEvent) => {
  const locationSuffix =
    typeof event.filename === "string" && event.filename.length > 0
      ? ` @ ${event.filename}:${event.lineno}:${event.colno}`
      : "";

  emitUnhandledRendererDiagnostic(
    "window-error",
    `${event.message}${locationSuffix}`,
    event.error instanceof Error ? event.error.stack : undefined,
  );
});

window.addEventListener(
  "unhandledrejection",
  (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : JSON.stringify(reason);

    emitUnhandledRendererDiagnostic(
      "unhandled-rejection",
      message,
      reason instanceof Error ? reason.stack : undefined,
    );
  },
);

contextBridge.exposeInMainWorld("claudeApp", claudeAppApi);

// 감시 모드 watchdog: 렌더러 메인 스레드 stall을 감시해 메인에 신고한다.
// 막힌 스레드는 자기 콜스택을 뜰 수 없으므로 여기서는 정지 시각·시간만 보내고,
// 콜스택 캡처는 메인 forensics recorder가 외부 프로파일러로 수행한다.
// on/off는 메인의 감시 모드 상태를 따른다(설정 토글 또는 FORENSICS 환경변수가 결정).
let frameStallWatchdog: FrameStallWatchdog | null = null;

function syncFrameStallWatchdog(enabled: boolean): void {
  if (enabled && frameStallWatchdog === null) {
    frameStallWatchdog = startFrameStallWatchdog({
      thresholdMs: FORENSICS_STALL_THRESHOLD_MS,
      onStall: (durationMs) => {
        const payload: FrameStallDiagnosticPayload = {
          durationMs,
          detectedAt: new Date().toISOString(),
        };

        ipcRenderer.send(DIAGNOSTICS_CHANNELS.frameStall, payload);
      },
    });
    return;
  }

  if (!enabled && frameStallWatchdog !== null) {
    frameStallWatchdog.stop();
    frameStallWatchdog = null;
  }
}

void claudeAppApi.forensics.getState().then((state) => {
  syncFrameStallWatchdog(state.enabled);
});

claudeAppApi.forensics.onStateChange((state) => {
  syncFrameStallWatchdog(state.enabled);
});
