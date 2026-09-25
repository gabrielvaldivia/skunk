export type BoxDims = {
  width: number;
  length: number;
  depth: number;
  // Which way the cover art reads; BGG's width/length order can't tell us
  orientation?: "portrait" | "landscape";
};

export type Game = {
  id: string;
  title: string;
  isBinaryScore: boolean;
  isTeamBased: boolean;
  supportedPlayerCounts: number[];
  createdByID?: string;
  countAllScores: boolean;
  countLosersOnly: boolean;
  highestScoreWins: boolean;
  highestRoundScoreWins: boolean;
  winningConditions: string;
  creationDate?: number;
  coverArt?: string; // URL to square aspect ratio cover art image
  bggId?: number;
  // Physical box size in inches (BGG version data: width × length × depth)
  boxDims?: BoxDims;
};
