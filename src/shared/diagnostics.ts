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

export const RUNTIME_DIAGNOSTIC_CONSOLE_PREFIX = "[runtime:";

export const DIAGNOSTICS_CHANNELS: {
  rendererEvent: string;
  runtimeEvent: string;
} = {
  rendererEvent: "diagnostics:renderer-event",
  runtimeEvent: "diagnostics:runtime-event",
};
