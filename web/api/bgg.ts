import { BggError, bggErrorResponse, fetchBgg, parseGames, parseResults } from '../server/bgg.js';
import { bggUsername } from '../src/lib/bgg.js';

/** Public metadata only. The BGG application token never leaves the server. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const mode = params.get('mode');
    let games;
    let total: number;
    if (mode === 'search') {
      const query = params.get('query')?.trim() ?? '';
      if (query.length < 2 || query.length > 150) throw new BggError('Enter a game name between 2 and 150 characters.', 400);
      const results = parseResults(await fetchBgg(`search?${new URLSearchParams({ query, type: 'boardgame' })}`));
      const term = query.toLowerCase();
      results.sort((a, b) => Number(b.title.toLowerCase() === term) - Number(a.title.toLowerCase() === term) ||
        Number(b.title.toLowerCase().startsWith(term)) - Number(a.title.toLowerCase().startsWith(term)) || a.title.localeCompare(b.title));
      total = results.length;
      games = results.slice(0, 100);
    } else if (mode === 'games') {
      const ids = params.get('ids') ?? '';
      if (!/^[1-9]\d{0,8}(,[1-9]\d{0,8}){0,19}$/.test(ids)) throw new BggError('Choose between 1 and 20 valid BGG games.', 400);
      games = parseGames(await fetchBgg(`thing?id=${[...new Set(ids.split(','))].sort().join(',')}`));
      total = games.length;
    } else if (mode === 'collection') {
      let username: string;
      try { username = bggUsername(params.get('username') ?? ''); }
      catch (error) { throw new BggError((error as Error).message, 400); }
      games = parseResults(await fetchBgg(`collection?${new URLSearchParams({ username, own: '1', excludesubtype: 'boardgameexpansion' })}`, 60_000), true)
        .sort((a, b) => a.title.localeCompare(b.title));
      total = games.length;
    } else throw new BggError('Choose a game search, game link, or collection.', 400);
    return Response.json({ games, total }, { headers: mode === 'collection' ? { 'cache-control': 'private, no-store' } : {
      'cache-control': 'public, max-age=300', 'vercel-cdn-cache-control': 'max-age=3600, stale-while-revalidate=86400',
    } });
  } catch (error) { return bggErrorResponse(error); }
}
