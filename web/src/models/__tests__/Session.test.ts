import { describe, expect, it } from "vitest";
import { isSessionExpired, parseSession, SESSION_EXPIRY_HOURS } from "../Session";

const HOUR = 60 * 60 * 1000;

describe("isSessionExpired", () => {
  const session = parseSession("s1", { code: "ABC123", createdAt: 0, lastActivityAt: 0 });

  it("is active within the expiry window", () => {
    expect(isSessionExpired(session, (SESSION_EXPIRY_HOURS - 1) * HOUR)).toBe(false);
  });

  it("expires after the window since last activity", () => {
    expect(isSessionExpired(session, (SESSION_EXPIRY_HOURS + 1) * HOUR)).toBe(true);
  });
});

describe("parseSession", () => {
  it("defaults participants and lastActivityAt", () => {
    const s = parseSession("s1", { code: "ABC123", createdAt: 42 });
    expect(s.participantIDs).toEqual([]);
    expect(s.lastActivityAt).toBe(42);
  });
});
