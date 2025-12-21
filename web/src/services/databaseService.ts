import { ref, get, set, push, remove, update } from 'firebase/database';
import { database } from './firebase';
import type { Game } from '../models/Game';
import type { Player } from '../models/Player';
import type { Match } from '../models/Match';

const GAMES_PATH = 'games';
const PLAYERS_PATH = 'players';
const MATCHES_PATH = 'matches';

// ==================== Games ====================

export async function getGames(): Promise<Game[]> {
  const gamesRef = ref(database, GAMES_PATH);
  const snapshot = await get(gamesRef);
  
  if (!snapshot.exists()) {
    return [];
  }
  
  const gamesData = snapshot.val();
  const games: Game[] = [];
  
  for (const gameId in gamesData) {
    games.push({
      id: gameId,
      ...gamesData[gameId]
    });
  }
  
  return games.sort((a, b) => a.title.localeCompare(b.title));
}

export async function getGame(gameId: string): Promise<Game | null> {
  const gameRef = ref(database, `${GAMES_PATH}/${gameId}`);
  const snapshot = await get(gameRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  return {
    id: gameId,
    ...snapshot.val()
  };
}

export async function createGame(game: Omit<Game, 'id'>): Promise<Game> {
  const gamesRef = ref(database, GAMES_PATH);
  const newGameRef = push(gamesRef);
  const gameId = newGameRef.key!;
  
  const gameWithId: Game = {
    ...game,
    id: gameId,
    creationDate: game.creationDate || Date.now()
  };
  
  await set(newGameRef, gameWithId);
  return gameWithId;
}

export async function updateGame(gameId: string, game: Partial<Game>): Promise<void> {
  const gameRef = ref(database, `${GAMES_PATH}/${gameId}`);
  await update(gameRef, game);
}

export async function deleteGame(gameId: string): Promise<void> {
  const gameRef = ref(database, `${GAMES_PATH}/${gameId}`);
  await remove(gameRef);
}

// ==================== Players ====================

export async function getPlayers(): Promise<Player[]> {
  const playersRef = ref(database, PLAYERS_PATH);
  const snapshot = await get(playersRef);
  
  if (!snapshot.exists()) {
    return [];
  }
  
  const playersData = snapshot.val();
  const players: Player[] = [];
  
  for (const playerId in playersData) {
    players.push({
      id: playerId,
      ...playersData[playerId]
    });
  }
  
  return players;
}

export async function getPlayer(playerId: string): Promise<Player | null> {
  const playerRef = ref(database, `${PLAYERS_PATH}/${playerId}`);
  const snapshot = await get(playerRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  return {
    id: playerId,
    ...snapshot.val()
  };
}

export async function getPlayerByGoogleUserID(googleUserID: string): Promise<Player | null> {
  const playersRef = ref(database, PLAYERS_PATH);
  const snapshot = await get(playersRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  const playersData = snapshot.val();
  for (const playerId in playersData) {
    const player = playersData[playerId];
    if (player.googleUserID === googleUserID) {
      return {
        id: playerId,
        ...player
      };
    }
  }
  
  return null;
}

export async function createPlayer(player: Omit<Player, 'id'>): Promise<Player> {
  const playersRef = ref(database, PLAYERS_PATH);
  const newPlayerRef = push(playersRef);
  const playerId = newPlayerRef.key!;
  
  const playerWithId: Player = {
    ...player,
    id: playerId
  };
  
  await set(newPlayerRef, playerWithId);
  return playerWithId;
}

export async function updatePlayer(playerId: string, player: Partial<Player>): Promise<void> {
  const playerRef = ref(database, `${PLAYERS_PATH}/${playerId}`);
  await update(playerRef, player);
}

export async function deletePlayer(playerId: string): Promise<void> {
  const playerRef = ref(database, `${PLAYERS_PATH}/${playerId}`);
  await remove(playerRef);
}

// ==================== Matches ====================

export async function getMatches(): Promise<Match[]> {
  const matchesRef = ref(database, MATCHES_PATH);
  const snapshot = await get(matchesRef);
  
  if (!snapshot.exists()) {
    return [];
  }
  
  const matchesData = snapshot.val();
  const matches: Match[] = [];
  
  for (const matchId in matchesData) {
    matches.push({
      id: matchId,
      ...matchesData[matchId]
    });
  }
  
  return matches.sort((a, b) => b.date - a.date);
}

export async function getMatchesForGame(gameId: string): Promise<Match[]> {
  const matchesRef = ref(database, MATCHES_PATH);
  const snapshot = await get(matchesRef);
  
  if (!snapshot.exists()) {
    return [];
  }
  
  const matchesData = snapshot.val();
  const matches: Match[] = [];
  
  for (const matchId in matchesData) {
    const match = matchesData[matchId];
    if (match.gameID === gameId) {
      matches.push({
        id: matchId,
        ...match
      });
    }
  }
  
  return matches.sort((a, b) => b.date - a.date);
}

export async function getRecentMatches(limit: number = 500, daysBack: number = 365 * 10): Promise<Match[]> {
  const matchesRef = ref(database, MATCHES_PATH);
  const cutoffDate = Date.now() - (daysBack * 24 * 60 * 60 * 1000);
  
  // For Realtime Database, we fetch all matches and filter in memory
  // This is simpler than complex queries and works well for moderate datasets
  const snapshot = await get(matchesRef);
  
  if (!snapshot.exists()) {
    return [];
  }
  
  const matchesData = snapshot.val();
  const matches: Match[] = [];
  
  for (const matchId in matchesData) {
    const match = matchesData[matchId];
    // Filter by date
    if (match.date >= cutoffDate) {
      matches.push({
        id: matchId,
        ...match
      });
    }
  }
  
  // Sort by date descending and limit
  return matches
    .sort((a, b) => b.date - a.date)
    .slice(0, limit);
}

export async function getMatch(matchId: string): Promise<Match | null> {
  const matchRef = ref(database, `${MATCHES_PATH}/${matchId}`);
  const snapshot = await get(matchRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  return {
    id: matchId,
    ...snapshot.val()
  };
}

export async function createMatch(match: Omit<Match, 'id'>): Promise<Match> {
  const matchesRef = ref(database, MATCHES_PATH);
  const newMatchRef = push(matchesRef);
  const matchId = newMatchRef.key!;
  
  const matchWithId: Match = {
    ...match,
    id: matchId,
    date: match.date || Date.now(),
    lastModified: match.lastModified || Date.now(),
    playerIDsString: match.playerIDs.sort().join(',')
  };
  
  await set(newMatchRef, matchWithId);
  return matchWithId;
}

export async function updateMatch(matchId: string, match: Partial<Match>): Promise<void> {
  const matchRef = ref(database, `${MATCHES_PATH}/${matchId}`);
  const updates: any = {
    ...match,
    lastModified: Date.now()
  };
  
  if (match.playerIDs) {
    updates.playerIDsString = match.playerIDs.sort().join(',');
  }
  
  await update(matchRef, updates);
}

export async function deleteMatch(matchId: string): Promise<void> {
  const matchRef = ref(database, `${MATCHES_PATH}/${matchId}`);
  await remove(matchRef);
}

export async function getMatchesForPlayer(playerId: string): Promise<Match[]> {
  const matchesRef = ref(database, MATCHES_PATH);
  const snapshot = await get(matchesRef);
  
  if (!snapshot.exists()) {
    return [];
  }
  
  const matchesData = snapshot.val();
  const matches: Match[] = [];
  
  for (const matchId in matchesData) {
    const match = matchesData[matchId];
    if (match.playerIDs && match.playerIDs.includes(playerId)) {
      matches.push({
        id: matchId,
        ...match
      });
    }
  }
  
  return matches.sort((a, b) => b.date - a.date);
}

