import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { setPlayerFollow } from "../services/databaseService";

export type ActivityAudience = "friends" | "global";

export function useFriendIds() {
  const { player } = useAuth();
  return useMemo(() => {
    const ids = new Set<string>();
    if (!player) return ids;
    ids.add(player.id);
    Object.entries(player.followedPlayerIDs ?? {}).forEach(([playerId, followed]) => {
      if (followed) ids.add(playerId);
    });
    return ids;
  }, [player]);
}

export function usePlayerFollow(targetPlayerId: string | undefined) {
  const { player, refreshPlayer } = useAuth();
  const [pending, setPending] = useState<boolean | null>(null);
  const storedFollowing = !!targetPlayerId && player?.followedPlayerIDs?.[targetPlayerId] === true;
  const following = pending ?? storedFollowing;
  const canFollow = !!player && !!targetPlayerId && player.id !== targetPlayerId;

  const toggle = useCallback(async () => {
    if (!player || !targetPlayerId || player.id === targetPlayerId) return;
    const next = !following;
    setPending(next);
    try {
      await setPlayerFollow(player.id, targetPlayerId, next);
      await refreshPlayer();
    } finally {
      setPending(null);
    }
  }, [following, player, refreshPlayer, targetPlayerId]);

  return { following, canFollow, isSaving: pending !== null, toggle };
}
