import type { WebContents } from "electron";
import { extractCpuProfile } from "./cpu-profile";

export interface RendererDebuggerProfiler {
  // 현재까지 누적된 렌더러 프로파일을 받아오고 즉시 다음 구간 측정을 재개한다.
  captureSlice: () => Promise<unknown | null>;
  detach: () => void;
}

// 렌더러 프로세스 메인 스레드를 webContents.debugger(CDP)로 상시 샘플링한다.
// 렌더러 JS는 자기 스레드가 막힌 동안 스스로 콜스택을 뜰 수 없으므로,
// 메인 프로세스가 디버거를 붙여 외부에서 콜스택을 수집한다.
// 주의: 이 디버거가 붙은 창에서는 수동 DevTools Performance 프로파일링과 충돌할 수 있다.
export function attachRendererDebuggerProfiler(
  webContents: WebContents,
  samplingIntervalMicros: number,
  onError: (error: unknown) => void,
): RendererDebuggerProfiler | null {
  const webContentsDebugger = webContents.debugger;

  try {
    webContentsDebugger.attach("1.3");
  } catch (error) {
    onError(error);
    return null;
  }

  let running = false;

  void (async () => {
    try {
      await webContentsDebugger.sendCommand("Profiler.enable");
      await webContentsDebugger.sendCommand("Profiler.setSamplingInterval", {
        interval: samplingIntervalMicros,
      });
      await webContentsDebugger.sendCommand("Profiler.start");
      running = true;
    } catch (error) {
      onError(error);
    }
  })();

  async function captureSlice(): Promise<unknown | null> {
    if (!running || !webContentsDebugger.isAttached()) {
      return null;
    }

    try {
      const result = await webContentsDebugger.sendCommand("Profiler.stop");
      // 다음 stall 구간을 위해 즉시 측정을 재개한다.
      await webContentsDebugger.sendCommand("Profiler.start");

      return extractCpuProfile(result);
    } catch (error) {
      onError(error);
      return null;
    }
  }

  function detach(): void {
    running = false;

    if (!webContentsDebugger.isAttached()) {
      return;
    }

    try {
      webContentsDebugger.detach();
    } catch (error) {
      onError(error);
    }
  }

  return { captureSlice, detach };
}
