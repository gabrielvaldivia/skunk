import { useState, FormEvent, useEffect } from "react";
import type { Match } from "../models/Match";
import type { Game } from "../models/Game";
import type { Player } from "../models/Player";
import { useAuth } from "../context/AuthContext";
import { useGames } from "../hooks/useGames";
import { usePlayers } from "../hooks/usePlayers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Trash2 } from "lucide-react";
import { computeWinnerID } from "../models/Match";
import { PlayerAutocomplete } from "./PlayerAutocomplete";
import "./AddGameForm.css";

interface AddMatchFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (match: Omit<Match, "id">) => Promise<void>;
}

export function AddMatchForm({ open, onOpenChange, onSubmit }: AddMatchFormProps) {
  const { user } = useAuth();
  const { games, isLoading: gamesLoading } = useGames();
  const { players, isLoading: playersLoading } = usePlayers();
  const [selectedGameId, setSelectedGameId] = useState<string>("");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [scores, setScores] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedGame = games.find((g) => g.id === selectedGameId);

  // Reset when game changes
  useEffect(() => {
    if (selectedGame) {
      const minPlayers = Math.min(...selectedGame.supportedPlayerCounts);
      setSelectedPlayerIds(new Array(minPlayers).fill(null));
      setScores(new Array(minPlayers).fill(0));
    }
  }, [selectedGameId]);

  const handlePlayerSelect = (index: number, playerId: string | null) => {
    setSelectedPlayerIds((prev) => {
      const newIds = [...prev];
      newIds[index] = playerId;
      return newIds;
    });
    // Initialize score for this player if not already set
    setScores((prev) => {
      const newScores = [...prev];
      if (newScores[index] === undefined) {
        newScores[index] = 0;
      }
      return newScores;
    });
  };

  const handleAddPlayer = () => {
    if (selectedGame) {
      const maxPlayers = Math.max(...selectedGame.supportedPlayerCounts);
      if (selectedPlayerIds.length < maxPlayers) {
        setSelectedPlayerIds((prev) => [...prev, null]);
        setScores((prev) => [...prev, 0]);
      }
    }
  };

  const handleRemovePlayer = (index: number) => {
    if (selectedGame) {
      const minPlayers = Math.min(...selectedGame.supportedPlayerCounts);
      if (selectedPlayerIds.length > minPlayers) {
        setSelectedPlayerIds((prev) => prev.filter((_, i) => i !== index));
        setScores((prev) => prev.filter((_, i) => i !== index));
      }
    }
  };

  const handleScoreChange = (index: number, value: number) => {
    setScores((prev) => {
      const newScores = [...prev];
      newScores[index] = value;
      return newScores;
    });
  };

  const handleWinnerToggle = (index: number) => {
    setScores((prev) => {
      const newScores = [...prev];
      const currentValue = newScores[index] || 0;
      // Toggle between 0 and 1
      newScores[index] = currentValue === 1 ? 0 : 1;
      // If this player is set to winner (1), reset all other players to 0
      if (newScores[index] === 1) {
        for (let i = 0; i < newScores.length; i++) {
          if (i !== index) {
            newScores[i] = 0;
          }
        }
      }
      return newScores;
    });
  };

  const canSubmit = () => {
    if (!selectedGame || !user) return false;
    
    // All player slots must be filled
    const allPlayersSelected = selectedPlayerIds.every((id) => id !== null);
    if (!allPlayersSelected) return false;
    
    // Player count must be valid
    if (
      !selectedGame.supportedPlayerCounts.includes(selectedPlayerIds.length)
    ) {
      return false;
    }
    
    // No duplicate players
    const uniqueIds = new Set(selectedPlayerIds.filter((id) => id !== null));
    if (uniqueIds.size !== selectedPlayerIds.filter((id) => id !== null).length) {
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
        playerIDs: selectedPlayerIds.filter((id) => id !== null) as string[],
        playerOrder: selectedPlayerIds.filter((id) => id !== null) as string[],
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
      onOpenChange(false);
    } catch (err) {
      console.error("Error creating match:", err);
      alert("Failed to create match");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (gamesLoading || playersLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[525px]">
          <div className="loading">Loading...</div>
        </DialogContent>
      </Dialog>
    );
  }

  if (games.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>New Match</DialogTitle>
          </DialogHeader>
          <p>You need to create at least one game before creating a match.</p>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (players.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>New Match</DialogTitle>
          </DialogHeader>
          <p>You need to create at least one player before creating a match.</p>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New Match</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="game">
                Game <span className="text-destructive">*</span>
              </Label>
              <select
                id="game"
                value={selectedGameId}
                onChange={(e) => {
                  setSelectedGameId(e.target.value);
                  setSelectedPlayerIds([]);
                  setScores([]);
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                required
              >
                <option value="">Select a game</option>
                {games.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.title}
                  </option>
                ))}
              </select>
            </div>

            {selectedGame && (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  {selectedPlayerIds.map((playerId, index) => {
                    const minPlayers = Math.min(...selectedGame.supportedPlayerCounts);
                    const maxPlayers = Math.max(...selectedGame.supportedPlayerCounts);
                    const canRemove = selectedPlayerIds.length > minPlayers;
                    const isWinner = scores[index] === 1;
                    
                    return (
                      <div key={index} className="flex gap-2 items-end">
                        {canRemove && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => handleRemovePlayer(index)}
                            className="mb-0"
                          >
                            <Trash2 />
                          </Button>
                        )}
                        <div className="flex-1">
                          <PlayerAutocomplete
                            players={players}
                            selectedPlayerId={playerId}
                            onSelect={(id) => handlePlayerSelect(index, id)}
                            placeholder={`Player ${index + 1}`}
                            excludePlayerIds={selectedPlayerIds.filter((id) => id !== null) as string[]}
                          />
                        </div>
                        {selectedGame.isBinaryScore ? (
                          <div className="flex items-center mb-0">
                            <Switch
                              id={`winner-${index}`}
                              checked={isWinner}
                              onCheckedChange={() => handleWinnerToggle(index)}
                              disabled={!playerId}
                            />
                          </div>
                        ) : (
                          <div className="w-24">
                            <Input
                              id={`score-${index}`}
                              type="number"
                              min="0"
                              value={scores[index] || 0}
                              onChange={(e) =>
                                handleScoreChange(
                                  index,
                                  parseInt(e.target.value) || 0
                                )
                              }
                              placeholder="Score"
                              disabled={!playerId}
                              required={!!playerId}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {selectedPlayerIds.length < Math.max(...selectedGame.supportedPlayerCounts) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleAddPlayer}
                      className="w-fit"
                    >
                      + Add Player
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting || !canSubmit()}>
              {isSubmitting ? "Creating..." : "Create Match"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

