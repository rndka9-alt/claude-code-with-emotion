import fs from "node:fs";
import path from "node:path";

interface WriteVisualMcpStateOptions {
  eventQueueDir: string;
  traceFilePath: string;
  visualAssetCatalogFilePath: string;
  visualMcpStateFilePath: string;
}

export function writeVisualMcpState({
  eventQueueDir,
  traceFilePath,
  visualAssetCatalogFilePath,
  visualMcpStateFilePath,
}: WriteVisualMcpStateOptions): void {
  const nextState = {
    traceFilePath,
    visualAssetCatalogFilePath,
    eventQueueDir,
  };

  fs.mkdirSync(path.dirname(visualMcpStateFilePath), {
    recursive: true,
  });
  fs.writeFileSync(
    visualMcpStateFilePath,
    JSON.stringify(nextState, null, 2),
    "utf8",
  );
}
