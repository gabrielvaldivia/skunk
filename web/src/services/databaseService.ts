import { ref, get, set, push, remove, update } from 'firebase/database';
import { database } from './firebase';
import type { Game } from '../models/Game';
import type { Player } from '../models/Player';
import type { Match } from '../models/Match';
import type { Session } from '../models/Session';

const GAMES_PATH = 'games';
const PLAYERS_PATH = 'players';
const MATCHES_PATH = 'matches';
const SESSIONS_PATH = 'sessions';
const SESSIONS_BY_CODE_PATH = 'sessionsByCode';

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

// ==================== Sessions ====================

const SESSION_EXPIRY_HOURS = 24;

/**
 * Check if a session is expired (24 hours since lastActivityAt)
 */
export function isSessionExpired(session: Session): boolean {
  const expiryTime = SESSION_EXPIRY_HOURS * 60 * 60 * 1000; // 24 hours in milliseconds
  return Date.now() - session.lastActivityAt > expiryTime;
}

/**
 * Generate a unique 6-character alphanumeric code (uppercase)
 */
async function generateSessionCode(): Promise<string> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code: string;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    attempts++;

    // Check if code already exists
    const codeRef = ref(database, `${SESSIONS_BY_CODE_PATH}/${code}`);
    const snapshot = await get(codeRef);
    
    if (!snapshot.exists()) {
      return code;
    }
  } while (attempts < maxAttempts);

  throw new Error('Failed to generate unique session code after multiple attempts');
}

/**
 * Create a new session with a generated code
 */
export async function createSession(createdByID: string): Promise<Session> {
  const code = await generateSessionCode();
  const now = Date.now();

  const sessionsRef = ref(database, SESSIONS_PATH);
  const newSessionRef = push(sessionsRef);
  const sessionId = newSessionRef.key!;

  const session: Session = {
    id: sessionId,
    code,
    participantIDs: [],
    createdAt: now,
    createdByID,
    lastActivityAt: now,
  };

  // Write to both sessions and sessionsByCode
  await Promise.all([
    set(newSessionRef, session),
    set(ref(database, `${SESSIONS_BY_CODE_PATH}/${code}`), sessionId),
  ]);

  return session;
}

/**
 * Get session by code, filtering out expired sessions
 */
export async function getSessionByCode(code: string): Promise<Session | null> {
  const codeRef = ref(database, `${SESSIONS_BY_CODE_PATH}/${code}`);
  const codeSnapshot = await get(codeRef);

  if (!codeSnapshot.exists()) {
    return null;
  }

  const sessionId = codeSnapshot.val();
  const sessionRef = ref(database, `${SESSIONS_PATH}/${sessionId}`);
  const sessionSnapshot = await get(sessionRef);

  if (!sessionSnapshot.exists()) {
    return null;
  }

  const session: Session = {
    id: sessionId,
    ...sessionSnapshot.val(),
  };

  // Filter out expired sessions
  if (isSessionExpired(session)) {
    // Clean up expired session
    await deleteSession(sessionId);
    return null;
  }

  return session;
}

/**
 * Get session by ID
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  const sessionRef = ref(database, `${SESSIONS_PATH}/${sessionId}`);
  const snapshot = await get(sessionRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: sessionId,
    ...snapshot.val(),
  };
}

/**
 * Add a player to session participants if not already present, and update lastActivityAt
 */
export async function joinSession(sessionId: string, playerId: string): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  if (isSessionExpired(session)) {
    throw new Error('Session has expired');
  }

  const participantIDs = session.participantIDs || [];
  
  // Only add if not already present
  if (!participantIDs.includes(playerId)) {
    participantIDs.push(playerId);
  }

  const sessionRef = ref(database, `${SESSIONS_PATH}/${sessionId}`);
  await update(sessionRef, {
    participantIDs,
    lastActivityAt: Date.now(),
  });
}

/**
 * Remove a player from session participants, update lastActivityAt, and delete session if empty
 */
export async function leaveSession(sessionId: string, playerId: string): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) {
    return; // Session doesn't exist, nothing to do
  }

  const participantIDs = (session.participantIDs || []).filter(id => id !== playerId);
  const sessionRef = ref(database, `${SESSIONS_PATH}/${sessionId}`);

  if (participantIDs.length === 0) {
    // Auto-delete session when all participants leave
    await deleteSession(sessionId);
  } else {
    // Update participants and lastActivityAt
    await update(sessionRef, {
      participantIDs,
      lastActivityAt: Date.now(),
    });
  }
}

/**
 * Delete a session and its code index entry
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) {
    return;
  }

  // Delete from both sessions and sessionsByCode
  await Promise.all([
    remove(ref(database, `${SESSIONS_PATH}/${sessionId}`)),
    remove(ref(database, `${SESSIONS_BY_CODE_PATH}/${session.code}`)),
  ]);
}

/**
 * Get all active sessions (non-expired)
 */
export async function getActiveSessions(): Promise<Session[]> {
  const sessionsRef = ref(database, SESSIONS_PATH);
  const snapshot = await get(sessionsRef);

  if (!snapshot.exists()) {
    return [];
  }

  const sessionsData = snapshot.val();
  const sessions: Session[] = [];

  for (const sessionId in sessionsData) {
    const session: Session = {
      id: sessionId,
      ...sessionsData[sessionId],
    };

    // Filter out expired sessions
    if (!isSessionExpired(session)) {
      sessions.push(session);
    }
  }

  // Sort by lastActivityAt descending (most recent first)
  return sessions.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
}

