import { App } from "./App";

describe("App module", () => {
  it("exports the application component", () => {
    expect(typeof App).toBe("function");
  });
});
