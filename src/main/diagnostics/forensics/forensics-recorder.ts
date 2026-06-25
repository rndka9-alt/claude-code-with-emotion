import { ipcMain, type IpcMainEvent, type WebContents } from "electron";
import {
  DIAGNOSTICS_CHANNELS,
  type FrameStallDiagnosticPayload,
} from "../../../shared/diagnostics";
import { FORENSICS_STALL_THRESHOLD_MS } from "../../../shared/forensics";
import type { RuntimeLog } from "../runtime-log";
import {
  startAppMetricsSampler,
  type AppMetricsSampler,
} from "./app-metrics-sampler";
import { isRecord, writeCpuProfile } from "./cpu-profile";
import {
  APP_METRICS_SAMPLE_INTERVAL_MS,
  CPU_PROFILER_SAMPLING_INTERVAL_MICROS,
  MAIN_STALL_POLL_INTERVAL_MS,
} from "./forensics-config";
import {
  createMainProcessProfiler,
  type MainProcessProfiler,
} from "./main-process-profiler";
import {
  startMainStallDetector,
  type MainStallDetector,
} from "./main-stall-detector";
import {
  attachRendererDebuggerProfiler,
  type RendererDebuggerProfiler,
} from "./renderer-debugger-profiler";

export interface ForensicsRecorder {
  isEnabled: () => boolean;
  // 감시 모드 ON: 메인 프로파일러·메트릭 샘플러·stall 감지를 가동한다.
  enable: () => void;
  // 감시 모드 OFF: 모든 프로파일러를 멈추고 디버거를 뗀다.
  disable: () => void;
  // 새 워크스페이스 창에 렌더러 프로파일러를 붙인다(감시 모드 ON일 때만 실제 동작).
  attachWindow: (webContents: WebContents) => void;
  dispose: () => void;
}

export interface CreateForensicsRecorderOptions {
  runtimeLog: RuntimeLog;
  // 프로파일·메트릭 산출물을 저장할 디렉토리.
  directory: string;
}

function isFrameStallPayload(
  value: unknown,
): value is FrameStallDiagnosticPayload {
  return (
    isRecord(value) &&
    typeof value.durationMs === "number" &&
    typeof value.detectedAt === "string"
  );
}

// stall이 감지되면 막힌 프로세스의 콜스택 트리를 .cpuprofile로 떨구는 오케스트레이터.
// recorder는 항상 만들어 두되, enable() 전에는 어떤 계측도 가동하지 않는다(평소 오버헤드 0).
// - 메인 프로세스: inspector 프로파일러 + 타이머 drift stall 감지
// - 렌더러 프로세스: 창마다 webContents.debugger 프로파일러 + preload watchdog 신고
// - 공통: app.getAppMetrics() 추세 로깅
export function createForensicsRecorder({
  runtimeLog,
  directory,
}: CreateForensicsRecorderOptions): ForensicsRecorder {
  let enabled = false;
  let mainProfiler: MainProcessProfiler | null = null;
  let metricsSampler: AppMetricsSampler | null = null;
  let mainStallDetector: MainStallDetector | null = null;
  const rendererProfilers = new Map<number, RendererDebuggerProfiler>();

  async function captureMainSlice(
    detectedAt: string,
    durationMs: number,
  ): Promise<void> {
    if (mainProfiler === null) {
      return;
    }

    const profile = await mainProfiler.captureSlice();

    if (profile === null) {
      runtimeLog.write("forensics", "main-thread profile unavailable");
      return;
    }

    const filePath = writeCpuProfile(directory, "main-stall", profile, {
      detectedAt,
      durationMs,
    });
    runtimeLog.write("forensics", `main-thread profile saved → ${filePath}`);
  }

  function attachWindow(webContents: WebContents): void {
    if (!enabled || rendererProfilers.has(webContents.id)) {
      return;
    }

    const profiler = attachRendererDebuggerProfiler(
      webContents,
      CPU_PROFILER_SAMPLING_INTERVAL_MICROS,
      (error) => {
        runtimeLog.writeError("forensics-renderer-profiler", error);
      },
    );

    if (profiler === null) {
      return;
    }

    rendererProfilers.set(webContents.id, profiler);
    runtimeLog.write(
      "forensics",
      `renderer profiler attached to webContents#${webContents.id}`,
    );

    webContents.once("destroyed", () => {
      profiler.detach();
      rendererProfilers.delete(webContents.id);
    });
  }

  async function handleRendererStall(
    webContents: WebContents,
    payload: FrameStallDiagnosticPayload,
  ): Promise<void> {
    runtimeLog.write(
      "forensics",
      `renderer stall ${Math.round(payload.durationMs)}ms @ ${payload.detectedAt} (webContents#${webContents.id})`,
    );

    const profiler = rendererProfilers.get(webContents.id);

    if (profiler === undefined) {
      return;
    }

    const profile = await profiler.captureSlice();

    if (profile === null) {
      runtimeLog.write(
        "forensics",
        `renderer profile unavailable for webContents#${webContents.id}`,
      );
      return;
    }

    const filePath = writeCpuProfile(directory, "renderer-stall", profile, {
      detectedAt: payload.detectedAt,
      durationMs: payload.durationMs,
    });
    runtimeLog.write("forensics", `renderer profile saved → ${filePath}`);
  }

  const stallListener = (event: IpcMainEvent, payload: unknown): void => {
    if (!isFrameStallPayload(payload)) {
      return;
    }

    void handleRendererStall(event.sender, payload);
  };
  ipcMain.on(DIAGNOSTICS_CHANNELS.frameStall, stallListener);

  function enable(): void {
    if (enabled) {
      return;
    }

    enabled = true;
    mainProfiler = createMainProcessProfiler(
      CPU_PROFILER_SAMPLING_INTERVAL_MICROS,
      (error) => {
        runtimeLog.writeError("forensics-main-profiler", error);
      },
    );
    mainProfiler.start();
    metricsSampler = startAppMetricsSampler(
      runtimeLog,
      APP_METRICS_SAMPLE_INTERVAL_MS,
    );
    mainStallDetector = startMainStallDetector({
      thresholdMs: FORENSICS_STALL_THRESHOLD_MS,
      pollIntervalMs: MAIN_STALL_POLL_INTERVAL_MS,
      onStall: (durationMs) => {
        const detectedAt = new Date().toISOString();
        runtimeLog.write(
          "forensics",
          `main-thread stall ${Math.round(durationMs)}ms @ ${detectedAt}`,
        );
        void captureMainSlice(detectedAt, durationMs);
      },
    });
    runtimeLog.write(
      "forensics",
      `recorder enabled (threshold=${FORENSICS_STALL_THRESHOLD_MS}ms) → ${directory}`,
    );
  }

  function disable(): void {
    if (!enabled) {
      return;
    }

    enabled = false;
    mainStallDetector?.stop();
    mainStallDetector = null;
    metricsSampler?.stop();
    metricsSampler = null;
    mainProfiler?.stop();
    mainProfiler = null;

    for (const profiler of rendererProfilers.values()) {
      profiler.detach();
    }

    rendererProfilers.clear();
    runtimeLog.write("forensics", "recorder disabled");
  }

  return {
    isEnabled: (): boolean => enabled,
    enable,
    disable,
    attachWindow,
    dispose: (): void => {
      ipcMain.removeListener(DIAGNOSTICS_CHANNELS.frameStall, stallListener);
      disable();
    },
  };
}
