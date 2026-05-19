import { Search, ChevronDown, ChevronUp, X } from "lucide-react";
import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type ReactElement,
} from "react";

interface TerminalSearchBarProps {
  focusRequestKey: number;
  onChangeQuery: (query: string) => void;
  onClose: () => void;
  onFindNext: () => void;
  onFindPrevious: () => void;
  query: string;
  resultCount: number | null;
  resultIndex: number | null;
}

function formatSearchStatus(
  query: string,
  resultCount: number | null,
  resultIndex: number | null,
): string {
  if (query.length === 0) {
    return "";
  }

  const totalCount = resultCount ?? 0;
  const currentIndex =
    resultIndex !== null && resultIndex >= 0 && totalCount > 0
      ? resultIndex + 1
      : 0;

  return `${currentIndex}/${totalCount}`;
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

  const searchStatus = formatSearchStatus(query, resultCount, resultIndex);

  return (
    <div className="border-border-strong bg-surface-elevated flex max-w-[min(32rem,calc(100vw-3rem))] min-w-[24rem] items-center gap-2 rounded-md border px-2 py-1 shadow-[0_10px_24px_rgba(0,0,0,0.24)]">
      <Search
        aria-hidden="true"
        className="text-text-accent h-3.5 w-3.5 flex-none"
      />
      <input
        aria-label="Search terminal output"
        className="text-text-highlight placeholder:text-text-subtle min-w-[11rem] flex-1 border-0 bg-transparent text-[0.8rem] outline-none"
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
      <span className="text-text-subtle flex-none text-[0.72rem]">
        {searchStatus}
      </span>
      <button
        aria-label="Previous match"
        className="text-text-subtle hover:bg-surface-hover hover:text-text-highlight inline-flex h-6 w-6 flex-none items-center justify-center rounded-sm transition-colors duration-150"
        onClick={onFindPrevious}
        type="button"
      >
        <ChevronUp aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <button
        aria-label="Next match"
        className="text-text-subtle hover:bg-surface-hover hover:text-text-highlight inline-flex h-6 w-6 flex-none items-center justify-center rounded-sm transition-colors duration-150"
        onClick={onFindNext}
        type="button"
      >
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <button
        aria-label="Close search"
        className="text-text-subtle hover:bg-surface-hover hover:text-text-highlight inline-flex h-6 w-6 flex-none items-center justify-center rounded-sm transition-colors duration-150"
        onClick={onClose}
        type="button"
      >
        <X aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
