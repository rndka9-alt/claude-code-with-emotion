import { Search, ChevronDown, ChevronUp, X } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent, type ReactElement } from "react";

interface TerminalSearchBarProps {
  focusRequestKey: number;
  onChangeQuery: (query: string) => void;
  onClose: () => void;
  onFindNext: () => void;
  onFindPrevious: () => void;
  query: string;
  resultCount: number;
  resultIndex: number;
}

function formatSearchStatus(resultCount: number, resultIndex: number): string {
  if (resultCount <= 0) {
    return "No matches";
  }

  if (resultIndex < 0) {
    return `${resultCount} matches`;
  }

  return `${resultIndex + 1}/${resultCount}`;
}

export function TerminalSearchBar({
  focusRequestKey,
  onChangeQuery,
  onClose,
  onFindNext,
  onFindPrevious,
  query,
  resultCount,
  resultIndex,
}: TerminalSearchBarProps): ReactElement {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const input = inputRef.current;

    if (input === null) {
      return;
    }

    input.focus();
    input.select();
  }, [focusRequestKey]);

  const searchStatus = formatSearchStatus(resultCount, resultIndex);

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md border border-border-strong bg-surface-elevated px-2 py-1 shadow-[0_10px_24px_rgba(0,0,0,0.24)]">
      <Search aria-hidden="true" className="h-3.5 w-3.5 flex-none text-text-accent" />
      <input
        aria-label="Search terminal output"
        className="min-w-[11rem] flex-1 border-0 bg-transparent text-[0.8rem] text-text-highlight outline-none placeholder:text-text-subtle"
        onChange={(event) => {
          onChangeQuery(event.target.value);
        }}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
            return;
          }

          if (event.key !== "Enter") {
            return;
          }

          event.preventDefault();
          event.stopPropagation();

          if (event.shiftKey) {
            onFindPrevious();
            return;
          }

          onFindNext();
        }}
        placeholder="Find in terminal"
        ref={inputRef}
        spellCheck={false}
        type="text"
        value={query}
      />
      <span className="flex-none text-[0.72rem] text-text-subtle">{searchStatus}</span>
      <button
        aria-label="Previous match"
        className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-sm text-text-subtle transition-colors duration-150 hover:bg-surface-hover hover:text-text-highlight"
        onClick={onFindPrevious}
        type="button"
      >
        <ChevronUp aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <button
        aria-label="Next match"
        className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-sm text-text-subtle transition-colors duration-150 hover:bg-surface-hover hover:text-text-highlight"
        onClick={onFindNext}
        type="button"
      >
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <button
        aria-label="Close search"
        className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-sm text-text-subtle transition-colors duration-150 hover:bg-surface-hover hover:text-text-highlight"
        onClick={onClose}
        type="button"
      >
        <X aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
