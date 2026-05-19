import { ipcMain, type IpcMainEvent } from "electron";
import {
  DIAGNOSTICS_CHANNELS,
  type RendererDiagnosticPayload,
} from "../../shared/diagnostics";
import type { RuntimeLog } from "../diagnostics";

export function attachRendererDiagnosticListener(
  runtimeLog: RuntimeLog,
): () => void {
  const rendererDiagnosticListener = (
    _event: IpcMainEvent,
    payload: RendererDiagnosticPayload,
  ) => {
    const stackSuffix =
      typeof payload.stack === "string" && payload.stack.length > 0
        ? `\n${payload.stack}`
        : "";

    runtimeLog.write(
      "renderer-event",
      `${payload.type}: ${payload.message}${stackSuffix}`,
    );
  };

  ipcMain.on(DIAGNOSTICS_CHANNELS.rendererEvent, rendererDiagnosticListener);

  return () => {
    ipcMain.removeListener(
      DIAGNOSTICS_CHANNELS.rendererEvent,
      rendererDiagnosticListener,
    );
  };
}
