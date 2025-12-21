import type { Game } from './Game';
import type { Player } from './Player';

export type Match = {
  id: string;
  gameID: string;
  date: number; // Timestamp
  playerIDs: string[];
  playerIDsString?: string; // Sorted, comma-joined for querying
  playerOrder: string[];
  winnerID?: string;
  isMultiplayer: boolean;
  status: string; // e.g., "active"
  invitedPlayerIDs?: string[];
  acceptedPlayerIDs?: string[];
  createdByID?: string;
  sessionCode?: string; // Optional session code if match was created in a session
  scores: number[]; // Final scores for each player (by playerOrder)
  rounds: number[][]; // 2D array: [round][playerIndex] = score
  lastModified: number; // Timestamp
  
  // Optional populated fields
  game?: Game;
  winner?: Player;
};

/**
 * Calculate the winner ID for a match based on game rules
 * This matches the logic from Match.computedWinnerID in Swift
 */
export function computeWinnerID(match: Match, game: Game): string | undefined {
  if (!game || match.scores.length === 0) {
    return match.winnerID;
  }

  if (game.isBinaryScore) {
    // Binary scores: Winner is player with score of 1
    const winnerIndex = match.scores.findIndex(score => score === 1);
    if (winnerIndex !== -1 && winnerIndex < match.playerOrder.length) {
      return match.playerOrder[winnerIndex];
    }
    return match.winnerID;
  }

  // Non-binary scores: Winner determined by highestScoreWins flag
  let winnerIndex: number;
  if (game.highestScoreWins) {
    // Find index with maximum score
    winnerIndex = match.scores.reduce((maxIdx, score, idx) => 
      score > match.scores[maxIdx] ? idx : maxIdx, 0
    );
  } else {
    // Find index with minimum score
    winnerIndex = match.scores.reduce((minIdx, score, idx) => 
      score < match.scores[minIdx] ? idx : minIdx, 0
    );
  }

  if (winnerIndex < match.playerOrder.length) {
    return match.playerOrder[winnerIndex];
  }
  
  return match.winnerID;
}
