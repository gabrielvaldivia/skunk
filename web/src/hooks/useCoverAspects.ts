import { useEffect, useState } from "react";
import type { Game } from "../models/Game";

// Width/height of each cover image, keyed by URL. Only the header needs to be
// read for this, so it's cheap next to decoding the full image.
const aspects = new Map<string, number>();
const pending = new Map<string, Promise<number | undefined>>();

export function readCoverAspect(url: string): Promise<number | undefined> {
  const known = aspects.get(url);
  if (known) return Promise.resolve(known);
  let p = pending.get(url);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const aspect = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : undefined;
        if (aspect) aspects.set(url, aspect);
        resolve(aspect);
      };
      img.onerror = () => resolve(undefined);
      img.src = url;
    });
    pending.set(url, p);
  }
  return p;
}

/**
 * Cover aspect ratios for games that have cover art. Null until they're known
 * (or a short timeout passes), so callers can lay out once instead of
 * shuffling boxes around as covers trickle in.
 */
export function useCoverAspects(games: Game[], timeoutMs = 1500) {
  const [result, setResult] = useState<{ games: Game[]; aspects: Map<string, number> } | null>(null);
  useEffect(() => {
    let alive = true;
    const next = new Map<string, number>();
    const withCovers = games.filter((g) => g.coverArt && !g.boxDims);
    const finish = () => {
      if (alive) setResult({ games, aspects: new Map(next) });
      alive = false;
    };
    const timer = setTimeout(finish, timeoutMs);
    Promise.all(
      withCovers.map((g) =>
        readCoverAspect(g.coverArt!).then((a) => {
          if (a) next.set(g.id, a);
        })
      )
    ).then(finish);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [games, timeoutMs]);
  // Once known, keep showing the last result while a new game list resolves
  // (search filters reuse cached aspects, so this is near-instant)
  return result?.aspects ?? null;
}

/** Aspect of a single cover, for forms */
export function useCoverAspect(url: string | undefined) {
  const [aspect, setAspect] = useState<{ url: string; value: number } | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    readCoverAspect(url).then((value) => {
      if (alive && value) setAspect({ url, value });
    });
    return () => {
      alive = false;
    };
  }, [url]);
  return aspect && aspect.url === url ? aspect.value : undefined;
}
