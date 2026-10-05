import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bggIdFromInput, bggUsername, findBggMatch, gameFromBgg, type BggGame } from '../src/lib/bgg';
import { importBggGames } from '../src/lib/importBggGames';
import { loadBggCollection, requestBgg } from '../src/services/bggService';
import { BggError, bggImageUrl, fetchBgg, parseGames, parseResults } from '../server/bgg';
import { GET } from '../api/bgg';
import { GET as cover } from '../api/bgg-cover';

const thing = `<items><item type="boardgame" id="13"><name type="alternate" value="Die Siedler"/><name type="primary" value="Catan &amp; Friends"/><yearpublished value="1995"/><minplayers value="3"/><maxplayers value="4"/><image>https://cf.geekdo-images.com/catan.png</image><thumbnail>https://cf.geekdo-images.com/small.png</thumbnail></item></items>`;
const detail: BggGame = { bggId: 13, title: 'Catan', minPlayers: 3, maxPlayers: 4, cooperative: false, image: 'https://cf.geekdo-images.com/catan.png' };
const existing = { ...gameFromBgg(detail, 'someone'), id: 'old-catan' };

test('game IDs accept real BGG links and reject lookalikes and unrelated URLs', () => {
  for (const value of ['13', 'https://boardgamegeek.com/boardgame/13/catan?foo=1', 'www.boardgamegeek.com/boardgame/13', 'http://boardgamegeek.com/boardgameexpansion/13/example']) assert.equal(bggIdFromInput(value), 13);
  for (const value of ['0', '-1', 'Catan', 'https://boardgamegeek.com.evil.test/boardgame/13', 'https://boardgamegeek.com@evil.test/boardgame/13', 'https://boardgamegeek.com:123/boardgame/13', 'https://boardgamegeek.com/user/13', 'https://boardgamegeek.com/boardgame/13x']) assert.equal(bggIdFromInput(value), null);
});

test('collection input accepts usernames and profile/collection links, rejects arbitrary URLs', () => {
  assert.equal(bggUsername(' example-user '), 'example-user');
  assert.equal(bggUsername('https://boardgamegeek.com/user/example-user'), 'example-user');
  assert.equal(bggUsername('boardgamegeek.com/collection/user/example-user?own=1'), 'example-user');
  for (const value of ['https://boardgamegeek.com/profile/danielchungf', 'boardgamegeek.com/profile/danielchungf', 'https://www.boardgamegeek.com/profile/danielchungf/?foo=1#collection']) assert.equal(bggUsername(value), 'danielchungf');
  for (const value of ['', 'a/b', 'https://evil.test/user/admin', 'https://boardgamegeek.com/boardgame/13', 'https://boardgamegeek.com.evil.test/profile/admin', 'https://boardgamegeek.com/profile/a%2Fb']) assert.throws(() => bggUsername(value));
});

test('pasted profile URLs load the collection using the extracted username', async (t) => {
  const games = [{ bggId: 13, title: 'Catan' }];
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    const url = new URL(input, 'https://skunk.test');
    assert.equal(url.pathname, '/api/bgg');
    assert.equal(url.searchParams.get('mode'), 'collection');
    assert.equal(url.searchParams.get('username'), 'danielchungf');
    return Response.json({ games, total: 1 });
  });
  assert.deepEqual(await loadBggCollection('https://boardgamegeek.com/profile/danielchungf', {}), { games, total: 1 });
});

test('metadata parser preserves names, player ranges, cover and year', () => {
  const [game] = parseGames(thing);
  assert.equal(game.title, 'Catan & Friends');
  assert.equal(game.year, 1995);
  assert.equal(game.minPlayers, 3);
  assert.equal(game.maxPlayers, 4);
  assert.equal(game.image, 'https://cf.geekdo-images.com/catan.png');
  assert.deepEqual(parseGames('<items/>'), []);
});

test('collection parser handles repeated editions and double-escaped names', () => {
  const collection = '<items><item objectid="13"><name sortindex="1">King&amp;#039;s Game</name><yearpublished>1995</yearpublished></item><item objectid="13"><name>Another edition</name></item><item objectid="0"><name>Invalid</name></item></items>';
  const results = parseResults(collection, true);
  assert.equal(results.length, 1);
  assert.equal(results[0].bggId, 13);
  assert.equal(parseResults(collection.replace('<item objectid="13"><name>Another edition</name></item>', ''), true)[0].title, "King's Game");
});

test('invalid accounts and malformed upstream responses do not look like empty collections', () => {
  assert.throws(() => parseResults('<errors><error message="Invalid username"/></errors>', true), (error: unknown) => error instanceof BggError && error.status === 404);
  assert.throws(() => parseResults('<html><body>Down</body></html>'));
  assert.throws(() => parseResults('<items><item></items>'));
  assert.throws(() => parseResults('<!DOCTYPE items [<!ENTITY x "bad">]><items/>'));
});

test('cover proxy only accepts the HTTPS BGG image host', async () => {
  assert.equal(bggImageUrl('https://cf.geekdo-images.com/image.png'), 'https://cf.geekdo-images.com/image.png');
  for (const url of ['http://cf.geekdo-images.com/a', 'https://cf.geekdo-images.com.evil.test/a', 'https://user:pass@cf.geekdo-images.com/a', 'http://localhost/a', 'data:image/png,hello']) {
    assert.equal(bggImageUrl(url), undefined);
    assert.equal((await cover(new Request(`https://skunk.test/api/bgg-cover?url=${encodeURIComponent(url)}`))).status, 400);
  }
});

test('matching prefers BGG ID and does not combine different games sharing a title', () => {
  assert.equal(findBggMatch([existing], { bggId: 13, title: 'Die Siedler' })?.id, 'old-catan');
  assert.equal(findBggMatch([existing], { bggId: 14, title: 'Catan' }), undefined);
  assert.equal(findBggMatch([{ ...existing, bggId: undefined }], { bggId: 13, title: ' CATAN ' })?.id, 'old-catan');
});

test('import defaults do not invent score rules or unbounded player counts', () => {
  const game = gameFromBgg(detail, 'me');
  assert.deepEqual(game.supportedPlayerCounts, [3, 4]);
  assert.equal(game.isBinaryScore, true);
  assert.match(game.coverArt!, /^\/api\/bgg-cover\?url=/);
  assert.equal(game.createdByID, 'me');
  assert.equal(gameFromBgg({ ...detail, minPlayers: 999, maxPlayers: 9999 }, 'me').supportedPlayerCounts.length, 1);
});

test('imports reuse existing records and deduplicate selected IDs without fetching metadata', async () => {
  const hearts: string[] = [];
  const result = await importBggGames([detail, detail], {
    uid: 'me', games: [existing],
    loadDetails: async () => { throw new Error('Should not request details'); },
    saveGame: async () => { throw new Error('Should not create a game'); },
    heartGame: async (id) => { hearts.push(id); }, onProgress: () => {},
  });
  assert.deepEqual(hearts, ['old-catan']);
  assert.deepEqual(result, { added: [13], failed: [] });
});

test('partial import failure retains successful additions and is retryable', async () => {
  const other = { ...detail, bggId: 14, title: 'Other game' };
  const saved = [existing];
  let rejectHeart = true;
  let created = 0;
  const deps = {
    uid: 'me', games: saved,
    loadDetails: async () => [other],
    saveGame: async (game: Omit<typeof existing, 'id'>) => { created++; const next = { ...game, id: 'bgg-14' }; saved.push(next); return next; },
    heartGame: async (id: string) => { if (id === 'bgg-14' && rejectHeart) throw new Error('Connection lost'); },
    onProgress: () => {},
  };
  const first = await importBggGames([detail, other], deps);
  assert.deepEqual(first.added, [13]);
  assert.equal(first.failed[0].bggId, 14);
  rejectHeart = false;
  const retry = await importBggGames([other], deps);
  assert.deepEqual(retry.added, [14]);
  assert.equal(created, 1);
});

test('alternate search names resolve legacy records by the canonical detail title', async () => {
  const result = await importBggGames([{ ...detail, title: 'Die Siedler' }], {
    uid: 'me', games: [{ ...existing, bggId: undefined }], loadDetails: async () => [detail],
    saveGame: async () => { throw new Error('Duplicate'); }, heartGame: async (id) => { assert.equal(id, existing.id); }, onProgress: () => {},
  });
  assert.deepEqual(result.added, [13]);
});

test('a failed cover submission can be retried without recreating the game', async () => {
  const pending = { ...existing, coverArt: undefined, createdByID: 'me', pending: true };
  let failCover = true;
  let hearted = false;
  const deps = {
    uid: 'me', games: [pending], loadDetails: async () => [detail],
    saveGame: async () => { throw new Error('Must reuse the pending game'); },
    saveCover: async () => { if (failCover) throw new Error('Upload interrupted'); },
    heartGame: async () => { hearted = true; }, onProgress: () => {},
  };
  const first = await importBggGames([detail], deps);
  assert.equal(first.failed.length, 1);
  assert.equal(hearted, false);
  failCover = false;
  assert.deepEqual((await importBggGames([detail], deps)).added, [13]);
  assert.equal(hearted, true);
});

test('large collections fetch metadata in batches of no more than 20 games', async () => {
  const choices = Array.from({ length: 45 }, (_, i) => ({ ...detail, bggId: i + 1, title: `Game ${i + 1}` }));
  const batches: number[] = [];
  const result = await importBggGames(choices, {
    uid: 'me', games: [],
    loadDetails: async (ids) => { batches.push(ids.length); return choices.filter((game) => ids.includes(game.bggId)); },
    saveGame: async (game) => ({ ...game, id: `bgg-${game.bggId}` }), heartGame: async () => {}, onProgress: () => {},
  });
  assert.deepEqual(batches, [20, 20, 5]);
  assert.equal(result.added.length, 45);
  assert.equal(result.failed.length, 0);
});

test('API validates inputs before talking to BGG', async () => {
  for (const params of ['mode=unknown', 'mode=games&ids=0', 'mode=games&ids=13,bad', 'mode=games&ids=' + Array.from({ length: 21 }, (_, i) => i + 1).join(','), 'mode=search&query=a', 'mode=collection&username=']) {
    assert.equal((await GET(new Request(`https://skunk.test/api/bgg?${params}`))).status, 400);
  }
});

test('API reports missing server configuration without leaking credentials', async () => {
  const previous = process.env.BGG_TOKEN;
  delete process.env.BGG_TOKEN;
  try {
    const response = await GET(new Request('https://skunk.test/api/bgg?mode=search&query=Catan'));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.doesNotMatch(await response.text(), /BGG_TOKEN/);
  } finally { if (previous) process.env.BGG_TOKEN = previous; }
});

test('BGG fetch caches and coalesces requests; queued and busy responses remain retryable', async (t) => {
  const previous = process.env.BGG_TOKEN;
  process.env.BGG_TOKEN = 'test-server-secret';
  let now = Date.now() + 1_000_000;
  t.mock.method(Date, 'now', () => now);
  let calls = 0;
  let status = 200;
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    calls++;
    assert.equal((init.headers as Record<string, string>).Authorization, 'Bearer test-server-secret');
    return new Response(thing, { status });
  });
  try {
    const results = await Promise.all([fetchBgg('thing?id=13'), fetchBgg('thing?id=13')]);
    assert.equal(results[0], results[1]);
    assert.equal(calls, 1);
    await fetchBgg('thing?id=13');
    assert.equal(calls, 1);
    await assert.rejects(fetchBgg('thing?id=14'), (e: unknown) => e instanceof BggError && e.status === 429 && e.retryAfter > 0);
    now += 6000; status = 202;
    const queued = await GET(new Request('https://skunk.test/api/bgg?mode=collection&username=fixture'));
    assert.equal(queued.status, 202);
    assert.equal(queued.headers.get('retry-after'), '5');
    now += 6000; status = 503;
    await assert.rejects(fetchBgg('thing?id=14'), (e: unknown) => e instanceof BggError && e.status === 503 && e.retryAfter > 0);
    now += 11000; status = 200;
    await fetchBgg('thing?id=14');
    assert.equal(calls, 4);
  } finally { if (previous) process.env.BGG_TOKEN = previous; else delete process.env.BGG_TOKEN; }
});

test('client retries queued responses and supports cancellation', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return calls === 1 ? Response.json({ error: 'Preparing collection' }, { status: 202, headers: { 'retry-after': '1' } })
      : Response.json({ games: [detail], total: 1 });
  });
  const updates: string[] = [];
  const result = await requestBgg({ mode: 'collection', username: 'test' }, { onStatus: (message) => updates.push(message) });
  assert.equal(result.games[0].bggId, 13);
  assert.equal(calls, 2);
  assert.deepEqual(updates, ['Preparing collection']);
  calls = 0;
  const controller = new AbortController();
  const pending = requestBgg({ mode: 'collection', username: 'test' }, { signal: controller.signal, onStatus: () => controller.abort() });
  await assert.rejects(pending, (error: unknown) => error instanceof Error && error.name === 'AbortError');
});
