// Public-domain games with no canonical box. BGG's images for these are
// usually photos of a generic deck or board, so the shelf gives them a
// designed cover and a fitting shape instead.
export type TraditionalKind = "cards" | "board" | "dice" | "party";

const CARDS = [
  "card games",
  "poker", "bridge", "hearts", "spades", "euchre", "rummy", "gin rummy", "canasta", "cribbage",
  "pinochle", "whist", "piquet", "skat", "crazy eights", "go fish", "old maid", "war", "slapjack",
  "spit", "egyptian ratscrew", "blackjack", "solitaire", "klondike solitaire", "spider solitaire",
  "freecell", "hearts (solo)", "oh hell", "500", "sheepshead", "pinochle (auction)", "bid whist",
  "spades (cutthroat)", "hearts (cutthroat)", "rummy 500", "contract rummy", "oklahoma gin",
  "kalooki", "conquian", "shanghai rummy", "liverpool rummy", "gin rummy (oklahoma)", "tonk",
  "kings in the corner", "golf", "palace", "scat", "spite and malice", "speed", "nertz", "pounce",
  "spoons", "pig", "donkey", "snap", "snip snap snorem", "beggar my neighbor", "cheat", "bullshit",
  "i doubt it", "president", "asshole", "scum", "big two", "tien len", "zheng shangyou",
];

const BOARD = [
  "chess", "checkers (draughts)", "go", "backgammon", "xiangqi (chinese chess)",
  "shogi (japanese chess)", "nine men's morris", "mancala", "chinese checkers", "ludo", "pachisi",
  "snakes and ladders", "tic-tac-toe", "dots and boxes", "gomoku", "connect 6", "hex", "carrom",
  "dominoes", "mahjong", "mexican train",
];

const DICE = ["liar's dice", "farkle", "ten thousand", "bunco"];

const PARTY = ["charades", "mafia"];

const KINDS = new Map<string, TraditionalKind>([
  ...CARDS.map((t) => [t, "cards"] as const),
  ...BOARD.map((t) => [t, "board"] as const),
  ...DICE.map((t) => [t, "dice"] as const),
  ...PARTY.map((t) => [t, "party"] as const),
]);

export function traditionalKind(title: string): TraditionalKind | undefined {
  return KINDS.get(title.trim().toLowerCase());
}
