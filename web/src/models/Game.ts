import { asBoolean, asNumber, asNumberArray, asRecord, asString } from "./parse";

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
  coverArt?: string; // Image URL (Firebase Storage) or legacy data: URL; square aspect ratio
};

export function parseGame(id: string, value: unknown): Game {
  const raw = asRecord(value);
  const game: Game = {
    id,
    title: asString(raw.title) ?? "Untitled game",
    isBinaryScore: asBoolean(raw.isBinaryScore) ?? false,
    isTeamBased: asBoolean(raw.isTeamBased) ?? false,
    supportedPlayerCounts: asNumberArray(raw.supportedPlayerCounts),
    countAllScores: asBoolean(raw.countAllScores) ?? false,
    countLosersOnly: asBoolean(raw.countLosersOnly) ?? false,
    highestScoreWins: asBoolean(raw.highestScoreWins) ?? true,
    highestRoundScoreWins: asBoolean(raw.highestRoundScoreWins) ?? true,
    winningConditions: asString(raw.winningConditions) ?? "",
  };
  const createdByID = asString(raw.createdByID);
  if (createdByID) game.createdByID = createdByID;
  const creationDate = asNumber(raw.creationDate);
  if (creationDate !== undefined) game.creationDate = creationDate;
  const coverArt = asString(raw.coverArt);
  if (coverArt) game.coverArt = coverArt;
  return game;
}
