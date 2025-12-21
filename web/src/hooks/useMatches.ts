import { useState } from 'react';
import type { Match } from '../models/Match';
import { createMatch, updateMatch, deleteMatch } from '../services/databaseService';

export function useMatches() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const addMatch = async (match: Omit<Match, 'id'>) => {
    try {
      setIsLoading(true);
      setError(null);
      const newMatch = await createMatch(match);
      return newMatch;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create match');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const editMatch = async (matchId: string, updates: Partial<Match>) => {
    try {
      setIsLoading(true);
      setError(null);
      await updateMatch(matchId, updates);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update match');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const removeMatch = async (matchId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      await deleteMatch(matchId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete match');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    error,
    addMatch,
    editMatch,
    removeMatch
  };
}

