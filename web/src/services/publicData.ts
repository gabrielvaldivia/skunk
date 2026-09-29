/**
 * Public lists (games, players, matches) read over plain HTTP, so browsing
 * never opens a database socket. The default is the site's cached copy
 * (/api/public, refreshed at most once a minute for everyone); `fresh` reads
 * the database directly, for right after you've changed something yourself.
 */
export type PublicList = 'games' | 'players' | 'matches';

const DATABASE_URL = (import.meta.env.VITE_FIREBASE_DATABASE_URL as string).replace(/\/$/, '');

async function readJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} reading ${url}`);
  return (await res.json()) as Record<string, unknown> | null;
}

export async function fetchList<T>(list: PublicList, { fresh = false } = {}): Promise<Record<string, T>> {
  const direct = `${DATABASE_URL}/${list}.json`;
  if (!fresh) {
    try {
      return ((await readJson(`/api/public?list=${list}`)) ?? {}) as Record<string, T>;
    } catch {
      // No cache endpoint (local dev) or it's down: read the database directly
    }
  }
  return ((await readJson(direct)) ?? {}) as Record<string, T>;
}
