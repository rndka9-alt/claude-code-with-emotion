import { app } from "electron";
import type { RuntimeLog } from "../runtime-log";

export interface AppMetricsSampler {
  stop: () => void;
}

// app.getAppMetrics()로 프로세스별(메인/렌더러/GPU/유틸리티) CPU·메모리를 주기 기록한다.
// stall 시점의 프로파일과 이 추세를 대조하면 "어느 프로세스가 튀는지"까지 좁힐 수 있다.
export function startAppMetricsSampler(
  runtimeLog: RuntimeLog,
  intervalMs: number,
): AppMetricsSampler {
  const timer = setInterval(() => {
    const summary = app.getAppMetrics().map((metric) => {
      const cpuPercent = metric.cpu.percentCPUUsage.toFixed(1);
      // workingSetSize 단위는 KB이므로 MB로 환산해 읽기 쉽게 남긴다.
      const memoryMegabytes = (metric.memory.workingSetSize / 1024).toFixed(1);

      return `${metric.type}#${metric.pid} cpu=${cpuPercent}% mem=${memoryMegabytes}MB`;
    });

    runtimeLog.write("forensics-metrics", summary.join(" | "));
  }, intervalMs);

  // 메트릭 샘플러가 앱 종료를 막지 않도록 이벤트 루프 참조를 푼다.
  timer.unref();

  return {
    stop: (): void => {
      clearInterval(timer);
    },
  };
}
