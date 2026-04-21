import type { SearchAddon } from "@xterm/addon-search";
import type { Terminal } from "@xterm/xterm";
import {
  createTerminalSearchDecorations,
  readThemeVariable,
  terminalThemeFallbacks,
} from "../terminal-theme";
import type { TerminalSearchRequest, TerminalSearchResults } from "./search-types";

interface TerminalSearchMatch {
  column: number;
  size: number;
  row: number;
}

interface TerminalSearchSegment {
  row: number;
  text: string;
}

export function updateTerminalSearchHighlights(
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

export function createTerminalSearchPreviewResults(
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

export function createTerminalSearchNavigationResults(
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
