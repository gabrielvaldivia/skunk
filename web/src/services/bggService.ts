import { bggIdFromInput, bggUsername, type BggGame, type BggResult } from '../lib/bgg';

interface RequestOptions {
  signal?: AbortSignal;
  onStatus?: (message: string) => void;
}

async function wait(ms: number, signal?: AbortSignal) {
  signal?.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal?.reason); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export async function requestBgg<T extends BggResult>(params: Record<string, string>, { signal, onStatus }: RequestOptions = {}): Promise<{ games: T[]; total: number }> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const response = await fetch(`/api/bgg?${new URLSearchParams(params)}`, { signal });
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('BoardGameGeek search is unavailable. Try again later or add the game manually.');
    }
    const data = await response.json();
    const delay = Number(response.headers.get('retry-after'));
    if ([202, 429, 503].includes(response.status) && delay > 0 && attempt < 11) {
      onStatus?.(data.error || 'Waiting for BoardGameGeek…');
      await wait(Math.min(30, Math.max(1, delay)) * 1000, signal);
      continue;
    }
    if (response.status === 202 || !response.ok) throw new Error(data.error || 'Could not load BoardGameGeek. Try again.');
    if (!Array.isArray(data.games)) throw new Error('BoardGameGeek returned an unexpected response.');
    return data;
  }
  throw new Error('BoardGameGeek is still preparing the collection. Try again in a minute.');
}

export function searchBgg(input: string, options: RequestOptions) {
  const query = input.trim();
  const id = bggIdFromInput(query);
  if (id) return requestBgg({ mode: 'games', ids: String(id) }, options);
  if (/^https?:\/\/|boardgamegeek\.com/i.test(query)) {
    throw new Error('Paste a BoardGameGeek game link, such as boardgamegeek.com/boardgame/13/catan.');
  }
  if (query.length < 2) throw new Error('Enter at least two characters to search.');
  return requestBgg({ mode: 'search', query }, options);
}

export function loadBggCollection(input: string, options: RequestOptions) {
  return requestBgg({ mode: 'collection', username: bggUsername(input) }, options);
}

export async function loadBggGames(ids: number[], options: RequestOptions = {}): Promise<BggGame[]> {
  const { games } = await requestBgg<BggGame>({ mode: 'games', ids: ids.join(',') }, options);
  return games;
}
