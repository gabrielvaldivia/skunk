import type { Match } from '../models/Match';
import { createMatch, updateMatch, deleteMatch, type FieldUpdates } from '../services/databaseService';
import { refreshActivity } from './useActivity';

const addMatch = (match: Omit<Match, 'id'>) =>
  createMatch(match).then((created) => {
    void refreshActivity();
    return created;
  }).catch((err) => {
    throw err instanceof Error ? err : new Error('Failed to create match');
  });

const editMatch = (matchId: string, updates: FieldUpdates<Match>) =>
  updateMatch(matchId, updates).then(() => void refreshActivity()).catch((err) => {
    throw err instanceof Error ? err : new Error('Failed to update match');
  });

const removeMatch = (matchId: string) =>
  deleteMatch(matchId).then(() => void refreshActivity()).catch((err) => {
    throw err instanceof Error ? err : new Error('Failed to delete match');
  });

// Match writes; each one re-reads match history (see useActivity)
export function useMatches() {
  return { addMatch, editMatch, removeMatch };
}
