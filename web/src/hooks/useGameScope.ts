import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useActivity } from "./useActivity";
import type { Game } from "../models/Game";

export type GameScope = "mine" | "all";

/** My Games vs All Games, kept in the URL (?scope=) so it survives reloads */
export function useGameScope() {
  const { isAuthenticated } = useAuth();
  const [params, setParams] = useSearchParams();
  const raw = params.get("scope");
  // Signed-in people land on their own games; everyone else on the catalogue
  const scope: GameScope = raw === "mine" || raw === "all" ? raw : isAuthenticated ? "mine" : "all";
  const setScope = useCallback(
    (next: GameScope) =>
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set("scope", next);
          return p;
        },
        { replace: true }
      ),
    [setParams]
  );
  return [scope, setScope] as const;
}

/** Ids of games you've added or played in */
export function useMyGameIds(games: Game[]) {
  const { user, player } = useAuth();
  const { matches, isLoading } = useActivity(10000);
  const ids = useMemo(() => {
    const ids = new Set<string>();
    if (!user) return ids;
    // Games added under any of your logins (merged accounts have several)
    const logins = new Set([user.uid, player?.googleUserID, ...Object.keys(player?.linkedGoogleUserIDs ?? {})]);
    for (const g of games) if (g.createdByID && logins.has(g.createdByID)) ids.add(g.id);
    if (player) {
      for (const m of matches) {
        if (m.gameID && m.playerIDs.includes(player.id)) ids.add(m.gameID);
      }
    }
    return ids;
  }, [games, matches, user, player]);
  return { ids, isLoading };
}
