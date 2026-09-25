# Top 300 Classic Board Games and Card Games - Verification Document

This document maps the top 300 classic board games and card games to the Skunk game creation criteria.

## Criteria Mapping Guide

- **Track Score**: `true` = game uses points/scores, `false` = binary win/loss
- **Team-Based**: `true` = cooperative or team-based game, `false` = competitive individual
- **Track Rounds**: `true` = game has multiple rounds/phases, `false` = single round
- **Match Winning**: `highest` = highest score wins, `lowest` = lowest score wins
- **Round Winning**: `highest` = highest round score wins, `lowest` = lowest round score wins
- **Score Calculation**: `all` = all players' scores count, `winnerOnly` = only winner's score counts, `losersSum` = winner gets sum of losers' scores

_Note: Due to the large size of this document (300 games), the full list is maintained in the generator script. This document provides the structure and key examples. See `web/scripts/generate-top-100-games.ts` for the complete list._

## Game Categories

1. **Classic Abstract Strategy Games** (1-30): Chess, Checkers, Go, Backgammon, Othello, and variants
2. **Classic Card Games** (31-80): Poker, Bridge, Hearts, Rummy, and traditional card games
3. **Classic Board Games** (81-130): Monopoly, Scrabble, Risk, and family board games
4. **Classic Tile Games** (131-145): Dominoes, Mahjong, Rummikub, and tile-based games
5. **Classic Dice Games** (146-165): Yahtzee, Farkle, and dice-based games
6. **Classic Word Games** (166-180): Boggle, Scrabble, and word-based games
7. **Classic Party Games** (181-200): Charades, Pictionary, and social games
8. **Classic Modern Board Games** (201-250): Catan, Ticket to Ride, and modern classics
9. **Classic Two-Player Games** (251-280): Hive, Onitama, and dedicated two-player games
10. **Classic Tabletop Games** (281-290): Carrom, Crokinole, and physical skill games
11. **Classic Card Game Variants** (291-300): Uno, Phase 10, and modern card games

## Sample Games (First 50)

| #   | Game Name               | Min Players | Max Players | Track Score | Team-Based | Track Rounds | Match Winning | Round Winning | Score Calculation | Notes                      |
| --- | ----------------------- | ----------- | ----------- | ----------- | ---------- | ------------ | ------------- | ------------- | ----------------- | -------------------------- |
| 1   | Chess                   | 2           | 2           | false       | false      | false        | highest       | highest       | all               | Classic strategy game      |
| 2   | Checkers (Draughts)     | 2           | 2           | false       | false      | false        | highest       | highest       | all               | Classic strategy game      |
| 3   | Go                      | 2           | 2           | true        | false      | false        | highest       | highest       | all               | Territory control game     |
| 4   | Backgammon              | 2           | 2           | false       | false      | true         | highest       | highest       | all               | Race game with dice        |
| 5   | Othello (Reversi)       | 2           | 2           | true        | false      | false        | highest       | highest       | all               | Flipping pieces game       |
| 6   | Xiangqi (Chinese Chess) | 2           | 2           | false       | false      | false        | highest       | highest       | all               | Chinese chess variant      |
| 7   | Shogi (Japanese Chess)  | 2           | 2           | false       | false      | false        | highest       | highest       | all               | Japanese chess variant     |
| 8   | Nine Men's Morris       | 2           | 2           | false       | false      | false        | highest       | highest       | all               | Ancient strategy game      |
| 9   | Mancala                 | 2           | 2           | true        | false      | false        | highest       | highest       | all               | Sowing game                |
| 10  | Chinese Checkers        | 2           | 6           | false       | false      | false        | highest       | highest       | all               | Race to opposite side      |
| 11  | Poker                   | 2           | 10          | false       | false      | true         | highest       | highest       | all               | Traditional card game      |
| 12  | Bridge                  | 4           | 4           | true        | false      | true         | highest       | highest       | all               | Partnership trick-taking   |
| 13  | Hearts                  | 3           | 7           | true        | false      | true         | lowest        | lowest        | all               | Trick-taking, avoid points |
| 14  | Spades                  | 2           | 4           | true        | false      | true         | highest       | highest       | all               | Trick-taking with bidding  |
| 15  | Euchre                  | 4           | 4           | true        | false      | true         | highest       | highest       | all               | Trick-taking game          |
| 16  | Rummy                   | 2           | 6           | true        | false      | false        | highest       | highest       | all               | Set collection             |
| 17  | Gin Rummy               | 2           | 2           | true        | false      | false        | highest       | highest       | all               | Two-player rummy           |
| 18  | Canasta                 | 2           | 6           | true        | false      | false        | highest       | highest       | all               | Set collection game        |
| 19  | Cribbage                | 2           | 4           | true        | false      | false        | highest       | highest       | all               | Card game with board       |
| 20  | Pinochle                | 2           | 4           | true        | false      | true         | highest       | highest       | all               | Trick-taking with melds    |
| 21  | Monopoly                | 2           | 8           | true        | false      | false        | highest       | highest       | all               | Real estate trading        |
| 22  | Scrabble                | 2           | 4           | true        | false      | false        | highest       | highest       | all               | Word building game         |
| 23  | Risk                    | 2           | 6           | false       | false      | false        | highest       | highest       | all               | World conquest game        |
| 24  | Clue (Cluedo)           | 2           | 6           | false       | false      | false        | highest       | highest       | all               | Deduction mystery game     |
| 25  | Battleship              | 2           | 2           | false       | false      | false        | highest       | highest       | all               | Hidden ship placement      |
| 26  | Stratego                | 2           | 2           | false       | false      | false        | highest       | highest       | all               | Capture the flag           |
| 27  | Mastermind              | 2           | 2           | false       | false      | true         | highest       | highest       | all               | Code breaking game         |
| 28  | Connect Four            | 2           | 2           | false       | false      | false        | highest       | highest       | all               | Vertical tic-tac-toe       |
| 29  | Sorry!                  | 2           | 4           | false       | false      | false        | highest       | highest       | all               | Race around board          |
| 30  | Parcheesi               | 2           | 4           | false       | false      | false        | highest       | highest       | all               | Race to home space         |
| 31  | Dominoes                | 2           | 4           | true        | false      | true         | highest       | highest       | all               | Tile matching game         |
| 32  | Mahjong                 | 4           | 4           | true        | false      | true         | highest       | highest       | all               | Chinese tile game          |
| 33  | Rummikub                | 2           | 4           | true        | false      | false        | highest       | highest       | all               | Tile rummy game            |
| 34  | Yahtzee                 | 2           | 10          | true        | false      | false        | highest       | highest       | all               | Dice combination game      |
| 35  | Farkle                  | 2           | 8           | true        | false      | false        | highest       | highest       | all               | Push-your-luck dice        |
| 36  | Boggle                  | 2           | 8           | true        | false      | false        | highest       | highest       | all               | Word finding game          |
| 37  | Bananagrams             | 1           | 8           | false       | false      | false        | highest       | highest       | all               | Speed word building        |
| 38  | Charades                | 4           | 20          | true        | false      | false        | highest       | highest       | all               | Acting game                |
| 39  | Pictionary              | 4           | 16          | true        | false      | false        | highest       | highest       | all               | Drawing game               |
| 40  | Catan                   | 3           | 4           | true        | false      | false        | highest       | highest       | all               | Resource trading           |
| 41  | Ticket to Ride          | 2           | 5           | true        | false      | false        | highest       | highest       | all               | Route building             |
| 42  | Carcassonne             | 2           | 5           | true        | false      | false        | highest       | highest       | all               | Tile placement             |
| 43  | Dominion                | 2           | 4           | true        | false      | false        | highest       | highest       | all               | Deck-building              |
| 44  | 7 Wonders               | 2           | 7           | true        | false      | false        | highest       | highest       | all               | Card drafting              |
| 45  | Splendor                | 2           | 4           | true        | false      | false        | highest       | highest       | all               | Engine-building            |
| 46  | Azul                    | 2           | 4           | true        | false      | false        | highest       | highest       | all               | Pattern building           |
| 47  | Wingspan                | 1           | 5           | true        | false      | false        | highest       | highest       | all               | Engine-building birds      |
| 48  | Hive                    | 2           | 2           | false       | false      | false        | highest       | highest       | all               | Bug strategy game          |
| 49  | Uno                     | 2           | 10          | false       | false      | false        | highest       | highest       | all               | Color and number matching  |
| 50  | Set                     | 1           | 20          | false       | false      | false        | highest       | highest       | all               | Pattern recognition        |

_... and 250 more classic games. See the generator script for the complete list._

## Special Cases and Notes

### Games with Lowest Score Wins

- **Hearts**: Players try to avoid taking hearts and the queen of spades (lowest score wins)
- **Mexican Train**: Lowest score wins (dominoes variant)
- **No Thanks!**: Lowest score wins (push-your-luck card game)

### Competitive Games Only

- All games in this list are competitive (no cooperative or team-based games)
- Players compete individually to achieve the highest (or lowest) score

### Games with Rounds

- Most trick-taking games have rounds (Bridge, Spades, Euchre, Hearts, Whist, Pinochle, Skat)
- Some board games track rounds (Backgammon, Dominoes, Mahjong, Mexican Train)
- Poker has multiple rounds (hands)
- Mastermind has multiple rounds (code attempts)

### Binary Score Games (Win/Loss)

- Abstract strategy games (Chess, Checkers, Go, Othello, etc.)
- Hidden information games (Battleship, Stratego, Clue)
- Elimination games (Uno, Crazy Eights)
- Race games (Sorry!, Parcheesi, Ludo)

### Score Tracking Games

- Most card games track points (Rummy, Cribbage, Canasta, etc.)
- Most board games track points (Monopoly, Scrabble, Catan, etc.)
- Dice games track points (Yahtzee, Farkle, Ten Thousand)
- Word games track points (Boggle, Bananagrams, Upwords)
