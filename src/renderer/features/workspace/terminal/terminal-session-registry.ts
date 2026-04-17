import { SearchAddon } from "@xterm/addon-search";
import { Terminal, type ITheme } from "@xterm/xterm";
import type { TerminalOutputEvent } from "../../../../shared/terminal-bridge";
import { DEFAULT_TERMINAL_HISTORY_LINES } from "../../../../shared/terminal-history";
import { APP_THEME_FALLBACKS } from "../../../../shared/theme";
import type { TerminalSession } from "../model";
import { handleTerminalShortcut } from "./terminal-keyboard";
import type { TerminalSearchRequest, TerminalSearchResults } from "./search";

interface TerminalSize {
  cols: number;
  rows: number;
}

interface ScheduledTask {
  cancel: () => void;
}

interface RgbColor {
  alpha: number;
  blue: number;
  green: number;
  red: number;
}

interface TerminalSearchMatch {
  column: number;
  size: number;
  row: number;
}

interface TerminalSearchSegment {
  row: number;
  text: string;
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

export interface TerminalMirrorController {
  attach: (host: HTMLDivElement) => void;
  detach: () => void;
  dispose: () => void;
  focus: () => void;
  requestFit: (reason: string) => void;
  syncPinnedViewport: (
    metrics: TerminalPinnedViewportMetrics | null,
  ) => void;
  updateTheme: () => void;
}

const terminalThemeFallbacks = {
  background: APP_THEME_FALLBACKS.terminalBackground,
  foreground: APP_THEME_FALLBACKS.terminalForeground,
  brightBlue: APP_THEME_FALLBACKS.terminalBrightBlue,
  blue: APP_THEME_FALLBACKS.terminalBlue,
  green: APP_THEME_FALLBACKS.terminalGreen,
};

export interface TerminalSessionController {
  attach: (
    host: HTMLDivElement,
    onTitleChange: (tabId: string, title: string) => void,
  ) => void;
  createMirrorController: () => TerminalMirrorController;
  detach: () => void;
  focus: () => void;
  requestFit: (reason: string) => void;
  subscribePinnedViewport: (
    listener: (snapshot: TerminalPinnedViewportSnapshot) => void,
  ) => () => void;
  updateTheme: () => void;
  updateTitleChangeHandler: (
    onTitleChange: (tabId: string, title: string) => void,
  ) => void;
  dispose: () => void;
}

interface TerminalSessionControllerRecord extends TerminalSessionController {
  applySearch: (request: TerminalSearchRequest) => void;
  clearSearch: () => void;
  updateSearchResultsHandler: (
    onSearchResultsChange: ((results: TerminalSearchResults) => void) | null,
  ) => void;
}

interface TerminalMirrorControllerRecord extends TerminalMirrorController {
  writeOutput: (data: string) => void;
}

function isModifierOnlyKey(key: string): boolean {
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

function getTerminalSize(terminal: Terminal): TerminalSize {
  return {
    cols: Math.max(2, terminal.cols),
    rows: Math.max(1, terminal.rows),
  };
}

function isTerminalViewportPinnedToBottom(terminal: Terminal): boolean {
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

function arePinnedViewportMetricsEqual(
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

function createPinnedViewportLineTexts(terminal: Terminal): string[] {
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

function createPinnedViewportMetrics(
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

function fitTerminalViewport(
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

function scheduleTask(callback: () => void, delayMs: number): ScheduledTask {
  const timeoutId = window.setTimeout(callback, delayMs);

  return {
    cancel: () => {
      window.clearTimeout(timeoutId);
    },
  };
}

function createParkingLot(): HTMLDivElement {
  const parkingLot = document.createElement("div");

  parkingLot.setAttribute("aria-hidden", "true");
  parkingLot.dataset.terminalParkingLot = "true";
  parkingLot.style.position = "fixed";
  parkingLot.style.left = "-10000px";
  parkingLot.style.top = "0";
  parkingLot.style.width = "1px";
  parkingLot.style.height = "1px";
  parkingLot.style.overflow = "hidden";
  parkingLot.style.pointerEvents = "none";

  document.body.append(parkingLot);

  return parkingLot;
}

function createTerminalContainer(): HTMLDivElement {
  const container = document.createElement("div");

  container.className = "terminal-surface__instance";
  container.style.width = "100%";
  container.style.height = "100%";

  return container;
}

function isExternalBrowserHref(href: string): boolean {
  try {
    const protocol = new URL(href).protocol;

    return (
      protocol === "http:" || protocol === "https:" || protocol === "vscode:"
    );
  } catch {
    return false;
  }
}

export function handleTerminalExternalBrowserClick(
  event: Pick<MouseEvent, "defaultPrevented" | "preventDefault" | "target">,
  openExternal: ((url: string) => Promise<void>) | undefined,
): void {
  if (event.defaultPrevented || !(event.target instanceof Element)) {
    return;
  }

  const anchor = event.target.closest("a[href]");

  if (
    !(anchor instanceof HTMLAnchorElement) ||
    !isExternalBrowserHref(anchor.href)
  ) {
    return;
  }

  event.preventDefault();
  void openExternal?.(anchor.href);
}

const terminalSessionControllers = new Map<
  string,
  TerminalSessionControllerRecord
>();
let terminalParkingLot: HTMLDivElement | null = null;

function getParkingLot(): HTMLDivElement {
  if (
    terminalParkingLot === null ||
    !document.body.contains(terminalParkingLot)
  ) {
    terminalParkingLot = createParkingLot();
  }

  return terminalParkingLot;
}

function readThemeVariable(name: string, fallback: string): string {
  const root = document.documentElement;
  const value = window.getComputedStyle(root).getPropertyValue(name).trim();

  return value.length > 0 ? value : fallback;
}

function parseHexByte(value: string): number | null {
  const parsedValue = Number.parseInt(value, 16);

  return Number.isNaN(parsedValue) ? null : parsedValue;
}

function parseCssHexColor(value: string): RgbColor | null {
  const normalizedValue = value.trim();
  const shortHexMatch =
    /^#([\da-fA-F])([\da-fA-F])([\da-fA-F])([\da-fA-F])?$/.exec(
      normalizedValue,
    );

  if (shortHexMatch !== null) {
    const shortRed = shortHexMatch[1];
    const shortGreen = shortHexMatch[2];
    const shortBlue = shortHexMatch[3];
    const shortAlpha = shortHexMatch[4];

    if (
      shortRed === undefined ||
      shortGreen === undefined ||
      shortBlue === undefined
    ) {
      return null;
    }

    const red = parseHexByte(shortRed + shortRed);
    const green = parseHexByte(shortGreen + shortGreen);
    const blue = parseHexByte(shortBlue + shortBlue);
    const alpha =
      shortAlpha === undefined ? 255 : parseHexByte(shortAlpha + shortAlpha);

    if (red === null || green === null || blue === null || alpha === null) {
      return null;
    }

    return {
      alpha: alpha / 255,
      blue,
      green,
      red,
    };
  }

  const longHexMatch =
    /^#([\da-fA-F]{2})([\da-fA-F]{2})([\da-fA-F]{2})([\da-fA-F]{2})?$/.exec(
      normalizedValue,
    );

  if (longHexMatch !== null) {
    const longRed = longHexMatch[1];
    const longGreen = longHexMatch[2];
    const longBlue = longHexMatch[3];
    const longAlpha = longHexMatch[4];

    if (
      longRed === undefined ||
      longGreen === undefined ||
      longBlue === undefined
    ) {
      return null;
    }

    const red = parseHexByte(longRed);
    const green = parseHexByte(longGreen);
    const blue = parseHexByte(longBlue);
    const alpha = longAlpha === undefined ? 255 : parseHexByte(longAlpha);

    if (red === null || green === null || blue === null || alpha === null) {
      return null;
    }

    return {
      alpha: alpha / 255,
      blue,
      green,
      red,
    };
  }

  return null;
}

function parseCssRgbChannel(value: string): number | null {
  if (!/^\d+(\.\d+)?$/.test(value)) {
    return null;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0 || parsedValue > 255) {
    return null;
  }

  return parsedValue;
}

function parseCssAlphaChannel(value: string): number | null {
  if (!/^\d+(\.\d+)?$/.test(value)) {
    return null;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0 || parsedValue > 1) {
    return null;
  }

  return parsedValue;
}

function parseCssRgbColor(value: string): RgbColor | null {
  const match = /^rgba?\(([^)]+)\)$/.exec(value.trim());

  if (match === null) {
    return null;
  }

  const colorComponents = match[1];

  if (colorComponents === undefined) {
    return null;
  }

  const components = colorComponents
    .split(",")
    .map((component) => component.trim());

  if (components.length !== 3 && components.length !== 4) {
    return null;
  }

  const [redValue, greenValue, blueValue, alphaValue] = components;

  if (
    redValue === undefined ||
    greenValue === undefined ||
    blueValue === undefined
  ) {
    return null;
  }

  const red = parseCssRgbChannel(redValue);
  const green = parseCssRgbChannel(greenValue);
  const blue = parseCssRgbChannel(blueValue);
  const alpha = alphaValue === undefined ? 1 : parseCssAlphaChannel(alphaValue);

  if (red === null || green === null || blue === null || alpha === null) {
    return null;
  }

  return {
    alpha,
    blue,
    green,
    red,
  };
}

function parseCssColor(value: string): RgbColor | null {
  if (!value.startsWith("#") && !value.startsWith("rgb")) {
    return null;
  }

  return value.startsWith("#")
    ? parseCssHexColor(value)
    : parseCssRgbColor(value);
}

function toLinearColorChannel(value: number): number {
  const normalizedValue = value / 255;

  return normalizedValue <= 0.04045
    ? normalizedValue / 12.92
    : ((normalizedValue + 0.055) / 1.055) ** 2.4;
}

function isLightColor(value: string): boolean {
  const color = parseCssColor(value);

  if (color === null) {
    return false;
  }

  const luminance =
    0.2126 * toLinearColorChannel(color.red) +
    0.7152 * toLinearColorChannel(color.green) +
    0.0722 * toLinearColorChannel(color.blue);

  return luminance >= 0.6;
}

function createTerminalSelectionTheme(
  background: string,
): Pick<
  ITheme,
  "selectionBackground" | "selectionForeground" | "selectionInactiveBackground"
> {
  if (isLightColor(background)) {
    return {
      selectionBackground: "rgba(34, 78, 156, 0.42)",
      selectionForeground: "#fffaf2",
      selectionInactiveBackground: "rgba(34, 78, 156, 0.28)",
    };
  }

  return {
    selectionBackground: "rgba(155, 209, 255, 0.34)",
    selectionForeground: "#f7fbff",
    selectionInactiveBackground: "rgba(155, 209, 255, 0.24)",
  };
}

function createTerminalTheme(): ITheme {
  const background = readThemeVariable(
    "--color-surface-terminal-theme",
    terminalThemeFallbacks.background,
  );

  return {
    background,
    foreground: readThemeVariable(
      "--color-terminal-foreground",
      terminalThemeFallbacks.foreground,
    ),
    brightBlue: readThemeVariable(
      "--color-terminal-bright-blue",
      terminalThemeFallbacks.brightBlue,
    ),
    blue: readThemeVariable(
      "--color-terminal-blue",
      terminalThemeFallbacks.blue,
    ),
    green: readThemeVariable(
      "--color-terminal-green",
      terminalThemeFallbacks.green,
    ),
    ...createTerminalSelectionTheme(background),
  };
}

function createTerminalSearchDecorations(background: string): {
  activeMatchBackground: string;
  activeMatchBorder: string;
  activeMatchColorOverviewRuler: string;
  matchBackground: string;
  matchBorder: string;
  matchOverviewRuler: string;
} {
  if (isLightColor(background)) {
    return {
      activeMatchBackground: "#224E9C",
      activeMatchBorder: "#163A78",
      activeMatchColorOverviewRuler: "#163A78",
      matchBackground: "#E6C56F",
      matchBorder: "#B88719",
      matchOverviewRuler: "#B88719",
    };
  }

  return {
    activeMatchBackground: "#7DB4FF",
    activeMatchBorder: "#A9CEFF",
    activeMatchColorOverviewRuler: "#A9CEFF",
    matchBackground: "#37537A",
    matchBorder: "#6FA7F5",
    matchOverviewRuler: "#6FA7F5",
  };
}

function updateTerminalSearchHighlights(
  terminal: Terminal,
  searchAddon: SearchAddon,
  query: string,
): void {
  if (query.length === 0) {
    searchAddon.clearDecorations();
    searchAddon.clearActiveDecoration();
    terminal.clearSelection();
    return;
  }

  const background = readThemeVariable(
    "--color-surface-terminal-theme",
    terminalThemeFallbacks.background,
  );
  const previewSearch = Reflect.get(searchAddon, "findNext");

  if (typeof previewSearch !== "function") {
    return;
  }

  Reflect.apply(previewSearch, searchAddon, [
    query,
    {
      decorations: createTerminalSearchDecorations(background),
      incremental: true,
    },
    { noScroll: true },
  ]);
  searchAddon.clearActiveDecoration();
  terminal.clearSelection();
}

function normalizeTerminalSearchQuery(query: string): string {
  return query.toLocaleLowerCase();
}

function findTerminalSearchMatchPosition(
  segments: TerminalSearchSegment[],
  logicalColumn: number,
  matchLength: number,
): TerminalSearchMatch | null {
  let remainingColumn = logicalColumn;

  for (const segment of segments) {
    if (remainingColumn < segment.text.length) {
      return {
        column: remainingColumn,
        size: matchLength,
        row: segment.row,
      };
    }

    remainingColumn -= segment.text.length;
  }

  return null;
}

function collectTerminalSearchMatchesFromSegments(
  segments: TerminalSearchSegment[],
  normalizedQuery: string,
): TerminalSearchMatch[] {
  const matches: TerminalSearchMatch[] = [];
  const logicalText = segments.map((segment) => segment.text).join("");
  const normalizedText = normalizeTerminalSearchQuery(logicalText);

  if (logicalText.length === 0 || normalizedText.length === 0) {
    return matches;
  }

  let searchStartIndex = 0;

  while (searchStartIndex <= normalizedText.length - normalizedQuery.length) {
    const matchIndex = normalizedText.indexOf(
      normalizedQuery,
      searchStartIndex,
    );

    if (matchIndex < 0) {
      break;
    }

    const matchLength = normalizedQuery.length;
    const matchPosition = findTerminalSearchMatchPosition(
      segments,
      matchIndex,
      matchLength,
    );

    if (matchPosition !== null) {
      matches.push(matchPosition);
    }

    searchStartIndex = matchIndex + 1;
  }

  return matches;
}

function collectTerminalSearchMatches(
  terminal: Terminal,
  query: string,
): TerminalSearchMatch[] {
  const normalizedQuery = normalizeTerminalSearchQuery(query);

  if (normalizedQuery.length === 0) {
    return [];
  }

  const matches: TerminalSearchMatch[] = [];
  const activeBuffer = terminal.buffer.active;
  let segments: TerminalSearchSegment[] = [];

  const flushSegments = (): void => {
    if (segments.length === 0) {
      return;
    }

    matches.push(
      ...collectTerminalSearchMatchesFromSegments(segments, normalizedQuery),
    );
    segments = [];
  };

  for (let rowIndex = 0; rowIndex < activeBuffer.length; rowIndex += 1) {
    const line = activeBuffer.getLine(rowIndex);

    if (line === undefined) {
      flushSegments();
      continue;
    }

    if (!line.isWrapped) {
      flushSegments();
    }

    segments.push({
      row: rowIndex,
      text: line.translateToString(false),
    });
  }

  flushSegments();

  return matches;
}

function getSelectedTerminalSearchIndex(
  terminal: Terminal,
  matches: TerminalSearchMatch[],
): number | null {
  const selectionPosition = terminal.getSelectionPosition();

  if (selectionPosition === undefined) {
    return null;
  }

  const selectedRow = selectionPosition.start.y - 1;
  const selectedColumn = selectionPosition.start.x - 1;

  for (const [matchIndex, match] of matches.entries()) {
    if (match.row === selectedRow && match.column === selectedColumn) {
      return matchIndex;
    }
  }

  return null;
}

function getPreviewTerminalSearchIndex(
  terminal: Terminal,
  matches: TerminalSearchMatch[],
): number | null {
  if (matches.length === 0) {
    return null;
  }

  const viewportRow = terminal.buffer.active.viewportY;
  const nextVisibleMatchIndex = matches.findIndex((match) => {
    return match.row >= viewportRow;
  });

  return nextVisibleMatchIndex >= 0 ? nextVisibleMatchIndex : 0;
}

function createTerminalSearchPreviewResults(
  terminal: Terminal,
  query: string,
  sessionId: string,
): TerminalSearchResults {
  if (query.length === 0) {
    return {
      hasMatch: false,
      resultCount: null,
      resultIndex: null,
      sessionId,
    };
  }

  const matches = collectTerminalSearchMatches(terminal, query);

  if (matches.length === 0) {
    return {
      hasMatch: false,
      resultCount: 0,
      resultIndex: null,
      sessionId,
    };
  }

  const previewIndex = getPreviewTerminalSearchIndex(terminal, matches);

  return {
    hasMatch: true,
    resultCount: matches.length,
    resultIndex: previewIndex,
    sessionId,
  };
}

function scrollTerminalSearchMatchIntoView(
  terminal: Terminal,
  match: TerminalSearchMatch,
): void {
  const viewportRow = terminal.buffer.active.viewportY;
  const viewportEndRow = viewportRow + terminal.rows;

  if (match.row >= viewportRow && match.row < viewportEndRow) {
    return;
  }

  let scrollDelta = match.row - viewportRow;
  scrollDelta -= Math.floor(terminal.rows / 2);
  terminal.scrollLines(scrollDelta);
}

function selectTerminalSearchMatch(
  terminal: Terminal,
  match: TerminalSearchMatch,
): void {
  terminal.select(match.column, match.row, match.size);
  scrollTerminalSearchMatchIntoView(terminal, match);
}

function createTerminalSearchNavigationResults(
  terminal: Terminal,
  request: TerminalSearchRequest,
  sessionId: string,
): TerminalSearchResults {
  if (request.query.length === 0) {
    return {
      hasMatch: false,
      resultCount: null,
      resultIndex: null,
      sessionId,
    };
  }

  const matches = collectTerminalSearchMatches(terminal, request.query);

  if (matches.length === 0) {
    terminal.clearSelection();

    return {
      hasMatch: false,
      resultCount: 0,
      resultIndex: null,
      sessionId,
    };
  }

  const selectedIndex = getSelectedTerminalSearchIndex(terminal, matches);
  const anchorIndex =
    request.anchorIndex !== null &&
    request.anchorIndex >= 0 &&
    request.anchorIndex < matches.length
      ? request.anchorIndex
      : null;

  if (anchorIndex === null && selectedIndex === null) {
    return {
      hasMatch: false,
      resultCount: 0,
      resultIndex: null,
      sessionId,
    };
  }

  let targetIndex = anchorIndex ?? 0;

  if (selectedIndex !== null) {
    targetIndex =
      request.direction === "previous"
        ? (selectedIndex - 1 + matches.length) % matches.length
        : (selectedIndex + 1) % matches.length;
  } else if (anchorIndex !== null) {
    targetIndex =
      request.direction === "previous"
        ? (anchorIndex - 1 + matches.length) % matches.length
        : (anchorIndex + 1) % matches.length;
  }

  const targetMatch = matches[targetIndex];

  if (targetMatch === undefined) {
    return {
      hasMatch: false,
      resultCount: 0,
      resultIndex: null,
      sessionId,
    };
  }

  selectTerminalSearchMatch(terminal, targetMatch);

  return {
    hasMatch: true,
    resultCount: matches.length,
    resultIndex: targetIndex,
    sessionId,
  };
}

function createTerminalSessionController(
  session: TerminalSession,
): TerminalSessionControllerRecord {
  const linksBridge = window.claudeApp?.links;
  const bridge = window.claudeApp?.terminals;
  const terminal = new Terminal({
    allowProposedApi: true,
    allowTransparency: true,
    convertEol: true,
    cursorBlink: true,
    fontFamily: '"SF Mono", "Menlo", monospace',
    fontSize: 13,
    lineHeight: 1.3,
    scrollback: DEFAULT_TERMINAL_HISTORY_LINES,
    theme: createTerminalTheme(),
    // OSC 8 하이퍼링크 클릭 시 기본 window.open 대신 shell.openExternal 사용
    linkHandler: {
      activate(_event, uri) {
        void linksBridge?.openExternal(uri);
      },
    },
  });
  const searchAddon = new SearchAddon();

  terminal.loadAddon(searchAddon);

  // 터미널 텍스트에서 URL을 감지해 Cmd+클릭으로 열 수 잇게 하는 링크 프로바이더
  const LINKABLE_URL_REGEX = /https?:\/\/[^\s)>\]"']+|vscode:\/\/[^\s)>\]"']+/g;
  const registerTerminalLinks = (targetTerminal: Terminal): void => {
    targetTerminal.registerLinkProvider({
      provideLinks(bufferLineNumber, callback) {
        const line = targetTerminal.buffer.active.getLine(bufferLineNumber);
        if (!line) {
          callback(undefined);
          return;
        }

        const text = line.translateToString();
        const links: Array<{
          range: {
            start: { x: number; y: number };
            end: { x: number; y: number };
          };
          text: string;
          activate: (_event: MouseEvent, linkText: string) => void;
        }> = [];

        LINKABLE_URL_REGEX.lastIndex = 0;
        let match;
        while ((match = LINKABLE_URL_REGEX.exec(text)) !== null) {
          const url = match[0];
          links.push({
            range: {
              start: { x: match.index + 1, y: bufferLineNumber },
              end: { x: match.index + url.length, y: bufferLineNumber },
            },
            text: url,
            activate(_event, linkText) {
              void linksBridge?.openExternal(linkText);
            },
          });
        }

        callback(links.length > 0 ? links : undefined);
      },
    });
  };

  registerTerminalLinks(terminal);

  const container = createTerminalContainer();
  const bufferedOutputEvents: TerminalOutputEvent[] = [];
  const mirrorControllers = new Set<TerminalMirrorControllerRecord>();
  const pinnedViewportListeners = new Set<
    (snapshot: TerminalPinnedViewportSnapshot) => void
  >();
  let pinnedViewportLineTexts = ["", "", "", "", ""];
  const replayOutputSegments: string[] = [];
  const scheduledTasks: ScheduledTask[] = [];
  let bootstrapCompleted = false;
  let bootstrapStarted = false;
  let disposed = false;
  let host: HTMLDivElement | null = null;
  let manualViewportInteractionAtMs = 0;
  let pinSuggestionVersion = 0;
  let pinnedViewportMetrics: TerminalPinnedViewportMetrics | null = null;
  let restoredOutputVersion = 0;
  let searchResultsChangeHandler:
    | ((results: TerminalSearchResults) => void)
    | null = null;
  let titleChangeHandler: ((tabId: string, title: string) => void) | null =
    null;
  let userScrolledAwayFromBottom = false;

  const emitSearchResults = (results: TerminalSearchResults): void => {
    searchResultsChangeHandler?.({
      ...results,
      sessionId: session.id,
    });
  };

  const emitPinnedViewportSnapshot = (): void => {
    const snapshot = {
      lineTexts: pinnedViewportLineTexts,
      metrics: pinnedViewportMetrics,
      pinSuggestionVersion,
    };

    for (const listener of pinnedViewportListeners) {
      listener(snapshot);
    }
  };

  const updatePinnedViewportMetrics = (): void => {
    const nextPinnedViewportMetrics =
      host === null ? null : createPinnedViewportMetrics(terminal);
    const nextPinnedViewportLineTexts =
      host === null
        ? ["", "", "", "", ""]
        : createPinnedViewportLineTexts(terminal);
    const didMetricsChange = !arePinnedViewportMetricsEqual(
      pinnedViewportMetrics,
      nextPinnedViewportMetrics,
    );
    const didLineTextsChange =
      pinnedViewportLineTexts.length !== nextPinnedViewportLineTexts.length ||
      pinnedViewportLineTexts.some((lineText, index) => {
        const nextLineText = nextPinnedViewportLineTexts[index];

        return nextLineText === undefined || lineText !== nextLineText;
      });

    if (!didMetricsChange && !didLineTextsChange) {
      return;
    }

    pinnedViewportMetrics = nextPinnedViewportMetrics;
    pinnedViewportLineTexts = nextPinnedViewportLineTexts;

    for (const mirrorController of mirrorControllers) {
      mirrorController.syncPinnedViewport(nextPinnedViewportMetrics);
    }

    emitPinnedViewportSnapshot();
  };

  const requestPinSuggestion = (): void => {
    pinSuggestionVersion += 1;
    emitPinnedViewportSnapshot();
  };

  const markManualViewportInteraction = (): void => {
    manualViewportInteractionAtMs = Date.now();
  };

  const appendReplayOutput = (data: string): void => {
    replayOutputSegments.push(data);
  };

  const writeTerminalOutput = (data: string): void => {
    appendReplayOutput(data);
    terminal.write(data, () => {
      updatePinnedViewportMetrics();

      for (const mirrorController of mirrorControllers) {
        mirrorController.writeOutput(data);
      }
    });
  };

  const focusTerminal = (): void => {
    terminal.focus();
  };
  const handleTerminalLinkClick = (event: MouseEvent): void => {
    handleTerminalExternalBrowserClick(event, linksBridge?.openExternal);
  };
  const syncTheme = (): void => {
    terminal.options.theme = createTerminalTheme();

    for (const mirrorController of mirrorControllers) {
      mirrorController.updateTheme();
    }
  };
  const removeOutputListener =
    bridge?.onOutput((event) => {
      if (event.sessionId !== session.id) {
        return;
      }

      if (!bootstrapCompleted) {
        bufferedOutputEvents.push(event);
        return;
      }

      applyOutputEvent(event);
    }) ?? (() => {});

  terminal.attachCustomKeyEventHandler((event) => {
    if (
      event.type === "keydown" &&
      !isModifierOnlyKey(event.key) &&
      !event.metaKey &&
      !isTerminalViewportPinnedToBottom(terminal)
    ) {
      userScrolledAwayFromBottom = false;
      requestPinSuggestion();
    }

    return handleTerminalShortcut(event, (data) => {
      if (bridge !== undefined) {
        void bridge.sendInput({ sessionId: session.id, data });
        return;
      }

      terminal.write("\r\n");
    });
  });

  const inputSubscription = terminal.onData((data) => {
    if (userScrolledAwayFromBottom) {
      userScrolledAwayFromBottom = false;
      requestPinSuggestion();
    }

    if (bridge !== undefined) {
      void bridge.sendInput({ sessionId: session.id, data });
    } else {
      terminal.write(data);
    }
  });
  const cursorMoveSubscription = terminal.onCursorMove(() => {
    updatePinnedViewportMetrics();
  });
  const scrollSubscription = terminal.onScroll(() => {
    if (Date.now() - manualViewportInteractionAtMs <= 250) {
      userScrolledAwayFromBottom = !isTerminalViewportPinnedToBottom(terminal);
    } else if (isTerminalViewportPinnedToBottom(terminal)) {
      userScrolledAwayFromBottom = false;
    }

    updatePinnedViewportMetrics();
  });
  const titleSubscription = terminal.onTitleChange((nextTitle) => {
    titleChangeHandler?.(session.id, nextTitle);
  });

  function clearSearchResults(): void {
    searchAddon.clearDecorations();
    terminal.clearSelection();
    emitSearchResults({
      hasMatch: false,
      resultCount: null,
      resultIndex: null,
      sessionId: session.id,
    });
  }

  function applySearch(request: TerminalSearchRequest): void {
    if (request.query.length === 0) {
      clearSearchResults();
      return;
    }

    if (request.mode === "preview") {
      updateTerminalSearchHighlights(terminal, searchAddon, request.query);
      emitSearchResults(
        createTerminalSearchPreviewResults(terminal, request.query, session.id),
      );
      return;
    }

    emitSearchResults(
      createTerminalSearchNavigationResults(terminal, request, session.id),
    );
  }

  function applyOutputEvent(event: TerminalOutputEvent): void {
    if (event.outputVersion <= restoredOutputVersion) {
      return;
    }

    restoredOutputVersion = event.outputVersion;
    writeTerminalOutput(event.data);
  }

  function flushBufferedOutput(): void {
    bufferedOutputEvents
      .sort((left, right) => left.outputVersion - right.outputVersion)
      .forEach((event) => {
        applyOutputEvent(event);
      });
    bufferedOutputEvents.length = 0;
  }

  function syncTerminalSize(): void {
    if (host === null || bridge === undefined) {
      return;
    }

    const nextSize = getTerminalSize(terminal);

    void bridge.resizeSession({
      sessionId: session.id,
      cols: nextSize.cols,
      rows: nextSize.rows,
    });
  }

  function bootstrapSession(size: TerminalSize): void {
    if (bridge === undefined || bootstrapStarted) {
      return;
    }

    bootstrapStarted = true;

    void bridge
      .bootstrapSession({
        sessionId: session.id,
        title: session.title,
        cwd: session.cwd,
        command: session.command,
        cols: size.cols,
        rows: size.rows,
      })
      .then((response) => {
        if (disposed) {
          return;
        }

        if (response.outputSnapshot.length > 0) {
          writeTerminalOutput(response.outputSnapshot);
        }

        restoredOutputVersion = response.outputVersion;
        bootstrapCompleted = true;
        flushBufferedOutput();
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Unknown bootstrap error";

        bootstrapCompleted = true;
        bufferedOutputEvents.length = 0;
        console.error(`Failed to bootstrap ${session.id}: ${message}`);
        writeTerminalOutput(
          `\r\n[terminal bootstrap failed for ${session.id}: ${message}]\r\n`,
        );
      });
  }

  function requestFit(reason: string): void {
    const task = scheduleTask(() => {
      if (disposed || host === null) {
        return;
      }

      const nextSize = fitTerminalViewport(terminal, host, session.id, reason);

      if (nextSize !== null) {
        syncTerminalSize();
        bootstrapSession(nextSize);
        updatePinnedViewportMetrics();
        return;
      }

      syncTerminalSize();

      if (disposed || host === null) {
        return;
      }

      const retryTask = scheduleTask(() => {
        if (disposed || host === null) {
          return;
        }

        const retrySize = fitTerminalViewport(
          terminal,
          host,
          session.id,
          `${reason}-retry`,
        );
        syncTerminalSize();
        bootstrapSession(retrySize ?? getTerminalSize(terminal));
        updatePinnedViewportMetrics();
      }, 32);

      scheduledTasks.push(retryTask);
    }, 0);

    scheduledTasks.push(task);
  }

  function createMirrorController(): TerminalMirrorControllerRecord {
    const mirrorTerminal = new Terminal({
      allowProposedApi: true,
      allowTransparency: true,
      cols: Math.max(2, terminal.cols),
      convertEol: true,
      cursorBlink: true,
      fontFamily: '"SF Mono", "Menlo", monospace',
      fontSize: 13,
      lineHeight: 1.3,
      rows: Math.max(1, terminal.rows),
      scrollback: DEFAULT_TERMINAL_HISTORY_LINES,
      theme: createTerminalTheme(),
      linkHandler: {
        activate(_event, uri) {
          void linksBridge?.openExternal(uri);
        },
      },
    });
    const mirrorContainer = createTerminalContainer();
    const mirrorScheduledTasks: ScheduledTask[] = [];
    const focusMirrorTerminal = (): void => {
      mirrorTerminal.focus();
    };
    const syncMirrorViewport = (
      _metrics: TerminalPinnedViewportMetrics | null,
    ): void => {
      // No-op: the mirror runs at primary terminal dimensions.
      // Visual clipping is handled by CSS transform in PinnedTerminalOverlay.
    };
    let mirrorDisposed = false;
    let mirrorHasReplayedOutput = false;
    let mirrorHost: HTMLDivElement | null = null;

    registerTerminalLinks(mirrorTerminal);

    mirrorTerminal.attachCustomKeyEventHandler((event) =>
      handleTerminalShortcut(event, (data) => {
        if (bridge !== undefined) {
          void bridge.sendInput({ sessionId: session.id, data });
          return;
        }

        mirrorTerminal.write("\r\n");
      }),
    );

    const mirrorInputSubscription = mirrorTerminal.onData((data) => {
      if (bridge !== undefined) {
        void bridge.sendInput({ sessionId: session.id, data });
      } else {
        mirrorTerminal.write(data);
      }
    });

    const requestMirrorFit = (_reason: string): void => {
      const task = scheduleTask(() => {
        if (mirrorDisposed) {
          return;
        }

        const primaryCols = Math.max(2, terminal.cols);
        const primaryRows = Math.max(1, terminal.rows);

        if (
          mirrorTerminal.cols !== primaryCols ||
          mirrorTerminal.rows !== primaryRows
        ) {
          mirrorTerminal.resize(primaryCols, primaryRows);
        }
      }, 0);

      mirrorScheduledTasks.push(task);
    };

    const mirrorController: TerminalMirrorControllerRecord = {
      attach(nextHost) {
        if (!mirrorContainer.isConnected) {
          nextHost.replaceChildren(mirrorContainer);
          mirrorTerminal.open(mirrorContainer);
        } else if (mirrorContainer.parentElement !== nextHost) {
          nextHost.replaceChildren(mirrorContainer);
        }

        mirrorHost = nextHost;
        mirrorHost.addEventListener("click", handleTerminalLinkClick, true);
        mirrorHost.addEventListener("mousedown", focusMirrorTerminal);
        mirrorHost.addEventListener("touchstart", focusMirrorTerminal, {
          passive: true,
        });

        if (!mirrorHasReplayedOutput) {
          const replayOutput = replayOutputSegments.join("");

          if (replayOutput.length > 0) {
            mirrorTerminal.write(replayOutput);
          }

          mirrorHasReplayedOutput = true;
        }

        syncMirrorViewport(pinnedViewportMetrics);
        requestMirrorFit("attach");
      },
      detach() {
        if (mirrorHost === null || mirrorDisposed) {
          return;
        }

        mirrorHost.removeEventListener("click", handleTerminalLinkClick, true);
        mirrorHost.removeEventListener("mousedown", focusMirrorTerminal);
        mirrorHost.removeEventListener("touchstart", focusMirrorTerminal);
        getParkingLot().append(mirrorContainer);
        mirrorHost = null;
      },
      dispose() {
        if (mirrorDisposed) {
          return;
        }

        this.detach();
        mirrorDisposed = true;

        for (const task of mirrorScheduledTasks) {
          task.cancel();
        }

        mirrorInputSubscription.dispose();
        mirrorTerminal.dispose();
        mirrorContainer.remove();
        mirrorControllers.delete(mirrorController);
      },
      focus() {
        mirrorTerminal.focus();
      },
      requestFit: requestMirrorFit,
      syncPinnedViewport(metrics) {
        syncMirrorViewport(metrics);
      },
      updateTheme() {
        mirrorTerminal.options.theme = createTerminalTheme();
      },
      writeOutput(data) {
        if (!mirrorHasReplayedOutput) {
          return;
        }

        mirrorTerminal.write(data);
        syncMirrorViewport(pinnedViewportMetrics);
      },
    };

    mirrorControllers.add(mirrorController);

    return mirrorController;
  }

  return {
    attach(nextHost, onTitleChange) {
      titleChangeHandler = onTitleChange;

      if (!container.isConnected) {
        nextHost.replaceChildren(container);
        terminal.open(container);
      } else if (container.parentElement !== nextHost) {
        nextHost.replaceChildren(container);
      }

      host = nextHost;
      host.addEventListener("click", handleTerminalLinkClick, true);
      host.addEventListener("mousedown", focusTerminal);
      host.addEventListener("mousedown", markManualViewportInteraction);
      host.addEventListener("touchstart", focusTerminal, { passive: true });
      host.addEventListener("touchmove", markManualViewportInteraction, {
        passive: true,
      });
      host.addEventListener("wheel", markManualViewportInteraction, {
        passive: true,
      });
      requestFit("attach");
      updatePinnedViewportMetrics();

      if (bridge === undefined) {
        writeTerminalOutput(
          `No preload bridge detected for ${session.title}\r\n` +
            "The xterm surface is mounted, but Electron IPC is unavailable.\r\n",
        );
      }
    },
    createMirrorController,
    detach() {
      if (host === null || disposed) {
        return;
      }

      host.removeEventListener("click", handleTerminalLinkClick, true);
      host.removeEventListener("mousedown", focusTerminal);
      host.removeEventListener("mousedown", markManualViewportInteraction);
      host.removeEventListener("touchstart", focusTerminal);
      host.removeEventListener("touchmove", markManualViewportInteraction);
      host.removeEventListener("wheel", markManualViewportInteraction);
      getParkingLot().append(container);
      host = null;
      pinnedViewportMetrics = null;
      pinnedViewportLineTexts = ["", "", "", "", ""];
      emitPinnedViewportSnapshot();
    },
    focus() {
      focusTerminal();
    },
    requestFit,
    subscribePinnedViewport(listener) {
      pinnedViewportListeners.add(listener);
      listener({
        lineTexts: pinnedViewportLineTexts,
        metrics: pinnedViewportMetrics,
        pinSuggestionVersion,
      });

      return () => {
        pinnedViewportListeners.delete(listener);
      };
    },
    updateTheme() {
      syncTheme();
    },
    updateTitleChangeHandler(onTitleChange) {
      titleChangeHandler = onTitleChange;
    },
    applySearch,
    clearSearch() {
      clearSearchResults();
    },
    updateSearchResultsHandler(onSearchResultsChange) {
      searchResultsChangeHandler = onSearchResultsChange;
    },
    dispose() {
      if (disposed) {
        return;
      }

      this.detach();
      disposed = true;

      for (const task of scheduledTasks) {
        task.cancel();
      }

      removeOutputListener();
      cursorMoveSubscription.dispose();
      inputSubscription.dispose();
      scrollSubscription.dispose();
      titleSubscription.dispose();

      for (const mirrorController of [...mirrorControllers]) {
        mirrorController.dispose();
      }

      terminal.dispose();
      container.remove();
    },
  };
}

export function getTerminalSessionController(
  session: TerminalSession,
): TerminalSessionController {
  const existingController = terminalSessionControllers.get(session.id);

  if (existingController !== undefined) {
    return existingController;
  }

  const controller = createTerminalSessionController(session);

  terminalSessionControllers.set(session.id, controller);

  return controller;
}

export function applyTerminalSessionSearch(
  session: TerminalSession,
  request: TerminalSearchRequest,
): void {
  const controller = terminalSessionControllers.get(session.id);

  if (controller === undefined) {
    return;
  }

  controller.applySearch(request);
}

export function clearTerminalSessionSearch(session: TerminalSession): void {
  const controller = terminalSessionControllers.get(session.id);

  if (controller === undefined) {
    return;
  }

  controller.clearSearch();
}

export function updateTerminalSessionSearchResultsHandler(
  session: TerminalSession,
  onSearchResultsChange: ((results: TerminalSearchResults) => void) | null,
): void {
  const controller = terminalSessionControllers.get(session.id);

  if (controller === undefined) {
    return;
  }

  controller.updateSearchResultsHandler(onSearchResultsChange);
}

export function disposeTerminalSession(sessionId: string): void {
  const controller = terminalSessionControllers.get(sessionId);

  if (controller === undefined) {
    return;
  }

  controller.dispose();
  terminalSessionControllers.delete(sessionId);
}

export function disposeTerminalSessionsExcept(sessionIds: string[]): void {
  const activeSessionIds = new Set(sessionIds);

  for (const sessionId of [...terminalSessionControllers.keys()]) {
    if (activeSessionIds.has(sessionId)) {
      continue;
    }

    disposeTerminalSession(sessionId);
  }
}

export function disposeAllTerminalSessions(): void {
  for (const sessionId of [...terminalSessionControllers.keys()]) {
    disposeTerminalSession(sessionId);
  }

  terminalParkingLot?.remove();
  terminalParkingLot = null;
}

export function syncAllTerminalThemes(): void {
  for (const controller of terminalSessionControllers.values()) {
    controller.updateTheme();
  }
}
