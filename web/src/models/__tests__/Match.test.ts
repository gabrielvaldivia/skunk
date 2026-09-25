import { describe, expect, it } from "vitest";
import { computeWinnerID, getMatchWinnerID, parseMatch, type Match } from "../Match";
import type { Game } from "../Game";

const baseGame: Game = {
  id: "g1",
  title: "Test",
  isBinaryScore: false,
  isTeamBased: false,
  supportedPlayerCounts: [2, 3, 4],
  countAllScores: false,
  countLosersOnly: false,
  highestScoreWins: true,
  highestRoundScoreWins: true,
  winningConditions: "game:highest|round:highest",
};

function match(overrides: Partial<Match>): Match {
  return {
    id: "m1",
    gameID: "g1",
    date: 1,
    playerIDs: ["c", "a", "b"],
    playerOrder: ["c", "a", "b"],
    isMultiplayer: true,
    status: "active",
    scores: [10, 30, 20],
    rounds: [],
    lastModified: 1,
    ...overrides,
  };
}

describe("computeWinnerID", () => {
  it("picks the highest score when highestScoreWins", () => {
    expect(computeWinnerID(match({}), baseGame)).toBe("a");
  });

  it("picks the lowest score when lowest wins", () => {
    expect(computeWinnerID(match({}), { ...baseGame, highestScoreWins: false })).toBe("c");
  });

  it("maps scores through playerOrder, not playerIDs", () => {
    const m = match({ playerIDs: ["a", "b", "c"], playerOrder: ["c", "a", "b"] });
    expect(computeWinnerID(m, baseGame)).toBe("a");
  });

  it("uses the player with score 1 for binary games", () => {
    const m = match({ scores: [0, 0, 1] });
    expect(computeWinnerID(m, { ...baseGame, isBinaryScore: true })).toBe("b");
  });

  it("aggregates team scores for team games", () => {
    const m = match({
      playerIDs: ["a", "b", "c", "d"],
      playerOrder: ["a", "b", "c", "d"],
      scores: [5, 5, 3, 8],
      teams: [
        { teamId: "t1", playerIDs: ["a", "b"] },
        { teamId: "t2", playerIDs: ["c", "d"] },
      ],
    });
    expect(computeWinnerID(m, { ...baseGame, isTeamBased: true })).toBe("t2");
  });
});

describe("getMatchWinnerID", () => {
  it("prefers the stored winner over recomputing from scores", () => {
    // Pre-fix matches have a sorted playerOrder that no longer lines up with scores
    const m = match({ playerOrder: ["a", "b", "c"], winnerID: "a" });
    expect(computeWinnerID(m, baseGame)).toBe("b");
    expect(getMatchWinnerID(m, baseGame)).toBe("a");
  });

  it("falls back to computing when nothing is stored", () => {
    expect(getMatchWinnerID(match({}), baseGame)).toBe("a");
  });

  it("uses the stored winning team for team games", () => {
    const m = match({ teams: [{ teamId: "t1", playerIDs: ["a"] }], winnerTeamId: "t9" });
    expect(getMatchWinnerID(m, { ...baseGame, isTeamBased: true })).toBe("t9");
  });
});

describe("parseMatch", () => {
  it("fills defaults for missing fields", () => {
    const m = parseMatch("x", { gameID: "g1", date: 5 });
    expect(m).toMatchObject({ id: "x", gameID: "g1", playerIDs: [], playerOrder: [], scores: [], rounds: [], lastModified: 5 });
  });

  it("falls back to playerIDs when playerOrder is missing", () => {
    expect(parseMatch("x", { playerIDs: ["a", "b"] }).playerOrder).toEqual(["a", "b"]);
  });

  it("accepts RTDB object-shaped arrays and drops bad values", () => {
    const m = parseMatch("x", { playerIDs: { 0: "a", 2: "b" }, scores: [1, "oops", 3] });
    expect(m.playerIDs).toEqual(["a", "b"]);
    expect(m.scores).toEqual([1, 0, 3]);
  });

  it("returns a safe object for garbage input", () => {
    expect(parseMatch("x", null).playerIDs).toEqual([]);
  });
});
