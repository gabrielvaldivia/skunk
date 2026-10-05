import type { Game } from '../models/Game';
import { findBggMatch, gameFromBgg, type BggGame, type BggResult } from './bgg';

interface ImportDependencies {
  uid: string;
  games: Game[];
  loadDetails: (ids: number[]) => Promise<BggGame[]>;
  saveGame: (game: Omit<Game, 'id'>) => Promise<Game>;
  saveCover?: (game: Game, detail: BggGame) => Promise<void>;
  heartGame: (gameId: string) => Promise<void>;
  onProgress: (done: number, total: number) => void;
}

/** Save in batches, reusing existing entries and reporting partial success. */
export async function importBggGames(selected: BggResult[], deps: ImportDependencies) {
  const unique = [...new Map(selected.map((game) => [game.bggId, game])).values()];
  const catalogue = [...deps.games];
  const added: number[] = [];
  const failed: { bggId: number; title: string; error: string }[] = [];
  for (let offset = 0; offset < unique.length; offset += 20) {
    const batch = unique.slice(offset, offset + 20);
    const missing = batch.filter((result) => {
      const game = findBggMatch(catalogue, result);
      // Retry an interrupted cover submission for your own pending import too.
      return !game || (!!deps.saveCover && game.pending && game.createdByID === deps.uid && !game.coverArt);
    });
    let details: BggGame[] = [];
    let detailsError = '';
    if (missing.length) {
      try { details = await deps.loadDetails(missing.map((game) => game.bggId)); }
      catch (error) { detailsError = error instanceof Error ? error.message : 'Could not load game details.'; }
    }
    for (const result of batch) {
      try {
        let game = findBggMatch(catalogue, result);
        const detail = details.find((item) => item.bggId === result.bggId);
        if (!game) {
          if (!detail) throw new Error(detailsError || 'This game is no longer available on BGG.');
          // BGG search names may be alternate/localized names.
          game = findBggMatch(catalogue, detail);
          if (!game) {
            game = await deps.saveGame(gameFromBgg(detail, deps.uid));
            catalogue.push(game);
          }
        }
        if (deps.saveCover && game.pending && game.createdByID === deps.uid && !game.coverArt) {
          if (!detail) throw new Error(detailsError || 'Could not load the game’s cover. Try again.');
          await deps.saveCover(game, detail);
        }
        await deps.heartGame(game.id);
        added.push(result.bggId);
      } catch (error) {
        failed.push({ bggId: result.bggId, title: result.title, error: error instanceof Error ? error.message : 'Could not save this game.' });
      }
      deps.onProgress(added.length + failed.length, unique.length);
    }
  }
  return { added, failed };
}
