import { useEffect, useState } from "react";
import type { Game } from "@/models/Game";

// Small tilted boxes for lists, e.g. beside match avatars. The renderer (and
// three.js with it) loads only once a list first asks for one.
const snapshots = new Map<string, Promise<string | null>>();

function snapshotKey(game: Game) {
  return `${game.id}|${game.coverArt ?? ""}|${game.title}`;
}

/** A picture of the game's box, tilted like the game page's hero; null while it renders */
export function useBoxSnapshot(game: Game | undefined) {
  const key = game ? snapshotKey(game) : null;
  const [result, setResult] = useState<{ key: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!game || !key) return;
    let alive = true;
    let pending = snapshots.get(key);
    if (!pending) {
      pending = import("./boxSnapshotRender").then((m) => m.renderSnapshot(game));
      snapshots.set(key, pending);
    }
    pending.then((url) => {
      if (alive) setResult({ key, url });
    });
    return () => {
      alive = false;
    };
  }, [game, key]);
  return result && result.key === key ? result.url : null;
}
