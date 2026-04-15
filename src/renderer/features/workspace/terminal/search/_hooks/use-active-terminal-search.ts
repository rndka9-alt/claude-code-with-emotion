import { useCallback, useEffect, useState } from "react";
import type {
  TerminalSearchDirection,
  TerminalSearchMode,
  TerminalSearchRequest,
  TerminalSearchResults,
} from "../search-types";

interface ActiveTerminalSearchState {
  focusRequestKey: number;
  hasMatch: boolean;
  isVisible: boolean;
  query: string;
  resultCount: number | null;
  resultIndex: number | null;
  searchRequest: TerminalSearchRequest | null;
}

function isOpenSearchShortcut(event: KeyboardEvent): boolean {
  return (
    event.isComposing !== true &&
    event.key.toLowerCase() === "f" &&
    event.metaKey &&
    !event.ctrlKey &&
    !event.altKey
  );
}

function createEmptyResults(): Pick<
  ActiveTerminalSearchState,
  "hasMatch" | "resultCount" | "resultIndex"
> {
  return {
    hasMatch: false,
    resultCount: null,
    resultIndex: null,
  };
}

export function useActiveTerminalSearch(
  focusedSessionId: string | null,
): {
  closeSearch: () => void;
  focusRequestKey: number;
  isVisible: boolean;
  onSearchResultsChange: (results: TerminalSearchResults) => void;
  openSearch: () => void;
  query: string;
  searchRequest: TerminalSearchRequest | null;
  setQuery: (query: string) => void;
  findNext: () => void;
  findPrevious: () => void;
  hasMatch: boolean;
  resultCount: number | null;
  resultIndex: number | null;
} {
  const [isVisible, setIsVisible] = useState(false);
  const [query, setQueryState] = useState("");
  const [searchMode, setSearchMode] = useState<TerminalSearchMode>("preview");
  const [searchDirection, setSearchDirection] =
    useState<TerminalSearchDirection>("next");
  const [searchSequence, setSearchSequence] = useState(0);
  const [focusRequestKey, setFocusRequestKey] = useState(0);
  const [{ hasMatch, resultCount, resultIndex }, setResults] = useState(
    createEmptyResults,
  );

  const openSearch = useCallback(() => {
    if (focusedSessionId === null) {
      return;
    }

    setIsVisible(true);
    setFocusRequestKey((currentValue) => currentValue + 1);
  }, [focusedSessionId]);

  const closeSearch = useCallback(() => {
    setIsVisible(false);
    setResults(createEmptyResults());
  }, []);

  const issueSearch = useCallback(
    (
      direction: TerminalSearchDirection,
      mode: TerminalSearchMode,
      nextQuery: string,
    ) => {
      if (focusedSessionId === null) {
        return;
      }

      setSearchMode(mode);
      setSearchDirection(direction);
      setSearchSequence((currentValue) => currentValue + 1);

      if (nextQuery.length === 0) {
        setResults(createEmptyResults());
      }
    },
    [focusedSessionId],
  );

  const setQuery = useCallback(
    (nextQuery: string) => {
      setQueryState(nextQuery);
      issueSearch("next", "preview", nextQuery);
    },
    [issueSearch],
  );

  const findNext = useCallback(() => {
    issueSearch("next", "navigate", query);
  }, [issueSearch, query]);

  const findPrevious = useCallback(() => {
    issueSearch("previous", "navigate", query);
  }, [issueSearch, query]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpenSearchShortcut(event)) {
        return;
      }

      if (event.repeat === true || event.shiftKey) {
        return;
      }

      event.preventDefault();
      openSearch();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openSearch]);

  useEffect(() => {
    const workspaceCommandsBridge = window.claudeApp?.workspaceCommands;

    if (workspaceCommandsBridge === undefined) {
      return;
    }

    return workspaceCommandsBridge.onOpenTerminalSearch(() => {
      openSearch();
    });
  }, [openSearch]);

  useEffect(() => {
    if (!isVisible || focusedSessionId === null || query.length === 0) {
      return;
    }

    setSearchDirection("next");
    setSearchMode("preview");
    setSearchSequence((currentValue) => currentValue + 1);
    setResults(createEmptyResults());
  }, [focusedSessionId, isVisible]);

  const onSearchResultsChange = useCallback(
    (results: TerminalSearchResults) => {
      if (results.sessionId !== focusedSessionId) {
        return;
      }

      setResults({
        hasMatch: results.hasMatch,
        resultCount: results.resultCount,
        resultIndex: results.resultIndex,
      });
    },
    [focusedSessionId],
  );

  return {
    closeSearch,
    findNext,
    findPrevious,
    focusRequestKey,
    hasMatch,
    isVisible,
    onSearchResultsChange,
    openSearch,
    query,
    resultCount,
    resultIndex,
    searchRequest:
      isVisible && focusedSessionId !== null
        ? {
            anchorIndex: resultIndex,
            direction: searchDirection,
            mode: searchMode,
            query,
            sequence: searchSequence,
            sessionId: focusedSessionId,
          }
        : null,
    setQuery,
  };
}
