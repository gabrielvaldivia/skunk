import { useState, useEffect } from 'react';
import { subscribeToSessionsForPlayer } from '../services/databaseService';
import type { Session } from '../models/Session';
import { useAuth } from '../context/AuthContext';

export function usePlayerSessions() {
  const { player } = useAuth();
  const playerId = player?.id;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!playerId) return;

    // Live listener instead of polling
    return subscribeToSessionsForPlayer(
      playerId,
      (playerSessions) => {
        setSessions(playerSessions);
        setError(null);
        setLoadedFor(playerId);
      },
      (err) => {
        setError(err);
        setLoadedFor(playerId);
      }
    );
  }, [playerId]);

  return {
    sessions: playerId ? sessions : [],
    isLoading: !!playerId && loadedFor !== playerId,
    error
  };
}
