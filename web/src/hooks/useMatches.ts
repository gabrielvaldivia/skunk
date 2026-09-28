import type { Match } from '../models/Match';
import { createMatch, updateMatch, deleteMatch, type FieldUpdates } from '../services/databaseService';

const addMatch = (match: Omit<Match, 'id'>) =>
  createMatch(match).catch((err) => {
    throw err instanceof Error ? err : new Error('Failed to create match');
  });

const editMatch = (matchId: string, updates: FieldUpdates<Match>) =>
  updateMatch(matchId, updates).catch((err) => {
    throw err instanceof Error ? err : new Error('Failed to update match');
  });

const removeMatch = (matchId: string) =>
  deleteMatch(matchId).catch((err) => {
    throw err instanceof Error ? err : new Error('Failed to delete match');
  });

// Match writes; the match lists themselves are live (see useActivity)
export function useMatches() {
  return { addMatch, editMatch, removeMatch };
}
