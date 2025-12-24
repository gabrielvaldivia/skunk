import type { Game } from "../models/Game";

/**
 * Helper function to generate supported player counts array
 */
function generatePlayerCounts(min: number, max: number): number[] {
  const counts: number[] = [];
  for (let i = min; i <= max; i++) {
    counts.push(i);
  }
  return counts;
}

/**
 * Helper function to build winning conditions string
 */
function buildWinningConditions(
  matchWinning: "highest" | "lowest",
  roundWinning: "highest" | "lowest" = "highest"
): string {
  const gameCondition = `game:${matchWinning === "highest" ? "high" : "low"}`;
  const roundCondition = `round:${roundWinning === "highest" ? "high" : "low"}`;
  return `${gameCondition}|${roundCondition}`;
}

/**
 * Helper function to create a game object from criteria
 */
function createGame(
  title: string,
  minPlayers: number,
  maxPlayers: number,
  trackScore: boolean,
  isTeamBased: boolean = false,
  trackRounds: boolean = false,
  matchWinning: "highest" | "lowest" = "highest",
  roundWinning: "highest" | "lowest" = "highest",
  scoreCalculation: "all" | "winnerOnly" | "losersSum" = "all"
): Omit<Game, "id" | "createdByID" | "creationDate"> {
  const supportedPlayerCounts = generatePlayerCounts(minPlayers, maxPlayers);
  
  let countAllScores = false;
  let countLosersOnly = false;

  if (scoreCalculation === "all") {
    countAllScores = true;
    countLosersOnly = false;
  } else if (scoreCalculation === "winnerOnly") {
    countAllScores = false;
    countLosersOnly = false;
  } else if (scoreCalculation === "losersSum") {
    countAllScores = false;
    countLosersOnly = true;
  }

  const roundConditionValue = trackRounds ? roundWinning : "highest";
  const winningConditions = buildWinningConditions(matchWinning, roundConditionValue);

  return {
    title,
    isBinaryScore: !trackScore,
    isTeamBased,
    supportedPlayerCounts,
    countAllScores,
    countLosersOnly,
    highestScoreWins: matchWinning === "highest",
    highestRoundScoreWins: roundConditionValue === "highest",
    winningConditions,
  };
}

/**
 * Top 300 Classic Board Games and Card Games
 * Focus on timeless, traditional games that have stood the test of time
 */
export const top100Games: Omit<Game, "id" | "createdByID" | "creationDate">[] = [
  // Classic Abstract Strategy Games (1-10)
  createGame("Chess", 2, 2, false, false, false),
  createGame("Checkers (Draughts)", 2, 2, false, false, false),
  createGame("Go", 2, 2, true, false, false),
  createGame("Backgammon", 2, 2, false, false, true),
  createGame("Othello (Reversi)", 2, 2, true, false, false),
  createGame("Xiangqi (Chinese Chess)", 2, 2, false, false, false),
  createGame("Shogi (Japanese Chess)", 2, 2, false, false, false),
  createGame("Nine Men's Morris", 2, 2, false, false, false),
  createGame("Mancala", 2, 2, true, false, false),
  createGame("Chinese Checkers", 2, 6, false, false, false),

  // Classic Card Games (11-30)
  createGame("Poker", 2, 10, false, false, true),
  createGame("Bridge", 4, 4, true, false, true),
  createGame("Hearts", 3, 7, true, false, true, "lowest", "lowest"),
  createGame("Spades", 2, 4, true, false, true),
  createGame("Euchre", 4, 4, true, false, true),
  createGame("Rummy", 2, 6, true, false, false),
  createGame("Gin Rummy", 2, 2, true, false, false),
  createGame("Canasta", 2, 6, true, false, false),
  createGame("Cribbage", 2, 4, true, false, false),
  createGame("Pinochle", 2, 4, true, false, true),
  createGame("Whist", 4, 4, true, false, true),
  createGame("Piquet", 2, 2, true, false, false),
  createGame("Skat", 3, 3, true, false, true),
  createGame("Crazy Eights", 2, 7, false, false, false),
  createGame("Go Fish", 2, 6, false, false, false),
  createGame("Old Maid", 2, 8, false, false, false),
  createGame("War", 2, 2, false, false, true),
  createGame("Slapjack", 2, 8, false, false, false),
  createGame("Spit", 2, 2, false, false, false),
  createGame("Egyptian Ratscrew", 2, 10, false, false, false),

  // Classic Board Games (31-50)
  createGame("Monopoly", 2, 8, true, false, false),
  createGame("Scrabble", 2, 4, true, false, false),
  createGame("Risk", 2, 6, false, false, false),
  createGame("Clue (Cluedo)", 2, 6, false, false, false),
  createGame("Battleship", 2, 2, false, false, false),
  createGame("Stratego", 2, 2, false, false, false),
  createGame("Mastermind", 2, 2, false, false, true),
  createGame("Connect Four", 2, 2, false, false, false),
  createGame("Sorry!", 2, 4, false, false, false),
  createGame("Parcheesi", 2, 4, false, false, false),
  createGame("Ludo", 2, 4, false, false, false),
  createGame("Pachisi", 2, 4, false, false, false),
  createGame("Snakes and Ladders", 2, 6, false, false, false),
  createGame("Chutes and Ladders", 2, 4, false, false, false),
  createGame("Candy Land", 2, 4, false, false, false),
  createGame("The Game of Life", 2, 6, true, false, false),
  createGame("Payday", 2, 4, true, false, false),
  createGame("Careers", 2, 6, true, false, false),
  createGame("Acquire", 2, 6, true, false, false),
  createGame("Diplomacy", 2, 7, false, false, false),

  // Classic Tile Games (51-55)
  createGame("Dominoes", 2, 4, true, false, true),
  createGame("Mahjong", 4, 4, true, false, true),
  createGame("Rummikub", 2, 4, true, false, false),
  createGame("Qwirkle", 2, 4, true, false, false),
  createGame("Mexican Train", 2, 8, true, false, true, "lowest", "lowest"),

  // Classic Dice Games (56-60)
  createGame("Yahtzee", 2, 10, true, false, false),
  createGame("Farkle", 2, 8, true, false, false),
  createGame("Liar's Dice", 2, 6, false, false, true),
  createGame("Ten Thousand", 2, 8, true, false, false),
  createGame("Bunco", 4, 12, true, false, true),

  // Classic Word Games (61-65)
  createGame("Boggle", 2, 8, true, false, false),
  createGame("Bananagrams", 1, 8, false, false, false),
  createGame("Upwords", 2, 4, true, false, false),
  createGame("Balderdash", 2, 8, true, false, false),
  createGame("Scattergories", 2, 6, true, false, false),

  // Classic Party Games (66-70)
  createGame("Charades", 4, 20, true, false, false),
  createGame("Pictionary", 4, 16, true, false, false),
  createGame("Taboo", 4, 10, true, false, false),
  createGame("Trivial Pursuit", 2, 6, true, false, false),
  createGame("Cranium", 4, 16, true, false, false),

  // Classic Modern Board Games (71-80)
  createGame("Catan", 3, 4, true, false, false),
  createGame("Ticket to Ride", 2, 5, true, false, false),
  createGame("Carcassonne", 2, 5, true, false, false),
  createGame("Dominion", 2, 4, true, false, false),
  createGame("7 Wonders", 2, 7, true, false, false),
  createGame("Splendor", 2, 4, true, false, false),
  createGame("Azul", 2, 4, true, false, false),
  createGame("Wingspan", 1, 5, true, false, false),
  createGame("Sushi Go!", 2, 5, true, false, false),
  createGame("Love Letter", 2, 4, false, false, false),

  // Classic Two-Player Games (81-90)
  createGame("Hive", 2, 2, false, false, false),
  createGame("Onitama", 2, 2, false, false, false),
  createGame("Santorini", 2, 2, false, false, false),
  createGame("Patchwork", 2, 2, true, false, false),
  createGame("Jaipur", 2, 2, true, false, false),
  createGame("Lost Cities", 2, 2, true, false, false),
  createGame("Battle Line", 2, 2, true, false, false),
  createGame("7 Wonders Duel", 2, 2, true, false, false),
  createGame("Tic-Tac-Toe", 2, 2, false, false, false),
  createGame("Dots and Boxes", 2, 2, true, false, false),

  // Classic Tabletop Games (91-95)
  createGame("Carrom", 2, 4, true, false, false),
  createGame("Crokinole", 2, 4, true, false, false),
  createGame("Pente", 2, 2, false, false, false),
  createGame("Tiddlywinks", 2, 4, true, false, false),
  createGame("Jenga", 1, 8, false, false, false),

  // Classic Card Game Variants (96-100)
  createGame("Uno", 2, 10, false, false, false),
  createGame("Phase 10", 2, 6, false, false, true),
  createGame("Skip-Bo", 2, 6, false, false, false),
  createGame("Set", 1, 20, false, false, false),
  createGame("Spot It!", 2, 8, false, false, false),

  // Additional Classic Abstract Strategy Games (101-130)
  createGame("Hex", 2, 2, false, false, false),
  createGame("Gomoku", 2, 2, false, false, false),
  createGame("Connect 6", 2, 2, false, false, false),
  createGame("Pentago", 2, 2, false, false, false),
  createGame("Quarto", 2, 2, false, false, false),
  createGame("Quoridor", 2, 4, false, false, false),
  createGame("Blokus", 2, 4, true, false, false),
  createGame("Blokus Trigon", 2, 4, true, false, false),
  createGame("Gipf", 2, 2, false, false, false),
  createGame("Dvonn", 2, 2, false, false, false),
  createGame("Zertz", 2, 2, false, false, false),
  createGame("Yinsh", 2, 2, true, false, false),
  createGame("Punct", 2, 2, false, false, false),
  createGame("Tzaar", 2, 2, false, false, false),
  createGame("Tak", 2, 2, false, false, false),
  createGame("Kamisado", 2, 2, false, false, false),
  createGame("Abalone", 2, 2, false, false, false),
  createGame("Focus", 2, 2, false, false, false),
  createGame("Breakthrough", 2, 2, false, false, false),
  createGame("Amazons", 2, 2, false, false, false),
  createGame("Lines of Action", 2, 2, false, false, false),
  createGame("Havannah", 2, 2, false, false, false),
  createGame("Twixt", 2, 2, false, false, false),
  createGame("Khet", 2, 2, false, false, false),
  createGame("Khet 2.0", 2, 2, false, false, false),
  createGame("Gobblet", 2, 2, false, false, false),
  createGame("Gobblet Junior", 2, 2, false, false, false),
  createGame("Quoridor Kid", 2, 4, false, false, false),
  createGame("Katamino", 1, 2, false, false, false),

  // Additional Classic Card Games (131-180)
  createGame("Blackjack", 2, 7, false, false, true),
  createGame("Solitaire", 1, 1, false, false, false),
  createGame("Klondike Solitaire", 1, 1, false, false, false),
  createGame("Spider Solitaire", 1, 1, false, false, false),
  createGame("FreeCell", 1, 1, false, false, false),
  createGame("Hearts (Solo)", 1, 1, true, false, true, "lowest", "lowest"),
  createGame("Oh Hell", 3, 7, true, false, true),
  createGame("500", 2, 6, true, false, true),
  createGame("Sheepshead", 3, 5, true, false, true),
  createGame("Pinochle (Auction)", 3, 4, true, false, true),
  createGame("Tichu", 4, 4, true, false, false),
  createGame("Chimera", 3, 5, true, false, true),
  createGame("Bid Whist", 4, 4, true, false, true),
  createGame("Spades (Cutthroat)", 3, 3, true, false, true),
  createGame("Hearts (Cutthroat)", 3, 3, true, false, true, "lowest", "lowest"),
  createGame("Rummy 500", 2, 8, true, false, false),
  createGame("Contract Rummy", 2, 6, true, false, false),
  createGame("Oklahoma Gin", 2, 2, true, false, false),
  createGame("Kalooki", 2, 4, true, false, false),
  createGame("Conquian", 2, 2, true, false, false),
  createGame("Shanghai Rummy", 3, 8, true, false, false),
  createGame("Phase 10 Rummy", 2, 6, true, false, true),
  createGame("Liverpool Rummy", 2, 6, true, false, false),
  createGame("Gin Rummy (Oklahoma)", 2, 2, true, false, false),
  createGame("Tonk", 2, 4, true, false, false),
  createGame("Kings in the Corner", 2, 4, false, false, false),
  createGame("Golf", 2, 6, true, false, false, "lowest", "lowest"),
  createGame("Palace", 2, 4, false, false, false),
  createGame("Scat", 2, 4, true, false, false),
  createGame("Spite and Malice", 2, 2, false, false, false),
  createGame("Speed", 2, 2, false, false, false),
  createGame("Nertz", 2, 4, false, false, false),
  createGame("Dutch Blitz", 2, 4, false, false, false),
  createGame("Pounce", 2, 4, false, false, false),
  createGame("Spoons", 3, 13, false, false, false),
  createGame("Pig", 2, 10, false, false, false),
  createGame("Donkey", 3, 13, false, false, false),
  createGame("Snap", 2, 8, false, false, false),
  createGame("Snip Snap Snorem", 2, 8, false, false, false),
  createGame("Beggar My Neighbor", 2, 4, false, false, false),
  createGame("Cheat", 2, 10, false, false, false),
  createGame("Bullshit", 2, 10, false, false, false),
  createGame("I Doubt It", 2, 10, false, false, false),
  createGame("President", 3, 7, false, false, false),
  createGame("Asshole", 3, 7, false, false, false),
  createGame("Scum", 3, 7, false, false, false),
  createGame("Big Two", 2, 4, false, false, false),
  createGame("Tien Len", 2, 4, false, false, false),
  createGame("Zheng Shangyou", 3, 5, true, false, true),

  // Additional Classic Board Games (181-230)
  createGame("Axis & Allies", 2, 5, false, false, false),
  createGame("Twilight Struggle", 2, 2, true, false, false),
  createGame("Puerto Rico", 2, 5, true, false, false),
  createGame("Agricola", 1, 5, true, false, false),
  createGame("Le Havre", 1, 5, true, false, false),
  createGame("Caylus", 2, 5, true, false, false),
  createGame("El Grande", 2, 5, true, false, false),
  createGame("Tigris & Euphrates", 2, 4, true, false, false),
  createGame("Ra", 2, 5, true, false, false),
  createGame("Modern Art", 3, 5, true, false, false),
  createGame("Medici", 2, 6, true, false, false),
  createGame("Princes of Florence", 2, 5, true, false, false),
  createGame("Power Grid", 2, 6, true, false, false),
  createGame("The Castles of Burgundy", 2, 4, true, false, false),
  createGame("Terra Mystica", 2, 5, true, false, false),
  createGame("Gaia Project", 1, 4, true, false, false),
  createGame("Scythe", 1, 5, true, false, false),
  createGame("Great Western Trail", 2, 4, true, false, false),
  createGame("Concordia", 2, 5, true, false, false),
  createGame("Orléans", 2, 4, true, false, false),
  createGame("Keyflower", 2, 6, true, false, false),
  createGame("Viticulture", 1, 6, true, false, false),
  createGame("Everdell", 1, 4, true, false, false),
  createGame("Wingspan", 1, 5, true, false, false),
  createGame("Terraforming Mars", 1, 5, true, false, false),
  createGame("Ark Nova", 1, 4, true, false, false),
  createGame("Brass: Birmingham", 2, 4, true, false, false),
  createGame("Brass: Lancashire", 2, 4, true, false, false),
  createGame("Through the Ages", 2, 4, true, false, false),
  createGame("Twilight Imperium", 3, 6, true, false, true),
  createGame("Eclipse", 2, 6, true, false, false),
  createGame("Sid Meier's Civilization", 2, 4, true, false, false),
  createGame("Clash of Cultures", 2, 4, true, false, false),
  createGame("Nations", 1, 5, true, false, false),
  createGame("7 Wonders: Duel", 2, 2, true, false, false),
  createGame("Race for the Galaxy", 2, 4, true, false, false),
  createGame("Roll for the Galaxy", 2, 5, true, false, false),
  createGame("San Juan", 2, 4, true, false, false),
  createGame("Glory to Rome", 2, 5, true, false, false),
  createGame("Innovation", 2, 4, true, false, false),
  createGame("Mottainai", 2, 2, true, false, false),
  createGame("Red7", 2, 4, true, false, false),
  createGame("Biblios", 2, 4, true, false, false),
  createGame("For Sale", 3, 6, true, false, false),
  createGame("No Thanks!", 3, 7, true, false, false, "lowest", "lowest"),
  createGame("Coloretto", 2, 5, true, false, false),
  createGame("Bohnanza", 2, 7, true, false, false),
  createGame("The Great Dalmuti", 4, 8, false, false, false),
  createGame("Wizard", 3, 6, true, false, true),
  createGame("Skull King", 2, 8, true, false, true),
  createGame("Tichu", 4, 4, true, false, false),

  // Additional Tile Games (231-245)
  createGame("Tsuro", 2, 8, false, false, false),
  createGame("Tsuro of the Seas", 2, 8, false, false, false),
  createGame("Indigo", 2, 4, true, false, false),
  createGame("Kingdomino", 2, 4, true, false, false),
  createGame("Queendomino", 2, 4, true, false, false),
  createGame("Dragomino", 2, 4, true, false, false),
  createGame("Isle of Skye", 2, 5, true, false, false),
  createGame("Alhambra", 2, 6, true, false, false),
  createGame("Carcassonne: Hunters and Gatherers", 2, 5, true, false, false),
  createGame("Carcassonne: Inns and Cathedrals", 2, 6, true, false, false),
  createGame("Carcassonne: Traders and Builders", 2, 5, true, false, false),
  createGame("Carcassonne: The Princess and the Dragon", 2, 6, true, false, false),
  createGame("Carcassonne: The Tower", 2, 6, true, false, false),
  createGame("Carcassonne: Abbey and Mayor", 2, 6, true, false, false),
  createGame("Carcassonne: The Catapult", 2, 6, true, false, false),

  // Additional Dice Games (246-265)
  createGame("King of Tokyo", 2, 6, true, false, false),
  createGame("King of New York", 2, 6, true, false, false),
  createGame("Bang! The Dice Game", 3, 8, false, false, false),
  createGame("Las Vegas", 2, 5, true, false, false),
  createGame("Las Vegas Boulevard", 2, 5, true, false, false),
  createGame("Roll Through the Ages", 1, 4, true, false, false),
  createGame("Dice Forge", 2, 4, true, false, false),
  createGame("Roll Player", 1, 4, true, false, false),
  createGame("Sagrada", 1, 4, true, false, false),
  createGame("Dice Throne", 2, 6, false, false, false),
  createGame("Dice Throne: Season One", 2, 6, false, false, false),
  createGame("Dice Throne: Season Two", 2, 6, false, false, false),
  createGame("Quarriors!", 2, 4, true, false, false),
  createGame("Dice Masters", 2, 2, false, false, false),
  createGame("Elder Sign", 1, 8, true, false, false),
  createGame("Escape: The Curse of the Temple", 1, 5, false, false, false),
  createGame("Can't Stop", 2, 4, true, false, false),
  createGame("Pickomino", 2, 5, true, false, false),
  createGame("Zombie Dice", 1, 99, true, false, false),
  createGame("Martian Dice", 1, 8, true, false, false),

  // Additional Word Games (266-280)
  createGame("Word on the Street", 2, 8, true, false, false),
  createGame("Letter Tycoon", 2, 5, true, false, false),
  createGame("Paperback", 2, 5, true, false, false),
  createGame("Hardback", 2, 5, true, false, false),
  createGame("Anomia", 3, 6, false, false, false),
  createGame("Anomia X", 3, 6, false, false, false),
  createGame("Codenames", 2, 8, false, false, false),
  createGame("Codenames: Duet", 2, 2, false, false, false),
  createGame("Codenames: Pictures", 2, 8, false, false, false),
  createGame("Decrypto", 3, 8, true, false, false),
  createGame("Word Slam", 4, 8, true, false, false),
  createGame("Just One", 3, 7, true, false, false),
  createGame("Wavelength", 2, 12, true, false, false),
  createGame("So Clover!", 3, 6, true, false, false),
  createGame("Crosswords", 1, 4, true, false, false),

  // Additional Party Games (281-300)
  createGame("Telestrations", 4, 8, false, false, false),
  createGame("Telestrations After Dark", 4, 8, false, false, false),
  createGame("A Fake Artist Goes to New York", 5, 10, true, false, false),
  createGame("Spyfall", 3, 8, false, false, false),
  createGame("Spyfall 2", 3, 12, false, false, false),
  createGame("The Resistance", 5, 10, false, false, false),
  createGame("The Resistance: Avalon", 5, 10, false, false, false),
  createGame("One Night Ultimate Werewolf", 3, 10, false, false, false),
  createGame("One Night Ultimate Vampire", 3, 10, false, false, false),
  createGame("One Night Ultimate Alien", 3, 10, false, false, false),
  createGame("Secret Hitler", 5, 10, false, false, false),
  createGame("Deception: Murder in Hong Kong", 4, 12, true, false, false),
  createGame("Mysterium", 2, 7, true, false, false),
  createGame("Mafia", 7, 20, false, false, false),
  createGame("Werewolf", 7, 20, false, false, false),
  createGame("Two Rooms and a Boom", 6, 30, false, false, false),
  createGame("Time's Up!", 4, 12, true, false, false),
  createGame("Time's Up! Title Recall", 4, 12, true, false, false),
  createGame("Time's Up! Party Edition", 4, 12, true, false, false),
  createGame("Monikers", 4, 20, true, false, false),
  createGame("Cards Against Humanity", 4, 20, false, false, false),
];

/**
 * Export helper function for creating games programmatically
 */
export { createGame, generatePlayerCounts, buildWinningConditions };
