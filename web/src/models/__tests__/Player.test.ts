import { describe, expect, it } from "vitest";
import { parsePlayer } from "../Player";
import { parseGame } from "../Game";

describe("parsePlayer", () => {
  it("keeps known string fields and drops unknown ones", () => {
    const p = parsePlayer("p1", { name: "Ada", bio: "hi", email: "a@b.c", colorData: 7 });
    expect(p).toEqual({ id: "p1", name: "Ada", bio: "hi" });
  });
});

describe("parseGame", () => {
  it("defaults flags so rule checks never see undefined", () => {
    const g = parseGame("g1", { title: "Chess" });
    expect(g.isBinaryScore).toBe(false);
    expect(g.highestScoreWins).toBe(true);
    expect(g.supportedPlayerCounts).toEqual([]);
  });
});
