import { useState, useEffect } from 'react';
import type { Match } from '../models/Match';
import { getRecentMatches } from '../services/databaseService';

export function useActivity(limit: number = 500, daysBack: number = 365 * 10) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMatches = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const fetchedMatches = await getRecentMatches(limit, daysBack);
      setMatches(fetchedMatches);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch matches'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [limit, daysBack]);

  return {
    matches,
    isLoading,
    error,
    fetchMatches
  };
}

