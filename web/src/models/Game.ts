export type Game = {
  id: string;
  title: string;
  isBinaryScore: boolean;
  supportedPlayerCounts: number[];
  createdByID?: string;
  countAllScores: boolean;
  countLosersOnly: boolean;
  highestScoreWins: boolean;
  highestRoundScoreWins: boolean;
  winningConditions: string;
  creationDate?: number;
};
