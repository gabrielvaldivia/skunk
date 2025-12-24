import { useState, useEffect, useRef } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../services/firebase';
import type { Match } from '../models/Match';

const MATCHES_PATH = 'matches';

export function useActivity(limit: number = 500, daysBack: number = 365 * 10) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasReceivedData = useRef(false);

  useEffect(() => {
    const matchesRef = ref(database, MATCHES_PATH);
    const cutoffDate = Date.now() - (daysBack * 24 * 60 * 60 * 1000);

    // Only set loading to true on initial mount, not on subsequent updates
    if (!hasReceivedData.current) {
      setIsLoading(true);
    }
    setError(null);

    const unsubscribe = onValue(
      matchesRef,
      (snapshot) => {
        try {
          if (!snapshot.exists()) {
            setMatches([]);
            setIsLoading(false);
            hasReceivedData.current = true;
            return;
          }

          const matchesData = snapshot.val();
          const allMatches: Match[] = [];

          for (const matchId in matchesData) {
            const match = matchesData[matchId];
            // Filter by date
            if (match.date >= cutoffDate) {
              allMatches.push({
                id: matchId,
                ...match
              });
            }
          }

          // Sort by date descending and limit
          const sortedMatches = allMatches
            .sort((a, b) => b.date - a.date)
            .slice(0, limit);

          setMatches(sortedMatches);
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err : new Error('Failed to process matches'));
        } finally {
          setIsLoading(false);
          hasReceivedData.current = true;
        }
      },
      (err) => {
        setError(err instanceof Error ? err : new Error('Failed to fetch matches'));
        setIsLoading(false);
        hasReceivedData.current = true;
      }
    );

    // Cleanup listener on unmount
    return () => {
      unsubscribe();
    };
  }, [limit, daysBack]);

  return {
    matches,
    isLoading,
    error
  };
}

