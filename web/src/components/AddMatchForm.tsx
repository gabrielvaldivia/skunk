import { useState, FormEvent, useEffect } from "react";
import type { Match } from "../models/Match";
import type { Game } from "../models/Game";
import type { Player } from "../models/Player";
import { useAuth } from "../context/AuthContext";
import { useGames } from "../hooks/useGames";
import { usePlayers } from "../hooks/usePlayers";
import { Button } from "@/components/ui/button";
import { computeWinnerID } from "../models/Match";
import "./AddGameForm.css";

interface AddMatchFormProps {
  onClose: () => void;
  onSubmit: (match: Omit<Match, "id">) => Promise<void>;
}

export function AddMatchForm({ onClose, onSubmit }: AddMatchFormProps) {
  const { user } = useAuth();
  const { games, isLoading: gamesLoading } = useGames();
  const { players, isLoading: playersLoading } = usePlayers();
  const [selectedGameId, setSelectedGameId] = useState<string>("");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [scores, setScores] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedGame = games.find((g) => g.id === selectedGameId);

  // Reset scores when game or players change
  useEffect(() => {
    if (selectedGame && selectedPlayerIds.length > 0) {
      setScores(new Array(selectedPlayerIds.length).fill(0));
    }
  }, [selectedGameId, selectedPlayerIds.length]);

  const handlePlayerToggle = (playerId: string) => {
    setSelectedPlayerIds((prev) => {
      if (prev.includes(playerId)) {
        return prev.filter((id) => id !== playerId);
      } else {
        const newSelection = [...prev, playerId];
        // Check if selection is valid for the game
        if (
          selectedGame &&
          selectedGame.supportedPlayerCounts.includes(newSelection.length)
        ) {
          return newSelection;
        }
        return prev;
      }
    });
  };

  const handleScoreChange = (index: number, value: number) => {
    setScores((prev) => {
      const newScores = [...prev];
      newScores[index] = value;
      return newScores;
    });
  };

  const canSubmit = () => {
    if (!selectedGame || !user) return false;
    if (
      !selectedGame.supportedPlayerCounts.includes(selectedPlayerIds.length)
    ) {
      return false;
    }
    if (selectedGame.isBinaryScore) {
      // For binary scores, at least one player should have score 1
      return scores.some((s) => s === 1);
    } else {
      // For non-binary, all scores should be valid numbers
      return scores.every((s) => !isNaN(s) && s >= 0);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit() || !selectedGame || !user) return;

    setIsSubmitting(true);
    try {
      const now = Date.now();
      const match: Omit<Match, "id"> = {
        gameID: selectedGame.id,
        date: now,
        playerIDs: selectedPlayerIds,
        playerOrder: selectedPlayerIds,
        scores: scores,
        rounds: [scores], // Single round for now
        isMultiplayer: selectedPlayerIds.length > 2,
        status: "active",
        createdByID: user.uid,
        lastModified: now,
      };

      // Calculate winner
      if (selectedGame.isBinaryScore) {
        const winnerIndex = scores.findIndex((s) => s === 1);
        if (winnerIndex !== -1) {
          match.winnerID = selectedPlayerIds[winnerIndex];
        }
      } else {
        const winnerID = computeWinnerID(
          { ...match, id: "" },
          selectedGame
        );
        if (winnerID) {
          match.winnerID = winnerID;
        }
      }

      await onSubmit(match);
      onClose();
    } catch (err) {
      console.error("Error creating match:", err);
      alert("Failed to create match");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (gamesLoading || playersLoading) {
    return (
      <div className="add-game-form-overlay" onClick={onClose}>
        <div
          className="add-game-form-content"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="add-game-form-overlay" onClick={onClose}>
        <div
          className="add-game-form-content"
          onClick={(e) => e.stopPropagation()}
        >
          <h2>New Match</h2>
          <p>You need to create at least one game before creating a match.</p>
          <div className="form-actions">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="add-game-form-overlay" onClick={onClose}>
        <div
          className="add-game-form-content"
          onClick={(e) => e.stopPropagation()}
        >
          <h2>New Match</h2>
          <p>You need to create at least one player before creating a match.</p>
          <div className="form-actions">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="add-game-form-overlay" onClick={onClose}>
      <div
        className="add-game-form-content"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>New Match</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <label>
              Game *
              <select
                value={selectedGameId}
                onChange={(e) => {
                  setSelectedGameId(e.target.value);
                  setSelectedPlayerIds([]);
                  setScores([]);
                }}
                required
              >
                <option value="">Select a game</option>
                {games.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedGame && (
            <>
              <div className="form-section">
                <label>
                  Players * (Select {selectedGame.supportedPlayerCounts.join(", ")}{" "}
                  players)
                  <div className="player-selection">
                    {players.map((player) => {
                      const isSelected = selectedPlayerIds.includes(player.id);
                      const isDisabled =
                        !isSelected &&
                        !selectedGame.supportedPlayerCounts.includes(
                          selectedPlayerIds.length + 1
                        );
                      return (
                        <button
                          key={player.id}
                          type="button"
                          className={`player-option ${
                            isSelected ? "selected" : ""
                          } ${isDisabled ? "disabled" : ""}`}
                          onClick={() => handlePlayerToggle(player.id)}
                          disabled={isDisabled}
                        >
                          {player.name}
                        </button>
                      );
                    })}
                  </div>
                </label>
              </div>

              {selectedPlayerIds.length > 0 &&
                selectedGame.supportedPlayerCounts.includes(
                  selectedPlayerIds.length
                ) && (
                  <div className="form-section">
                    <h3>Scores</h3>
                    {selectedPlayerIds.map((playerId, index) => {
                      const player = players.find((p) => p.id === playerId);
                      return (
                        <label key={playerId}>
                          {player?.name || "Player"}
                          {selectedGame.isBinaryScore ? (
                            <select
                              value={scores[index] || 0}
                              onChange={(e) =>
                                handleScoreChange(
                                  index,
                                  parseInt(e.target.value)
                                )
                              }
                              required
                            >
                              <option value={0}>Loss (0)</option>
                              <option value={1}>Win (1)</option>
                            </select>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              value={scores[index] || 0}
                              onChange={(e) =>
                                handleScoreChange(
                                  index,
                                  parseInt(e.target.value) || 0
                                )
                              }
                              required
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
            </>
          )}

          <div className="form-actions">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !canSubmit()}>
              {isSubmitting ? "Creating..." : "Create Match"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

