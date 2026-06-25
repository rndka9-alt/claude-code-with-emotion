import { Session } from "node:inspector";

export interface MainProcessProfiler {
  start: () => void;
  // 현재까지 누적된 프로파일을 받아오고 즉시 다음 구간 측정을 재개한다.
  // 반환된 profile은 .cpuprofile로 저장 가능한 JSON. 실패하면 null.
  captureSlice: () => Promise<unknown | null>;
  stop: () => void;
}

// 메인 프로세스(이벤트 루프) 자신을 V8 CPU 프로파일러로 상시 샘플링한다.
// 메인 스레드가 막힌 동안에도 inspector는 별도 채널로 콜스택을 수집하므로,
// stall 직후 captureSlice로 그 구간의 콜스택 트리를 꺼낼 수 있다.
export function createMainProcessProfiler(
  samplingIntervalMicros: number,
  onError: (error: unknown) => void,
): MainProcessProfiler {
  const session = new Session();
  let running = false;

  function start(): void {
    if (running) {
      return;
    }

    try {
      session.connect();
      session.post("Profiler.enable");
      session.post("Profiler.setSamplingInterval", {
        interval: samplingIntervalMicros,
      });
      session.post("Profiler.start");
      running = true;
    } catch (error) {
      onError(error);
    }
  }

  async function captureSlice(): Promise<unknown | null> {
    if (!running) {
      return null;
    }

    try {
      const profile = await new Promise<unknown>((resolve, reject) => {
        session.post("Profiler.stop", (error, result) => {
          if (error !== null) {
            reject(error);
            return;
          }

          resolve(result.profile);
        });
      });

      // 다음 stall 구간을 위해 즉시 측정을 재개한다.
      session.post("Profiler.start");

      return profile;
    } catch (error) {
      onError(error);
      running = false;
      return null;
    }
  }

  function stop(): void {
    if (!running) {
      return;
    }

    session.post("Profiler.stop", () => {
      // 마지막 stop 결과는 버린다. 종료 경로이므로 저장하지 않는다.
    });
    running = false;
    session.disconnect();
  }

  return { start, captureSlice, stop };
}
