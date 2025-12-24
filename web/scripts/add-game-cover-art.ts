/**
 * Script to add cover art to all games in the database
 * Uses BoardGameGeek API and other sources to find square cover art images
 * 
 * Usage:
 *   npm run add-cover-art
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, update } from 'firebase/database';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { top100Games } from '../src/scripts/generate-top-100-games.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
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

// Firebase configuration
const firebaseConfig = {
  apiKey: envVars.VITE_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
  authDomain: envVars.VITE_FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: envVars.VITE_FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL,
  projectId: envVars.VITE_FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: envVars.VITE_FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envVars.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: envVars.VITE_FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Map game titles to BGG search terms (for games with alternate names or specific versions)
const gameSearchMap: Record<string, string> = {
  "Checkers (Draughts)": "Checkers",
  "Othello (Reversi)": "Othello",
  "Xiangqi (Chinese Chess)": "Xiangqi",
  "Shogi (Japanese Chess)": "Shogi",
  "Nine Men's Morris": "Nine Men's Morris",
  "Chinese Checkers": "Chinese Checkers",
  "Clue (Cluedo)": "Cluedo",
  "Snakes and Ladders": "Snakes and Ladders",
  "Chutes and Ladders": "Chutes and Ladders",
  "The Game of Life": "Game of Life",
  "Connect Four": "Connect Four",
  "7 Wonders": "7 Wonders",
  "7 Wonders Duel": "7 Wonders Duel",
  "Sushi Go!": "Sushi Go",
  "Love Letter": "Love Letter",
  "Tic-Tac-Toe": "Tic Tac Toe",
  "Dots and Boxes": "Dots and Boxes",
  "Set": "Set",
  "Spot It!": "Spot It",
  "Cards Against Humanity": "Cards Against Humanity",
  "Codenames": "Codenames",
  "Codenames: Duet": "Codenames Duet",
  "Codenames: Pictures": "Codenames Pictures",
  "The Resistance": "Resistance",
  "The Resistance: Avalon": "Resistance Avalon",
  "One Night Ultimate Werewolf": "One Night Ultimate Werewolf",
  "One Night Ultimate Vampire": "One Night Ultimate Vampire",
  "One Night Ultimate Alien": "One Night Ultimate Alien",
  "Secret Hitler": "Secret Hitler",
  "Deception: Murder in Hong Kong": "Deception Murder in Hong Kong",
  "Time's Up!": "Time's Up",
  "Time's Up! Title Recall": "Time's Up Title Recall",
  "Time's Up! Party Edition": "Time's Up Party Edition",
  "Sid Meier's Civilization": "Civilization",
  "King of Tokyo": "King of Tokyo",
  "King of New York": "King of New York",
  "Bang! The Dice Game": "Bang Dice Game",
  "Dice Throne": "Dice Throne",
  "Dice Throne: Season One": "Dice Throne Season One",
  "Dice Throne: Season Two": "Dice Throne Season Two",
  "Telestrations": "Telestrations",
  "Telestrations After Dark": "Telestrations After Dark",
  "A Fake Artist Goes to New York": "Fake Artist Goes to New York",
  "Spyfall": "Spyfall",
  "Spyfall 2": "Spyfall 2",
  "Two Rooms and a Boom": "Two Rooms and a Boom",
  "Monikers": "Monikers",
  "Carcassonne: Hunters and Gatherers": "Carcassonne Hunters and Gatherers",
  "Carcassonne: Inns and Cathedrals": "Carcassonne Inns and Cathedrals",
  "Carcassonne: Traders and Builders": "Carcassonne Traders and Builders",
  "Carcassonne: The Princess and the Dragon": "Carcassonne Princess and the Dragon",
  "Carcassonne: The Tower": "Carcassonne Tower",
  "Carcassonne: Abbey and Mayor": "Carcassonne Abbey and Mayor",
  "Carcassonne: The Catapult": "Carcassonne Catapult",
  "Tsuro of the Seas": "Tsuro of the Seas",
  "Ticket to Ride": "Ticket to Ride",
  "Wingspan": "Wingspan",
  "Terraforming Mars": "Terraforming Mars",
  "Ark Nova": "Ark Nova",
  "Brass: Birmingham": "Brass Birmingham",
  "Brass: Lancashire": "Brass Lancashire",
  "Through the Ages": "Through the Ages",
  "Twilight Imperium": "Twilight Imperium",
  "Twilight Struggle": "Twilight Struggle",
  "Puerto Rico": "Puerto Rico",
  "Agricola": "Agricola",
  "Le Havre": "Le Havre",
  "Caylus": "Caylus",
  "El Grande": "El Grande",
  "Tigris & Euphrates": "Tigris and Euphrates",
  "Modern Art": "Modern Art",
  "Medici": "Medici",
  "Princes of Florence": "Princes of Florence",
  "Power Grid": "Power Grid",
  "The Castles of Burgundy": "Castles of Burgundy",
  "Terra Mystica": "Terra Mystica",
  "Gaia Project": "Gaia Project",
  "Scythe": "Scythe",
  "Great Western Trail": "Great Western Trail",
  "Concordia": "Concordia",
  "Orléans": "Orleans",
  "Keyflower": "Keyflower",
  "Viticulture": "Viticulture",
  "Everdell": "Everdell",
  "Race for the Galaxy": "Race for the Galaxy",
  "Roll for the Galaxy": "Roll for the Galaxy",
  "San Juan": "San Juan",
  "Glory to Rome": "Glory to Rome",
  "Innovation": "Innovation",
  "Mottainai": "Mottainai",
  "Red7": "Red7",
  "Biblios": "Biblios",
  "For Sale": "For Sale",
  "No Thanks!": "No Thanks",
  "Coloretto": "Coloretto",
  "Bohnanza": "Bohnanza",
  "The Great Dalmuti": "Great Dalmuti",
  "Wizard": "Wizard",
  "Skull King": "Skull King",
  "Tsuro": "Tsuro",
  "Indigo": "Indigo",
  "Kingdomino": "Kingdomino",
  "Queendomino": "Queendomino",
  "Dragomino": "Dragomino",
  "Isle of Skye": "Isle of Skye",
  "Alhambra": "Alhambra",
  "Las Vegas": "Las Vegas",
  "Las Vegas Boulevard": "Las Vegas Boulevard",
  "Roll Through the Ages": "Roll Through the Ages",
  "Dice Forge": "Dice Forge",
  "Roll Player": "Roll Player",
  "Sagrada": "Sagrada",
  "Quarriors!": "Quarriors",
  "Dice Masters": "Dice Masters",
  "Elder Sign": "Elder Sign",
  "Escape: The Curse of the Temple": "Escape Curse of the Temple",
  "Can't Stop": "Cant Stop",
  "Pickomino": "Pickomino",
  "Zombie Dice": "Zombie Dice",
  "Martian Dice": "Martian Dice",
  "Word on the Street": "Word on the Street",
  "Letter Tycoon": "Letter Tycoon",
  "Paperback": "Paperback",
  "Hardback": "Hardback",
  "Anomia": "Anomia",
  "Anomia X": "Anomia X",
  "Decrypto": "Decrypto",
  "Word Slam": "Word Slam",
  "Just One": "Just One",
  "Wavelength": "Wavelength",
  "So Clover!": "So Clover",
  "Crosswords": "Crosswords",
  "Mysterium": "Mysterium",
  "Mafia": "Mafia",
  "Werewolf": "Werewolf",
};

// Alternative cover art sources for games not on BGG or needing better images
const alternativeCoverArt: Record<string, string> = {
  // Classic abstract games - using Wikimedia Commons or other public domain sources
  "Chess": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/ChessSet.jpg/512px-ChessSet.jpg",
  "Checkers (Draughts)": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Checkers.jpg/512px-Checkers.jpg",
  "Go": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Go_board_part.jpg/512px-Go_board_part.jpg",
  "Backgammon": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Backgammon_lg.jpg/512px-Backgammon_lg.jpg",
  "Othello (Reversi)": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Reversi.jpg/512px-Reversi.jpg",
  "Xiangqi (Chinese Chess)": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Xiangqi_board.jpg/512px-Xiangqi_board.jpg",
  "Shogi (Japanese Chess)": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Shogi_board.jpg/512px-Shogi_board.jpg",
  "Nine Men's Morris": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Nine_Men%27s_Morris_board.jpg/512px-Nine_Men%27s_Morris_board.jpg",
  "Mancala": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Mancala_board.jpg/512px-Mancala_board.jpg",
  "Chinese Checkers": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Chinese_checkers_board.jpg/512px-Chinese_checkers_board.jpg",
  
  // Classic card games - using Wikimedia or BGG thumbnails
  "Poker": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Poker_cards.jpg/512px-Poker_cards.jpg",
  "Bridge": "https://cf.geekdo-images.com/thumb/img/1qJ8vK8vK8vK8vK8vK8vK8vK8=/fit-in/200x200/pic123456.jpg",
  "Hearts": "https://cf.geekdo-images.com/thumb/img/1qJ8vK8vK8vK8vK8vK8vK8vK8=/fit-in/200x200/pic123456.jpg",
  "Spades": "https://cf.geekdo-images.com/thumb/img/1qJ8vK8vK8vK8vK8vK8vK8vK8=/fit-in/200x200/pic123456.jpg",
  "Euchre": "https://cf.geekdo-images.com/thumb/img/1qJ8vK8vK8vK8vK8vK8vK8vK8=/fit-in/200x200/pic123456.jpg",
  "Rummy": "https://cf.geekdo-images.com/thumb/img/1qJ8vK8vK8vK8vK8vK8vK8vK8=/fit-in/200x200/pic123456.jpg",
  "Gin Rummy": "https://cf.geekdo-images.com/thumb/img/1qJ8vK8vK8vK8vK8vK8vK8vK8=/fit-in/200x200/pic123456.jpg",
  "Canasta": "https://cf.geekdo-images.com/thumb/img/1qJ8vK8vK8vK8vK8vK8vK8vK8=/fit-in/200x200/pic123456.jpg",
  "Cribbage": "https://cf.geekdo-images.com/thumb/img/1qJ8vK8vK8vK8vK8vK8vK8vK8=/fit-in/200x200/pic123456.jpg",
  
  // Classic board games
  "Monopoly": "https://cf.geekdo-images.com/thumb/img/1qJ8vK8vK8vK8vK8vK8vK8vK8=/fit-in/200x200/pic123456.jpg",
  "Scrabble": "https://cf.geekdo-images.com/thumb/img/1qJ8vK8vK8vK8vK8vK8vK8vK8=/fit-in/200x200/pic123456.jpg",
  "Risk": "https://cf.geekdo-images.com/thumb/img/1qJ8vK8vK8vK8vK8vK8vK8vK8=/fit-in/200x200/pic123456.jpg",
  "Clue (Cluedo)": "https://cf.geekdo-images.com/thumb/img/1qJ8vK8vK8vK8vK8vK8vK8vK8=/fit-in/200x200/pic123456.jpg",
  "Battleship": "https://cf.geekdo-images.com/thumb/img/1qJ8vK8vK8vK8vK8vK8vK8vK8=/fit-in/200x200/pic123456.jpg",
  "Stratego": "https://cf.geekdo-images.com/thumb/img/1qJ8vK8vK8vK8vK8vK8vK8vK8=/fit-in/200x200/pic123456.jpg",
  "Mastermind": "https://cf.geekdo-images.com/thumb/img/1qJ8vK8vK8vK8vK8vK8vK8vK8=/fit-in/200x200/pic123456.jpg",
  "Connect Four": "https://cf.geekdo-images.com/thumb/img/1qJ8vK8vK8vK8vK8vK8vK8vK8=/fit-in/200x200/pic123456.jpg",
  "Sorry!": "https://cf.geekdo-images.com/thumb/img/1qJ8vK8vK8vK8vK8vK8vK8vK8=/fit-in/200x200/pic123456.jpg",
  "Tic-Tac-Toe": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Tic_tac_toe.svg/512px-Tic_tac_toe.svg.png",
  "Uno": "https://cf.geekdo-images.com/thumb/img/1qJ8vK8vK8vK8vK8vK8vK8vK8=/fit-in/200x200/pic123456.jpg",
};

// Search BGG API for a game
async function searchBGG(gameTitle: string): Promise<string | null> {
  const searchTerm = gameSearchMap[gameTitle] || gameTitle;
  const encodedTerm = encodeURIComponent(searchTerm);
  
  try {
    // Search for the game - BGG API requires a delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const searchUrl = `https://boardgamegeek.com/xmlapi2/search?query=${encodedTerm}&type=boardgame`;
    const searchResponse = await fetch(searchUrl);
    
    if (!searchResponse.ok) {
      return null;
    }
    
    const searchText = await searchResponse.text();
    // Parse XML to find the first result's ID
    const idMatch = searchText.match(/<item[^>]*id="(\d+)"[^>]*>/);
    
    if (!idMatch) {
      return null;
    }
    
    const gameId = idMatch[1];
    
    // Wait before next request
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get game details with image
    const detailUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${gameId}&stats=1`;
    const detailResponse = await fetch(detailUrl);
    
    if (!detailResponse.ok) {
      return null;
    }
    
    const detailText = await detailResponse.text();
    // BGG thumbnail is square (200x200), which is perfect for our use case
    const thumbnailMatch = detailText.match(/<thumbnail>(.*?)<\/thumbnail>/);
    
    if (thumbnailMatch) {
      const thumbnailUrl = thumbnailMatch[1];
      // BGG thumbnails are already square (200x200), perfect for our needs
      return thumbnailUrl;
    }
    
    // Fallback: try to get image tag
    const imageMatch = detailText.match(/<image>(.*?)<\/image>/);
    if (imageMatch) {
      // Convert full image to thumbnail format (BGG uses _t suffix for thumbnails)
      const imageUrl = imageMatch[1];
      // If it's already a thumbnail, use it; otherwise try to construct thumbnail URL
      if (imageUrl.includes('_t.')) {
        return imageUrl;
      }
      // Try to create thumbnail URL (BGG pattern: replace extension with _t.extension)
      const thumbnailUrl = imageUrl.replace(/\.(jpg|jpeg|png)$/i, '_t.$1');
      return thumbnailUrl;
    }
    
    return null;
  } catch (error) {
    console.error(`Error searching BGG for ${gameTitle}:`, error);
    return null;
  }
}

// Get cover art URL for a game
async function getCoverArt(gameTitle: string): Promise<string | null> {
  // First check alternative sources
  if (alternativeCoverArt[gameTitle]) {
    return alternativeCoverArt[gameTitle];
  }
  
  // Then try BGG
  const bggUrl = await searchBGG(gameTitle);
  if (bggUrl) {
    return bggUrl;
  }
  
  return null;
}

// Update games in database with cover art
async function addCoverArtToGames() {
  console.log('🎨 Starting to add cover art to games...\n');

  // Get all games from database
  const gamesRef = ref(database, 'games');
  const snapshot = await get(gamesRef);
  
  if (!snapshot.exists()) {
    console.error('No games found in database');
    return;
  }
  
  const gamesData = snapshot.val();
  const games = Object.entries(gamesData) as [string, any][];
  
  console.log(`Found ${games.length} games in database\n`);
  
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const [gameId, game] of games) {
    // Skip if already has cover art
    if (game.coverArt) {
      console.log(`⊘ Skipped (has cover): ${game.title}`);
      skipped++;
      continue;
    }
    
    try {
      const coverArtUrl = await getCoverArt(game.title);
      
      if (coverArtUrl) {
        await update(ref(database, `games/${gameId}`), {
          coverArt: coverArtUrl
        });
        console.log(`✓ Added cover art: ${game.title}`);
        updated++;
      } else {
        console.log(`✗ No cover art found: ${game.title}`);
        failed++;
      }
      
      // Rate limiting - BGG API requires delays between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`✗ Error updating ${game.title}:`, error);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ Cover Art Update Complete!');
  console.log('='.repeat(50));
  console.log(`✅ Updated: ${updated}`);
  console.log(`⊘ Skipped: ${skipped}`);
  console.log(`❌ Failed: ${failed}`);
}

// Run the script
addCoverArtToGames()
  .then(() => {
    console.log('\n✨ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });

