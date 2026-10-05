import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type { BggGame, BggResult } from '../src/lib/bgg.js';

type XmlNode = Record<string, unknown>;
const node = (value: unknown): XmlNode => value && typeof value === 'object' ? value as XmlNode : {};
const list = (value: unknown): XmlNode[] => (Array.isArray(value) ? value : value ? [value] : []).map(node);
const string = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const number = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, processEntities: true });

export class BggError extends Error {
  status: number;
  retryAfter: number;
  constructor(message: string, status = 502, retryAfter = 0) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function decode(value: unknown) {
  return string(value).replace(/&#(x[0-9a-f]+|\d+);/gi, (match, code: string) => {
    const n = code.toLowerCase().startsWith('x') ? parseInt(code.slice(1), 16) : Number(code);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
  }).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

export function bggImageUrl(value: unknown): string | undefined {
  try {
    const url = new URL(string(value).trim());
    return url.protocol === 'https:' && url.hostname === 'cf.geekdo-images.com' && !url.username && !url.password && !url.port
      ? url.href : undefined;
  } catch { return undefined; }
}

export function parseBggXml(xml: string): XmlNode[] {
  if (XMLValidator.validate(xml) !== true || /<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new BggError('BoardGameGeek sent an unreadable response. Try again shortly.');
  }
  const data = node(parser.parse(xml));
  if (data.errors || data.error) throw new BggError('That BGG account could not be found or its collection is unavailable.', 404);
  if (!('items' in data)) throw new BggError('BoardGameGeek sent an unexpected response. Try again shortly.');
  return list(node(data.items).item);
}

export function parseResults(xml: string, collection = false): BggResult[] {
  const results = parseBggXml(xml).flatMap((item) => {
    if (!collection && item.type !== 'boardgame' && item.type !== 'boardgameexpansion') return [];
    const names = list(item.name);
    const title = collection ? decode(node(item.name)['#text'] ?? item.name) : decode((names.find((name) => name.type === 'primary') ?? names[0])?.value);
    const bggId = number(collection ? item.objectid : item.id);
    if (!title || !bggId || !Number.isInteger(bggId)) return [];
    const year = number(collection ? item.yearpublished : node(item.yearpublished).value);
    const thumbnail = bggImageUrl(item.thumbnail);
    return [{ bggId, title, ...(year ? { year } : {}), ...(thumbnail ? { thumbnail } : {}) }];
  });
  return [...new Map(results.map((game) => [game.bggId, game])).values()];
}

export function parseGames(xml: string): BggGame[] {
  const results = new Map(parseResults(xml).map((game) => [game.bggId, game]));
  return parseBggXml(xml).flatMap((item) => {
    const result = results.get(Number(item.id));
    if (!result) return [];
    const image = bggImageUrl(item.image);
    return [{ ...result, minPlayers: number(node(item.minplayers).value) ?? 2,
      maxPlayers: number(node(item.maxplayers).value) ?? 0,
      cooperative: list(item.link).some((link) => link.type === 'boardgamemechanic' && link.value === 'Cooperative Game'),
      ...(image ? { image } : {}),
    }];
  });
}

// Bounded warm-instance cache + CDN cache on the endpoint. Concurrent identical
// requests share one fetch. Other requests wait on the client, not in a function.
const cache = new Map<string, { xml: string; expires: number }>();
const pending = new Map<string, Promise<string>>();
let nextRequestAt = 0;

export async function fetchBgg(path: string, ttl = 3600_000): Promise<string> {
  const token = process.env.BGG_TOKEN;
  if (!token) throw new BggError('BoardGameGeek search is not available yet. You can still add a game manually.', 503);
  const cached = cache.get(path);
  if (cached && cached.expires > Date.now()) return cached.xml;
  const running = pending.get(path);
  if (running) return running;
  if (Date.now() < nextRequestAt) throw new BggError('Waiting for BoardGameGeek…', 429, Math.max(1, Math.ceil((nextRequestAt - Date.now()) / 1000)));
  nextRequestAt = Date.now() + 5000;
  const task = (async () => {
    let response: Response;
    try {
      response = await fetch(`https://boardgamegeek.com/xmlapi2/${path}`, {
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000),
      });
    } catch { throw new BggError('BoardGameGeek could not be reached. Try again shortly.', 503, 5); }
    if (response.status === 202) throw new BggError('BoardGameGeek is preparing this collection…', 202, 5);
    if ([429, 500, 502, 503, 504].includes(response.status)) {
      nextRequestAt = Date.now() + 10_000;
      throw new BggError('BoardGameGeek is busy. Trying again shortly…', 503, 10);
    }
    if ([401, 403].includes(response.status)) throw new BggError('BoardGameGeek search is temporarily unavailable. You can still add a game manually.', 503);
    if (!response.ok) throw new BggError('Could not load games from BoardGameGeek. Try again.');
    const xml = await response.text();
    parseBggXml(xml); // Never cache a BGG error or HTML response.
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    cache.set(path, { xml, expires: Date.now() + ttl });
    return xml;
  })();
  pending.set(path, task);
  try { return await task; } finally { pending.delete(path); }
}

export function bggErrorResponse(error: unknown): Response {
  const e = error instanceof BggError ? error : new BggError('Could not load BoardGameGeek. Try again.');
  return Response.json({ error: e.message }, { status: e.status, headers: {
    'cache-control': 'no-store', ...(e.retryAfter ? { 'retry-after': String(e.retryAfter) } : {}),
  } });
}
