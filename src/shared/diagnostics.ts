export interface RendererDiagnosticPayload {
  type: "window-error" | "unhandled-rejection";
  message: string;
  stack?: string;
}

export interface RuntimeDiagnosticPayload {
  scope: string;
  message: string;
  timestamp: string;
}

// 렌더러 메인 스레드가 임계 시간 이상 멈춘(프레임 정지) 사건.
// preload watchdog이 감지해 메인 forensics recorder에 신고한다.
export interface FrameStallDiagnosticPayload {
  // stall 지속 시간(밀리초) = 마지막 정상 프레임 이후 실제 경과 - 기대 프레임 간격.
  durationMs: number;
  // stall이 풀리며 감지된 시각(ISO 8601).
  detectedAt: string;
}

export const RUNTIME_DIAGNOSTIC_CONSOLE_PREFIX = "[runtime:";

export const DIAGNOSTICS_CHANNELS: {
  rendererEvent: string;
  runtimeEvent: string;
  frameStall: string;
} = {
  rendererEvent: "diagnostics:renderer-event",
  runtimeEvent: "diagnostics:runtime-event",
  frameStall: "diagnostics:frame-stall",
};
