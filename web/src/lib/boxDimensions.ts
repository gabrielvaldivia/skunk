import type { BoxDims, Game } from "@/models/Game";
import { traditionalKind, type TraditionalKind } from "./traditionalGames";

// Common board game box sizes, in inches (cover width × cover height × depth).
// Most boxes fall into one of these, so a preset plus the cover's shape gets
// proportions right without per-game measurements.
export type BoxPreset = { id: string; label: string; example: string; dims: BoxDims; inferable: boolean };

export const BOX_PRESETS: BoxPreset[] = [
  { id: "square", label: "Standard square", example: "Catan, Ticket to Ride", dims: { width: 11.7, length: 11.7, depth: 2.8 }, inferable: true },
  { id: "square-medium", label: "Medium square", example: "Azul", dims: { width: 10.2, length: 10.2, depth: 2.8 }, inferable: false },
  { id: "square-small", label: "Small square", example: "Patchwork", dims: { width: 8, length: 8, depth: 2 }, inferable: false },
  { id: "landscape", label: "Rectangle", example: "Pandemic", dims: { width: 11.8, length: 8.7, depth: 1.8, orientation: "landscape" }, inferable: true },
  { id: "landscape-medium", label: "Medium rectangle", example: "Carcassonne", dims: { width: 10.8, length: 7.5, depth: 2.4, orientation: "landscape" }, inferable: true },
  { id: "portrait", label: "Tall box", example: "Ark Nova", dims: { width: 11.8, length: 14.6, depth: 2.8, orientation: "portrait" }, inferable: true },
  { id: "portrait-small", label: "Small tall box", example: "Codenames", dims: { width: 6.4, length: 9.1, depth: 2, orientation: "portrait" }, inferable: true },
  { id: "big-box", label: "Big box", example: "Gloomhaven", dims: { width: 11.5, length: 16, depth: 7.5, orientation: "portrait" }, inferable: false },
  { id: "card-game", label: "Small card game", example: "Love Letter, Sushi Go", dims: { width: 4.1, length: 5.9, depth: 1.3, orientation: "portrait" }, inferable: false },
  { id: "card-deck", label: "Deck of cards", example: "Hearts, Poker", dims: { width: 2.5, length: 3.5, depth: 0.75, orientation: "portrait" }, inferable: false },
];

export const DEFAULT_BOX: BoxDims = BOX_PRESETS[0].dims;

// Hand-checked English editions from BGG version data, keyed by lowercase title.
// Stopgap until games carry their own boxDims.
const KNOWN_BOXES: Record<string, BoxDims> = {
  catan: { width: 11.7, length: 11.7, depth: 2.8 },
  pandemic: { width: 11.81, length: 8.66, depth: 1.65, orientation: "landscape" },
  carcassonne: { width: 10.83, length: 7.48, depth: 2.36, orientation: "landscape" },
  "ticket to ride": { width: 11.7, length: 11.7, depth: 2.8 },
  wingspan: { width: 11.56, length: 11.56, depth: 3.0 },
  gloomhaven: { width: 11.5, length: 16.0, depth: 7.5, orientation: "portrait" },
  "terraforming mars": { width: 11.7, length: 11.7, depth: 2.8 },
  azul: { width: 10.24, length: 10.24, depth: 2.76 },
  codenames: { width: 6.38, length: 9.13, depth: 1.97, orientation: "portrait" },
  "ark nova": { width: 11.81, length: 14.57, depth: 2.76, orientation: "portrait" },
};

function faceAspect(dims: BoxDims) {
  const [, short, long] = [dims.width, dims.length, dims.depth].sort((a, b) => a - b);
  return dims.orientation === "portrait" ? short / long : long / short;
}

/** Closest common box for a cover of the given width/height ratio */
export function inferPreset(coverAspect: number): BoxPreset {
  // Covers within ~10% of square are treated as square; photos are rarely exact
  if (coverAspect > 0.9 && coverAspect < 1.1) return BOX_PRESETS[0];
  let best = BOX_PRESETS[0];
  let bestDist = Infinity;
  for (const preset of BOX_PRESETS) {
    if (!preset.inferable) continue;
    const dist = Math.abs(Math.log(faceAspect(preset.dims) / coverAspect));
    if (dist < bestDist) {
      best = preset;
      bestDist = dist;
    }
  }
  return best;
}

/** The preset a stored size matches, if any */
export function presetFor(dims: BoxDims | undefined): BoxPreset | undefined {
  if (!dims) return undefined;
  return BOX_PRESETS.find(
    (p) =>
      p.dims.width === dims.width &&
      p.dims.length === dims.length &&
      p.dims.depth === dims.depth &&
      (p.dims.orientation ?? null) === (dims.orientation ?? null)
  );
}

const TRADITIONAL_PRESET: Record<TraditionalKind, string> = {
  cards: "card-deck",
  board: "square-medium",
  dice: "square-small",
  party: "card-game",
};

/** Where a game's box size comes from, in priority order */
export function resolveBoxDims(game: Game, coverAspect?: number): BoxDims {
  if (game.boxDims) return game.boxDims;
  const known = KNOWN_BOXES[game.title.trim().toLowerCase()];
  if (known) return known;
  // A real cover's shape beats guessing from the kind of game
  if (coverAspect) return inferPreset(coverAspect).dims;
  const kind = traditionalKind(game.title);
  if (kind) return BOX_PRESETS.find((p) => p.id === TRADITIONAL_PRESET[kind])!.dims;
  return DEFAULT_BOX;
}

export type ShelfBox = {
  /** Cover width, along the shelf */
  width: number;
  /** Cover height */
  height: number;
  /** Box thickness, into the shelf */
  depth: number;
};

// BGG's width/length order is inconsistent, so normalize: the smallest side is
// the thickness, and the cover is landscape unless marked portrait (most
// rectangular board game boxes are displayed landscape).
export function shelfBoxFor(game: Game, coverAspect?: number): ShelfBox {
  const dims = resolveBoxDims(game, coverAspect);
  const sides = [dims.width, dims.length, dims.depth].filter((n) => n > 0).sort((x, y) => x - y);
  if (sides.length < 3) return shelfBoxFor({ ...game, boxDims: DEFAULT_BOX });
  const [depth, short, long] = sides;
  return dims.orientation === "portrait"
    ? { width: short, height: long, depth }
    : { width: long, height: short, depth };
}
