import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "./App";

describe("App tab actions", () => {
  it("creates a new session tab and switches focus to it", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "New Session" }));

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(
      screen.getByRole("tab", {
        name: "new session 2 · claude-code-with-emotion",
      }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("tab", {
        name: "new session 2 · claude-code-with-emotion",
      }),
    ).toHaveAttribute("title", "new session 2 · claude-code-with-emotion");
  });

  it("creates a new session tab when cmd+t is pressed", () => {
    render(<App />);

    fireEvent.keyDown(window, {
      key: "t",
      metaKey: true,
    });

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(
      screen.getByRole("tab", {
        name: "new session 2 · claude-code-with-emotion",
      }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("does not create a new session tab when ctrl+t is pressed", () => {
    render(<App />);

    fireEvent.keyDown(window, {
      ctrlKey: true,
      key: "t",
    });

    expect(screen.getAllByRole("tab")).toHaveLength(1);
  });

  it("does not create a new session tab when cmd+shift+t is pressed", () => {
    render(<App />);

    fireEvent.keyDown(window, {
      key: "t",
      metaKey: true,
      shiftKey: true,
    });

    expect(screen.getAllByRole("tab")).toHaveLength(1);
  });

  it("moves focus to the previous tab when cmd+left is pressed", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "New Session" }));
    fireEvent.keyDown(window, {
      key: "ArrowLeft",
      metaKey: true,
    });

    expect(
      screen.getByRole("tab", {
        name: "new session 1 · claude-code-with-emotion",
      }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("does not move focus when ctrl+right is pressed", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "New Session" }));
    fireEvent.keyDown(window, {
      ctrlKey: true,
      key: "ArrowRight",
    });

    expect(
      screen.getByRole("tab", {
        name: "new session 2 · claude-code-with-emotion",
      }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("closes a tab from the tab strip close button", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Close new session 1 · claude-code-with-emotion",
      }),
    );

    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(
      screen.getByRole("tab", {
        name: "new session 2 · claude-code-with-emotion",
      }),
    ).toHaveAttribute("aria-selected", "true");
  });
});
