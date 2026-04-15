import { useCallback, useEffect, useState } from "react";
import type {
  TerminalSearchDirection,
  TerminalSearchRequest,
  TerminalSearchResults,
} from "../search-types";

interface ActiveTerminalSearchState {
  focusRequestKey: number;
  isVisible: boolean;
  query: string;
  resultCount: number;
  resultIndex: number;
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
  "resultCount" | "resultIndex"
> {
  return {
    resultCount: 0,
    resultIndex: -1,
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
  resultCount: number;
  resultIndex: number;
} {
  const [isVisible, setIsVisible] = useState(false);
  const [query, setQueryState] = useState("");
  const [searchDirection, setSearchDirection] =
    useState<TerminalSearchDirection>("next");
  const [searchSequence, setSearchSequence] = useState(0);
  const [focusRequestKey, setFocusRequestKey] = useState(0);
  const [{ resultCount, resultIndex }, setResults] = useState(
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
    (direction: TerminalSearchDirection, nextQuery: string) => {
      if (focusedSessionId === null) {
        return;
      }

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
      issueSearch("next", nextQuery);
    },
    [issueSearch],
  );

  const findNext = useCallback(() => {
    issueSearch("next", query);
  }, [issueSearch, query]);

  const findPrevious = useCallback(() => {
    issueSearch("previous", query);
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
    setSearchSequence((currentValue) => currentValue + 1);
    setResults(createEmptyResults());
  }, [focusedSessionId, isVisible, query]);

  const onSearchResultsChange = useCallback(
    (results: TerminalSearchResults) => {
      if (results.sessionId !== focusedSessionId) {
        return;
      }

      setResults({
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
    isVisible,
    onSearchResultsChange,
    openSearch,
    query,
    resultCount,
    resultIndex,
    searchRequest:
      isVisible && focusedSessionId !== null
        ? {
            direction: searchDirection,
            query,
            sequence: searchSequence,
            sessionId: focusedSessionId,
          }
        : null,
    setQuery,
  };
}
