import { SessionWindowOwnership } from "./session-window-ownership";

describe("SessionWindowOwnership", () => {
  it("takes only the sessions owned by the given window", () => {
    const ownership = new SessionWindowOwnership();

    ownership.assignSessions(["session-1", "session-2"], 1);
    ownership.assignSessions(["session-3"], 2);

    expect(ownership.takeSessionsOwnedByWindow(1)).toEqual([
      "session-1",
      "session-2",
    ]);
    expect(ownership.takeSessionsOwnedByWindow(1)).toEqual([]);
    expect(ownership.takeSessionsOwnedByWindow(2)).toEqual(["session-3"]);
  });

  it("moves a session to the last assigned window", () => {
    const ownership = new SessionWindowOwnership();

    ownership.assignSessions(["session-1"], 1);
    ownership.assignSessions(["session-1"], 2);

    expect(ownership.takeSessionsOwnedByWindow(1)).toEqual([]);
    expect(ownership.takeSessionsOwnedByWindow(2)).toEqual(["session-1"]);
  });

  it("does not report a released session", () => {
    const ownership = new SessionWindowOwnership();

    ownership.assignSessions(["session-1", "session-2"], 1);
    ownership.releaseSession("session-1");

    expect(ownership.takeSessionsOwnedByWindow(1)).toEqual(["session-2"]);
  });
});
