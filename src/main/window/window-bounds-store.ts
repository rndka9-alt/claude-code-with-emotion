import fs from "node:fs";
import path from "node:path";

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_BOUNDS: WindowBounds = {
  x: -1,
  y: -1,
  width: 920,
  height: 680,
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseWindowBoundsFromDisk(
  filePath: string,
  logEvent?: (message: string) => void,
): WindowBounds | null {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    const parsed: unknown = JSON.parse(text);

    if (
      !isObjectRecord(parsed) ||
      !isFiniteNumber(parsed.x) ||
      !isFiniteNumber(parsed.y) ||
      !isFiniteNumber(parsed.width) ||
      !isFiniteNumber(parsed.height)
    ) {
      logEvent?.("window bounds on disk had an invalid shape");
      return null;
    }

    return {
      x: parsed.x,
      y: parsed.y,
      width: parsed.width,
      height: parsed.height,
    };
  } catch {
    return null;
  }
}

export class WindowBoundsStore {
  private bounds: WindowBounds | null;

  constructor(
    private readonly filePath: string,
    private readonly logEvent?: (message: string) => void,
  ) {
    this.bounds = parseWindowBoundsFromDisk(filePath, logEvent);
  }

  getBounds(): WindowBounds | null {
    return this.bounds;
  }

  save(bounds: WindowBounds): void {
    this.bounds = bounds;

    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(bounds, null, 2), "utf8");
    this.logEvent?.(
      `saved window bounds ${bounds.width}x${bounds.height} at (${bounds.x},${bounds.y})`,
    );
  }
}
