/**
 * Script to populate the database with 300 universal classic games
 * These games are accessible to all users (no createdByID)
 * 
 * Run this script once to populate the database with the classic games.
 * 
 * Usage from browser console (as admin):
 *   import { populateUniversalGames } from './src/scripts/populate-universal-games';
 *   await populateUniversalGames();
 */

import { top100Games } from "./generate-top-100-games";
import { createGame, getGames } from "../services/databaseService";
import { getCurrentUser } from "../services/authService";
import type { Game } from "../models/Game";

const ADMIN_EMAIL = "valdivia.gabriel@gmail.com";

export interface PopulateProgress {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  errors: Array<{ game: string; error: string }>;
}

/**
 * Populate the database with 300 universal classic games
 * Games are created without createdByID so they're accessible to all users
 * @param onProgress Optional callback to track progress
 * @returns Promise with populate results
 */
export async function populateUniversalGames(
  onProgress?: (progress: PopulateProgress) => void
): Promise<PopulateProgress> {
  // Check if user is admin
  const user = getCurrentUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    throw new Error("Only admins can populate universal games.");
  }

  // Check which games already exist
  const existingGames = await getGames();
  const existingTitles = new Set(existingGames.map((g) => g.title.toLowerCase()));

  const progress: PopulateProgress = {
    total: top100Games.length,
    completed: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  console.log(`Starting population of ${top100Games.length} universal games...`);
  console.log(`Found ${existingGames.length} existing games.`);

  for (let i = 0; i < top100Games.length; i++) {
    const gameData = top100Games[i];
    const titleLower = gameData.title.toLowerCase();
    
    // Skip if game already exists
    if (existingTitles.has(titleLower)) {
      progress.skipped++;
      console.log(`⊘ [${i + 1}/${top100Games.length}] Skipped (exists): ${gameData.title}`);
      continue;
    }
    
    try {
      // Create game without createdByID so it's universal
      const gameToCreate: Omit<Game, "id"> = {
        ...gameData,
        // No createdByID - makes it universal/accessible to all users
        creationDate: Date.now(),
      };

      await createGame(gameToCreate);
      progress.completed++;
      
      console.log(`✓ [${i + 1}/${top100Games.length}] Created: ${gameData.title}`);
    } catch (error) {
      progress.failed++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      progress.errors.push({
        game: gameData.title,
        error: errorMessage,
      });
      
      console.error(`✗ [${i + 1}/${top100Games.length}] Failed: ${gameData.title} - ${errorMessage}`);
    }

    // Report progress if callback provided
    if (onProgress) {
      onProgress({ ...progress });
    }

    // Small delay to avoid overwhelming the database
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  console.log("\n=== Population Complete ===");
  console.log(`Total: ${progress.total}`);
  console.log(`Created: ${progress.completed}`);
  console.log(`Skipped: ${progress.skipped}`);
  console.log(`Failed: ${progress.failed}`);
  
  if (progress.errors.length > 0) {
    console.log("\nErrors:");
    progress.errors.forEach(({ game, error }) => {
      console.log(`  - ${game}: ${error}`);
    });
  }

  return progress;
}

