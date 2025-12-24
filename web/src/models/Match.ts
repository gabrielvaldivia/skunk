import type { Game } from './Game';
import type { Player } from './Player';

export type Team = {
  teamId: string;
  playerIDs: string[];
  score?: number; // Aggregated team score (calculated)
};

export type Match = {
  id: string;
  gameID: string;
  date: number; // Timestamp
  playerIDs: string[];
  playerIDsString?: string; // Sorted, comma-joined for querying
  playerOrder: string[];
  winnerID?: string;
  winnerTeamId?: string; // For team-based games
  teams?: Team[]; // Team assignments for team-based games
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
 * For team-based games, returns winnerTeamId instead of winnerID
 * This matches the logic from Match.computedWinnerID in Swift
 */
export function computeWinnerID(match: Match, game: Game): string | undefined {
  if (!game || match.scores.length === 0) {
    return match.winnerID || match.winnerTeamId;
  }

  // Handle team-based games
  if (game.isTeamBased && match.teams && match.teams.length > 0) {
    // Calculate team scores by aggregating player scores
    const teamScores = match.teams.map(team => {
      const teamScore = team.playerIDs.reduce((total, playerId) => {
        const playerIndex = match.playerOrder.indexOf(playerId);
        if (playerIndex !== -1 && match.scores[playerIndex] !== undefined) {
          return total + match.scores[playerIndex];
        }
        return total;
      }, 0);
      return { teamId: team.teamId, score: teamScore };
    });

    // Find winning team
    let winningTeamId: string | undefined;
    if (game.isBinaryScore) {
      // For binary scores, find team with at least one player having score of 1
      const winningTeam = match.teams.find(team => {
        return team.playerIDs.some(playerId => {
          const playerIndex = match.playerOrder.indexOf(playerId);
          return playerIndex !== -1 && match.scores[playerIndex] === 1;
        });
      });
      winningTeamId = winningTeam?.teamId;
    } else {
      // Non-binary: find team with highest/lowest score
      if (game.highestScoreWins) {
        const maxScore = Math.max(...teamScores.map(t => t.score));
        winningTeamId = teamScores.find(t => t.score === maxScore)?.teamId;
      } else {
        const minScore = Math.min(...teamScores.map(t => t.score));
        winningTeamId = teamScores.find(t => t.score === minScore)?.teamId;
      }
    }

    return winningTeamId;
  }

  // Individual player games (existing logic)
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
