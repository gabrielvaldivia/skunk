import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useActivity } from "./useActivity";
import type { Game } from "../models/Game";
import type { Player } from "../models/Player";
import { setGameHeart } from "../services/databaseService";

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

/** Your own heart on a game, or undefined when it just follows whether you added or played it */
function explicitHeart(player: Player | null, gameId: string): boolean | undefined {
  const heart = player?.gameHearts?.[gameId];
  if (heart !== undefined) return heart;
  if (player?.ownedGameIDs?.[gameId]) return true;
  return undefined;
}

/** Ids of your games: ones you added, scanned or played get a heart automatically, and un-hearting takes them out */
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
    const explicit = new Set([...Object.keys(player?.gameHearts ?? {}), ...Object.keys(player?.ownedGameIDs ?? {})]);
    for (const id of explicit) {
      if (explicitHeart(player, id)) ids.add(id);
      else ids.delete(id);
    }
    return ids;
  }, [games, matches, user, player]);
  return { ids, isLoading };
}

/** Heart a game into My Games, or un-heart it out; flips right away while it saves */
export function useGameHeart(gameId: string | undefined, games: Game[]) {
  const { player, refreshPlayer } = useAuth();
  const { ids } = useMyGameIds(games);
  const [pending, setPending] = useState<{ id: string; hearted: boolean } | null>(null);
  const hearted = pending && pending.id === gameId ? pending.hearted : !!gameId && ids.has(gameId);
  const toggle = useCallback(async () => {
    if (!player || !gameId) return;
    const next = !hearted;
    setPending({ id: gameId, hearted: next });
    try {
      await setGameHeart(player.id, gameId, next);
      await refreshPlayer();
    } finally {
      setPending(null);
    }
  }, [player, gameId, hearted, refreshPlayer]);
  return { hearted, toggle, canHeart: !!player };
}

/** Heart a game for you (after scanning or playing it), unless it already is */
export async function heartGame(player: Player | null, gameId: string, refreshPlayer: () => Promise<void>) {
  if (!player || explicitHeart(player, gameId) === true) return;
  await setGameHeart(player.id, gameId, true);
  await refreshPlayer();
}
