import type { Game } from '../models/Game.js';

export interface BggResult {
  bggId: number;
  title: string;
  year?: number;
  thumbnail?: string;
}

export interface BggGame extends BggResult {
  minPlayers: number;
  maxPlayers: number;
  image?: string;
  cooperative: boolean;
}

/** Accept BGG game pages, never arbitrary URLs to fetch on the server. */
export function bggIdFromInput(input: string): number | null {
  const value = input.trim();
  if (/^\d{1,9}$/.test(value)) return Number(value) || null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!['http:', 'https:'].includes(url.protocol) ||
        !['boardgamegeek.com', 'www.boardgamegeek.com'].includes(url.hostname.toLowerCase()) ||
        url.username || url.password || url.port) return null;
    const id = url.pathname.match(/^\/boardgame(?:expansion)?\/(\d{1,9})(?:\/|$)/)?.[1];
    return id ? Number(id) || null : null;
  } catch {
    return null;
  }
}

export function bggUsername(input: string): string {
  const value = input.trim();
  let username = value;
  if (/^(?:https?:\/\/|(?:www\.)?boardgamegeek\.com\/)/i.test(value)) {
    try {
      const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
      if (!['http:', 'https:'].includes(url.protocol) ||
          !['boardgamegeek.com', 'www.boardgamegeek.com'].includes(url.hostname.toLowerCase()) ||
          url.username || url.password || url.port) throw new Error();
      const match = url.pathname.match(/^\/(?:profile|user|collection\/user)\/([^/]+)\/?$/);
      if (!match) throw new Error();
      username = decodeURIComponent(match[1]);
    } catch {
      throw new Error('Enter a BGG username or a link to a BGG profile.');
    }
  }
  if (!username || username.length > 64 || /[\s/\\?#]/.test(username) || [...username].some((char) => char.charCodeAt(0) < 32)) {
    throw new Error('Enter a valid BGG username.');
  }
  return username;
}

export const bggTitleKey = (title: string) => title.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ');

export function findBggMatch(games: Game[], result: BggResult): Game | undefined {
  // A title match is only a fallback for older entries without a BGG id.
  return games.find((game) => game.bggId === result.bggId) ??
    games.find((game) => !game.bggId && bggTitleKey(game.title) === bggTitleKey(result.title));
}

export function gameFromBgg(game: BggGame, uid: string): Omit<Game, 'id'> {
  const min = Math.max(1, Math.min(100, game.minPlayers || 2));
  const max = Math.max(min, Math.min(100, game.maxPlayers || min));
  return {
    title: game.title.slice(0, 120),
    bggId: game.bggId,
    createdByID: uid,
    supportedPlayerCounts: Array.from({ length: max - min + 1 }, (_, i) => min + i),
    // BGG has no scoring rules. Start with win/loss instead of inventing them.
    isBinaryScore: true,
    isTeamBased: game.cooperative,
    countAllScores: true,
    countLosersOnly: false,
    highestScoreWins: true,
    highestRoundScoreWins: true,
    winningConditions: 'game:highest|round:highest',
    ...(game.image ? { coverArt: `/api/bgg-cover?url=${encodeURIComponent(game.image)}` } : {}),
  };
}
