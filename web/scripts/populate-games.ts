/**
 * Node.js script to populate Firebase database with 300 universal classic games
 * 
 * Usage:
 *   npm run populate-games
 * 
 * Requires Firebase environment variables to be set in .env file
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, push, set } from 'firebase/database';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { top100Games } from '../src/scripts/generate-top-100-games.js';
import type { Game } from '../src/models/Game.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file if it exists
let envVars: Record<string, string> = {};
try {
  const envPath = join(__dirname, '../.env');
  const envFile = readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      envVars[match[1].trim()] = match[2].trim();
    }
  });
} catch (e) {
  // .env file doesn't exist, will use process.env
}

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: envVars.VITE_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
  authDomain: envVars.VITE_FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: envVars.VITE_FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL,
  projectId: envVars.VITE_FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: envVars.VITE_FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envVars.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: envVars.VITE_FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID
};

// Validate config
const requiredVars = ['apiKey', 'authDomain', 'databaseURL', 'projectId'];
const missing = requiredVars.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);
if (missing.length > 0) {
  console.error('❌ Missing required Firebase configuration:');
  missing.forEach(key => console.error(`   - ${key}`));
  console.error('\nPlease set these in your .env file or environment variables.');
  console.error('Required variables:');
  console.error('  VITE_FIREBASE_API_KEY');
  console.error('  VITE_FIREBASE_AUTH_DOMAIN');
  console.error('  VITE_FIREBASE_DATABASE_URL');
  console.error('  VITE_FIREBASE_PROJECT_ID');
  process.exit(1);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Convert game data to database format
function convertGameData(gameData: Omit<Game, "id" | "createdByID" | "creationDate">): Omit<Game, "id"> {
  return {
    title: gameData.title,
    isBinaryScore: gameData.isBinaryScore,
    isTeamBased: gameData.isTeamBased,
    supportedPlayerCounts: gameData.supportedPlayerCounts,
    // No createdByID - makes it universal/accessible to all users
    countAllScores: gameData.countAllScores,
    countLosersOnly: gameData.countLosersOnly,
    highestScoreWins: gameData.highestScoreWins,
    highestRoundScoreWins: gameData.highestRoundScoreWins,
    winningConditions: gameData.winningConditions,
    creationDate: Date.now()
  };
}

async function populateGames() {
  console.log('🚀 Starting to populate database with 300 classic games...\n');

  // Check existing games
  const gamesRef = ref(database, 'games');
  let existingGames: Game[] = [];
  try {
    const snapshot = await get(gamesRef);
    if (snapshot.exists()) {
      const gamesData = snapshot.val();
      existingGames = Object.values(gamesData) as Game[];
    }
  } catch (error) {
    console.error('Error checking existing games:', error);
  }

  const existingTitles = new Set(existingGames.map(g => g.title?.toLowerCase()).filter(Boolean));
  console.log(`📊 Found ${existingGames.length} existing games\n`);

  let completed = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ game: string; error: string }> = [];

  for (let i = 0; i < top100Games.length; i++) {
    const gameData = top100Games[i];
    const titleLower = gameData.title.toLowerCase();

    // Skip if already exists
    if (existingTitles.has(titleLower)) {
      skipped++;
      console.log(`⊘ [${i + 1}/${top100Games.length}] Skipped (exists): ${gameData.title}`);
      continue;
    }

    try {
      const gameToCreate = convertGameData(gameData);
      const newGameRef = push(gamesRef);
      const gameId = newGameRef.key;

      if (!gameId) {
        throw new Error('Failed to generate game ID');
      }

      await set(newGameRef, {
        ...gameToCreate,
        id: gameId
      });

      completed++;
      console.log(`✓ [${i + 1}/${top100Games.length}] Created: ${gameData.title}`);
    } catch (error) {
      failed++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({ game: gameData.title, error: errorMessage });
      console.error(`✗ [${i + 1}/${top100Games.length}] Failed: ${gameData.title} - ${errorMessage}`);
    }

    // Small delay to avoid overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Population Complete!');
  console.log('='.repeat(50));
  console.log(`Total games: ${top100Games.length}`);
  console.log(`✅ Created: ${completed}`);
  console.log(`⊘ Skipped: ${skipped}`);
  console.log(`❌ Failed: ${failed}`);

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(({ game, error }) => {
      console.log(`   - ${game}: ${error}`);
    });
  }

  console.log('\n🎉 Done! All games are now accessible to all users.');
}

// Run the script
populateGames()
  .then(() => {
    console.log('\n✨ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });

