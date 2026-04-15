import { render, screen } from "@testing-library/react";
import { TerminalSearchBar } from "./TerminalSearchBar";

describe("TerminalSearchBar", () => {
  it("keeps the status blank before the user types a query", () => {
    render(
      <TerminalSearchBar
        focusRequestKey={0}
        onChangeQuery={vi.fn()}
        onClose={vi.fn()}
        onFindNext={vi.fn()}
        onFindPrevious={vi.fn()}
        query=""
        resultCount={null}
        resultIndex={null}
      />,
    );

    expect(screen.queryByText("No matches")).not.toBeInTheDocument();
    expect(screen.queryByText("Match found")).not.toBeInTheDocument();
  });

  it("shows a fallback match status when the addon cannot provide counts", () => {
    render(
      <TerminalSearchBar
        focusRequestKey={0}
        onChangeQuery={vi.fn()}
        onClose={vi.fn()}
        onFindNext={vi.fn()}
        onFindPrevious={vi.fn()}
        query="claude"
        resultCount={5}
        resultIndex={1}
      />,
    );

    expect(screen.getByText("2/5")).toBeInTheDocument();
  });

  it("shows a zeroed counter when no match exists for a non-empty query", () => {
    render(
      <TerminalSearchBar
        focusRequestKey={0}
        onChangeQuery={vi.fn()}
        onClose={vi.fn()}
        onFindNext={vi.fn()}
        onFindPrevious={vi.fn()}
        query="claude"
        resultCount={0}
        resultIndex={null}
      />,
    );

    expect(screen.getByText("0/0")).toBeInTheDocument();
  });
});
