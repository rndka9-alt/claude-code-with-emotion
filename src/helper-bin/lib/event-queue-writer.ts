import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// 메인 프로세스가 폴링하는 이벤트 큐에 단일 이벤트를 원자적으로 쓴다.
// .tmp 로 먼저 쓰고 .json 으로 rename 하여, 폴링 측이 부분 기록을 읽는 경합을 막는다.
export function writeQueueEvent(queueDir: string, payload: unknown): void {
  if (!fs.existsSync(queueDir)) {
    throw new Error(`Event queue directory does not exist: ${queueDir}`);
  }

  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString("hex");
  const baseName = `${timestamp}-${random}`;
  const tmpPath = path.join(queueDir, `${baseName}.tmp`);
  const finalPath = path.join(queueDir, `${baseName}.json`);

  fs.writeFileSync(tmpPath, JSON.stringify(payload), "utf8");
  fs.renameSync(tmpPath, finalPath);
}
