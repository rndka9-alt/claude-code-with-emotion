import type { Terminal } from "@xterm/xterm";

export interface TerminalSize {
  cols: number;
  rows: number;
}

export interface TerminalPinnedViewportMetrics {
  cellHeightPx: number;
  cursorViewportRow: number;
  terminalRows: number;
  visibleRowCount: number;
  viewportStartRow: number;
}

export interface TerminalPinnedViewportSnapshot {
  lineTexts: string[];
  metrics: TerminalPinnedViewportMetrics | null;
  pinSuggestionVersion: number;
}

export function isModifierOnlyKey(key: string): boolean {
  return (
    key === "Alt" ||
    key === "CapsLock" ||
    key === "Control" ||
    key === "Fn" ||
    key === "Meta" ||
    key === "NumLock" ||
    key === "ScrollLock" ||
    key === "Shift"
  );
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNestedNumber(value: unknown, keys: string[]): number | null {
  let current: unknown = value;

  for (const key of keys) {
    if (!isObjectRecord(current)) {
      return null;
    }

    current = current[key];
  }

  return typeof current === "number" && Number.isFinite(current)
    ? current
    : null;
}

export function getTerminalSize(terminal: Terminal): TerminalSize {
  return {
    cols: Math.max(2, terminal.cols),
    rows: Math.max(1, terminal.rows),
  };
}

export function isTerminalViewportPinnedToBottom(terminal: Terminal): boolean {
  const activeBuffer = terminal.buffer.active;

  return activeBuffer.viewportY === activeBuffer.baseY;
}

function readTerminalCellDimensions(
  terminal: Terminal,
): { height: number; width: number } | null {
  const core = Reflect.get(terminal, "_core");
  const cellWidth = readNestedNumber(core, [
    "_renderService",
    "dimensions",
    "css",
    "cell",
    "width",
  ]);
  const cellHeight = readNestedNumber(core, [
    "_renderService",
    "dimensions",
    "css",
    "cell",
    "height",
  ]);

  if (
    cellWidth === null ||
    cellHeight === null ||
    cellWidth <= 0 ||
    cellHeight <= 0
  ) {
    return null;
  }

  return {
    height: cellHeight,
    width: cellWidth,
  };
}

export function arePinnedViewportMetricsEqual(
  left: TerminalPinnedViewportMetrics | null,
  right: TerminalPinnedViewportMetrics | null,
): boolean {
  if (left === right) {
    return true;
  }

  if (left === null || right === null) {
    return false;
  }

  return (
    left.cellHeightPx === right.cellHeightPx &&
    left.cursorViewportRow === right.cursorViewportRow &&
    left.terminalRows === right.terminalRows &&
    left.visibleRowCount === right.visibleRowCount &&
    left.viewportStartRow === right.viewportStartRow
  );
}

export function createPinnedViewportLineTexts(terminal: Terminal): string[] {
  const activeBuffer = terminal.buffer.active;
  const absoluteCursorRow = activeBuffer.baseY + activeBuffer.cursorY;
  const maxStartRow = Math.max(0, activeBuffer.length - 5);
  const startRow = Math.max(0, Math.min(absoluteCursorRow - 2, maxStartRow));
  const lineTexts: string[] = [];

  for (let rowOffset = 0; rowOffset < 5; rowOffset += 1) {
    const line = activeBuffer.getLine(startRow + rowOffset);

    lineTexts.push(line === undefined ? "" : line.translateToString());
  }

  return lineTexts;
}

export function createPinnedViewportMetrics(
  terminal: Terminal,
): TerminalPinnedViewportMetrics | null {
  const cellDimensions = readTerminalCellDimensions(terminal);

  if (cellDimensions === null) {
    return null;
  }

  const activeBuffer = terminal.buffer.active;
  const absoluteCursorRow = activeBuffer.baseY + activeBuffer.cursorY;
  const visibleRowCount = Math.max(1, Math.min(5, activeBuffer.length));
  const maxStartRow = Math.max(0, activeBuffer.length - visibleRowCount);
  const viewportStartRow = Math.max(
    0,
    Math.min(absoluteCursorRow - 2, maxStartRow),
  );

  return {
    cellHeightPx: cellDimensions.height,
    cursorViewportRow: activeBuffer.cursorY,
    terminalRows: Math.max(1, terminal.rows),
    visibleRowCount,
    viewportStartRow,
  };
}

function measureTerminalSize(
  terminal: Terminal,
  host: HTMLDivElement,
): TerminalSize | null {
  const core = Reflect.get(terminal, "_core");
  const cellDimensions = readTerminalCellDimensions(terminal);

  if (cellDimensions === null) {
    return null;
  }

  const scrollBarWidth =
    terminal.options.scrollback === 0
      ? 0
      : (readNestedNumber(core, ["viewport", "scrollBarWidth"]) ?? 0);
  const cols = Math.max(
    2,
    Math.floor((host.clientWidth - scrollBarWidth) / cellDimensions.width),
  );
  const rows = Math.max(
    1,
    Math.floor(host.clientHeight / cellDimensions.height),
  );

  return {
    cols,
    rows,
  };
}

export function fitTerminalViewport(
  terminal: Terminal,
  host: HTMLDivElement,
  sessionId: string,
  reason: string,
): TerminalSize | null {
  try {
    const nextSize = measureTerminalSize(terminal, host);

    if (nextSize === null) {
      return null;
    }

    const wasViewportPinnedToBottom =
      terminal.cols !== nextSize.cols || terminal.rows !== nextSize.rows
        ? isTerminalViewportPinnedToBottom(terminal)
        : false;

    if (terminal.cols !== nextSize.cols || terminal.rows !== nextSize.rows) {
      terminal.resize(nextSize.cols, nextSize.rows);

      if (
        wasViewportPinnedToBottom &&
        !isTerminalViewportPinnedToBottom(terminal)
      ) {
        // Keep the prompt anchored to the visible bottom after pane resizes.
        terminal.scrollToBottom();
      }
    }

    return nextSize;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown terminal fit error";

    console.warn(
      `Skipped terminal fit for ${sessionId} during ${reason}: ${message}`,
    );
    return null;
  }
}
