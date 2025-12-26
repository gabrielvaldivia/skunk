import { useState, useEffect } from 'react';
import { getSessionsForPlayer } from '../services/databaseService';
import type { Session } from '../models/Session';
import { useAuth } from '../context/AuthContext';

export function usePlayerSessions() {
  const { player } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!player) {
      setSessions([]);
      setIsLoading(false);
      return;
    }

    const fetchSessions = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const playerSessions = await getSessionsForPlayer(player.id);
        setSessions(playerSessions);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch sessions'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();

    // Refresh sessions every 10 seconds to catch updates
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, [player]);

  return {
    sessions,
    isLoading,
    error
  };
}

