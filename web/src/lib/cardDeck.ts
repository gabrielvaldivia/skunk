import type { Game } from "@/models/Game";
import { traditionalKind } from "./traditionalGames";

// Every standard-deck card game shares one physical object: a deck of cards.
// The shelf shows it once, and the panel picks which game you mean.
export const CARD_DECK_ID = "__card-games__";

export const CARD_DECK: Game = {
  id: CARD_DECK_ID,
  title: "Card Games",
  isBinaryScore: true,
  isTeamBased: false,
  supportedPlayerCounts: [],
  countAllScores: false,
  countLosersOnly: false,
  highestScoreWins: true,
  highestRoundScoreWins: true,
  winningConditions: "",
  // A two-deck card box: a single deck would be too small to tap on a phone
  boxDims: { width: 4.6, length: 6.4, depth: 1.8, orientation: "portrait" },
};

export const isCardGame = (game: Game) => traditionalKind(game.title) === "cards";

/**
 * Splits games into what the shelf shows and the card games folded into the
 * deck. The deck appears when any card game matches the search, or when the
 * search matches the deck itself ("card…"), in which case it holds them all.
 */
export function foldCardGames(games: Game[], query: string) {
  const q = query.trim().toLowerCase();
  const matches = (g: Game) => !q || g.title.toLowerCase().includes(q);
  const cardGames = games.filter(isCardGame);
  const deckMatches = !!q && CARD_DECK.title.toLowerCase().includes(q);
  const inDeck = deckMatches ? cardGames : cardGames.filter(matches);
  const shelf = games.filter((g) => !isCardGame(g) && matches(g));
  if (inDeck.length) shelf.push(CARD_DECK);
  shelf.sort((a, b) => a.title.localeCompare(b.title));
  return { shelf, inDeck };
}
