import { useState, FormEvent } from 'react';
import type { Game } from '../models/Game';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import './AddGameForm.css';

interface AddGameFormProps {
  onClose: () => void;
  onSubmit: (game: Omit<Game, 'id'>) => Promise<void>;
}

type ScoreCalculation = 'all' | 'winnerOnly' | 'losersSum';

export function AddGameForm({ onClose, onSubmit }: AddGameFormProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [minPlayers, setMinPlayers] = useState(2);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [trackScore, setTrackScore] = useState(true);
  const [matchWinningCondition, setMatchWinningCondition] = useState<'highest' | 'lowest'>('highest');
  const [roundWinningCondition, setRoundWinningCondition] = useState<'highest' | 'lowest'>('highest');
  const [scoreCalculation, setScoreCalculation] = useState<ScoreCalculation>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;

    setIsSubmitting(true);
    try {
      // Generate supported player counts from min to max
      const supportedPlayerCounts: number[] = [];
      for (let i = minPlayers; i <= maxPlayers; i++) {
        supportedPlayerCounts.push(i);
      }

      // Determine score calculation settings
      // Based on Swift Game model logic:
      // - countAllScores: true means all players' scores are summed normally
      // - countLosersOnly: true means winner gets sum of all losers' scores
      // - Both false: might mean only winner's score counts (special case)
      let countAllScores = false;
      let countLosersOnly = false;
      
      if (scoreCalculation === 'all') {
        countAllScores = true;
        countLosersOnly = false;
      } else if (scoreCalculation === 'winnerOnly') {
        // Only winner's score counts - both flags false
        countAllScores = false;
        countLosersOnly = false;
      } else if (scoreCalculation === 'losersSum') {
        // Winner gets sum of losers' scores
        countAllScores = false;
        countLosersOnly = true;
      }

      // Build winning conditions string
      const gameCondition = `game:${matchWinningCondition}`;
      const roundCondition = `round:${roundWinningCondition}`;
      const winningConditions = `${gameCondition}|${roundCondition}`;

      const newGame: Omit<Game, 'id'> = {
        title: title.trim(),
        isBinaryScore: !trackScore, // If not tracking score, it's binary (win/loss)
        supportedPlayerCounts,
        createdByID: user.uid,
        countAllScores,
        countLosersOnly,
        highestScoreWins: matchWinningCondition === 'highest',
        highestRoundScoreWins: roundWinningCondition === 'highest',
        winningConditions,
        creationDate: Date.now()
      };

      await onSubmit(newGame);
      onClose();
    } catch (err) {
      console.error('Error creating game:', err);
      alert('Failed to create game');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="add-game-form-overlay" onClick={onClose}>
      <div className="add-game-form-content" onClick={(e) => e.stopPropagation()}>
        <h2>Add New Game</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <label>
              Game Title *
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter game title"
                autoFocus
                required
              />
            </label>
          </div>

          <div className="form-section">
            <div className="player-count-inputs">
              <label>
                Minimum Players
                <input
                  type="number"
                  min="2"
                  max="10"
                  value={minPlayers}
                  onChange={(e) => setMinPlayers(parseInt(e.target.value) || 2)}
                />
              </label>
              <label>
                Maximum Players
                <input
                  type="number"
                  min={minPlayers}
                  max="10"
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(parseInt(e.target.value) || 4)}
                />
              </label>
            </div>
          </div>

          <div className="form-section">
            <h3>Game Rules</h3>
            
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={trackScore}
                onChange={(e) => setTrackScore(e.target.checked)}
              />
              <span>Track Score</span>
            </label>

            {trackScore && (
              <>
                <label>
                  Match Winning Condition
                  <select
                    value={matchWinningCondition}
                    onChange={(e) => setMatchWinningCondition(e.target.value as 'highest' | 'lowest')}
                  >
                    <option value="highest">Highest Total Score Wins</option>
                    <option value="lowest">Lowest Total Score Wins</option>
                  </select>
                </label>

                <label>
                  Round Winning Condition
                  <select
                    value={roundWinningCondition}
                    onChange={(e) => setRoundWinningCondition(e.target.value as 'highest' | 'lowest')}
                  >
                    <option value="highest">Highest Score Wins</option>
                    <option value="lowest">Lowest Score Wins</option>
                  </select>
                </label>

                <label>
                  Total Score Calculation
                  <select
                    value={scoreCalculation}
                    onChange={(e) => setScoreCalculation(e.target.value as ScoreCalculation)}
                  >
                    <option value="all">All Players' Scores Count</option>
                    <option value="winnerOnly">Only Winner's Score Counts</option>
                    <option value="losersSum">Winner Gets Sum of Losers' Scores</option>
                  </select>
                </label>
              </>
            )}
          </div>

          <div className="form-actions">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? 'Creating...' : 'Create Game'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

