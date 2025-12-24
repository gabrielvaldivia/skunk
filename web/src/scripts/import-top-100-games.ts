/**
 * Script to import the top 300 board games and card games into the database
 * 
 * Usage:
 * 1. Ensure you are authenticated in the app
 * 2. Call importTop100Games() from the browser console or integrate into the app
 * 
 * Example (from browser console):
 *   import { importTop100Games } from './scripts/import-top-100-games';
 *   await importTop100Games();
 */

import { top100Games } from "./generate-top-100-games";
import { createGame } from "../services/databaseService";
import { getCurrentUser } from "../services/authService";
import type { Game } from "../models/Game";

export interface ImportProgress {
  total: number;
  completed: number;
  failed: number;
  errors: Array<{ game: string; error: string }>;
}

/**
 * Import all top 300 games into the database
 * @param userId Optional user ID. If not provided, uses current authenticated user
 * @param onProgress Optional callback to track progress
 * @returns Promise with import results
 */
export async function importTop100Games(
  userId?: string,
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportProgress> {
  // Get current user if userId not provided
  if (!userId) {
    const user = getCurrentUser();
    if (!user) {
      throw new Error(
        "No user authenticated. Please sign in before importing games."
      );
    }
    userId = user.uid;
  }

  const progress: ImportProgress = {
    total: top100Games.length,
    completed: 0,
    failed: 0,
    errors: [],
  };

  console.log(`Starting import of ${top100Games.length} games...`);

  for (let i = 0; i < top100Games.length; i++) {
    const gameData = top100Games[i];
    
    try {
      const gameToCreate: Omit<Game, "id"> = {
        ...gameData,
        createdByID: userId,
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
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log("\n=== Import Complete ===");
  console.log(`Total: ${progress.total}`);
  console.log(`Completed: ${progress.completed}`);
  console.log(`Failed: ${progress.failed}`);
  
  if (progress.errors.length > 0) {
    console.log("\nErrors:");
    progress.errors.forEach(({ game, error }) => {
      console.log(`  - ${game}: ${error}`);
    });
  }

  return progress;
}

/**
 * Import a single game by index (for testing or selective imports)
 * @param index Index in the top100Games array (0-99)
 * @param userId Optional user ID
 * @returns Promise with created game
 */
export async function importSingleGame(
  index: number,
  userId?: string
): Promise<Game> {
  if (index < 0 || index >= top100Games.length) {
    throw new Error(`Invalid index: ${index}. Must be between 0 and ${top100Games.length - 1}`);
  }

  if (!userId) {
    const user = getCurrentUser();
    if (!user) {
      throw new Error("No user authenticated. Please sign in before importing games.");
    }
    userId = user.uid;
  }

  const gameData = top100Games[index];
  const gameToCreate: Omit<Game, "id"> = {
    ...gameData,
    createdByID: userId,
    creationDate: Date.now(),
  };

  return await createGame(gameToCreate);
}

/**
 * Check if games already exist in the database (by title)
 * This is a helper function that can be used before importing
 * Note: This requires access to getGames() from databaseService
 */
export async function checkExistingGames(): Promise<{
  existing: string[];
  new: string[];
}> {
  // Dynamic import to avoid circular dependencies
  const { getGames } = await import("../services/databaseService");
  const existingGames = await getGames();
  const existingTitles = new Set(existingGames.map((g) => g.title.toLowerCase()));

  const newGames: string[] = [];
  const existing: string[] = [];

  top100Games.forEach((game) => {
    const titleLower = game.title.toLowerCase();
    if (existingTitles.has(titleLower)) {
      existing.push(game.title);
    } else {
      newGames.push(game.title);
    }
  });

  return { existing, new: newGames };
}

// Note: This script is designed to run in the browser context.
// Use it from the browser console or integrate it into your app.
// Example usage from browser console:
//   import { importTop100Games } from './scripts/import-top-100-games';
//   await importTop100Games();

