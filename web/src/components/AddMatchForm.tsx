import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import type { Match } from "../models/Match";
import type { Player } from "../models/Player";
import { useAuth } from "../context/AuthContext";
import { useGames } from "../hooks/useGames";
import { usePlayers } from "../hooks/usePlayers";
import { useActivity } from "../hooks/useActivity";
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
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { computeWinnerID } from "../models/Match";
import { useMediaQuery } from "@/hooks/use-media-query";
import "./AddGameForm.css";

interface AddMatchFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (match: Omit<Match, "id">) => Promise<void>;
  defaultGameId?: string;
  sessionParticipants?: Player[]; // Optional session participants to prefill
  sessionCode?: string; // Optional session code to associate match with session
}

export function AddMatchForm({ open, onOpenChange, onSubmit, defaultGameId, sessionParticipants, sessionCode }: AddMatchFormProps) {
  const { user } = useAuth();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { games, isLoading: gamesLoading } = useGames();
  const { players, isLoading: playersLoading } = usePlayers();
  const { matches: recentMatches } = useActivity(100, 90); // Last 100 matches from last 90 days
  const [selectedGameId, setSelectedGameId] = useState<string>(defaultGameId || "");
  const [playerInputs, setPlayerInputs] = useState<string[]>([]);
  const [scores, setScores] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autocompleteStates, setAutocompleteStates] = useState<Array<{ value: string; showSuggestions: boolean }>>([]);

  const selectedGame = games.find((g) => g.id === selectedGameId);

  // Get recently used players from recent matches, ordered by most recently used
  const getRecentlyUsedPlayers = (): Player[] => {
    const playerIdMap = new Map<string, number>(); // playerId -> most recent match date
    
    // Track the most recent match date for each player
    recentMatches.forEach(match => {
      match.playerIDs?.forEach(playerId => {
        const currentDate = playerIdMap.get(playerId);
        if (!currentDate || match.date > currentDate) {
          playerIdMap.set(playerId, match.date);
        }
      });
    });
    
    // Sort by most recent date (descending) and convert to Player objects
    const sortedPlayerIds = Array.from(playerIdMap.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by date descending
      .map(([playerId]) => playerId);
    
    const recentlyUsedPlayers = sortedPlayerIds
      .map(playerId => players.find(p => p.id === playerId))
      .filter((player): player is Player => player !== undefined);
    
    return recentlyUsedPlayers;
  };

  // Set default game ID when dialog opens or defaultGameId changes
  useEffect(() => {
    if (open && defaultGameId && games.length > 0) {
      setSelectedGameId(defaultGameId);
    }
  }, [open, defaultGameId, games]);

  // Initialize player inputs when game changes or when session participants are provided
  useEffect(() => {
    if (selectedGame && open) {
      const gameMinPlayers = Math.min(...selectedGame.supportedPlayerCounts);
      
      // If session participants are provided, prefill with their names
      if (sessionParticipants && sessionParticipants.length > 0) {
        const participantNames = sessionParticipants.map(p => p.name);
        // Use at least gameMinPlayers, but fill with session participants if available
        const initialInputs = participantNames.slice(0, Math.max(gameMinPlayers, participantNames.length));
        // Pad to minimum if needed
        while (initialInputs.length < gameMinPlayers) {
          initialInputs.push("");
        }
        setPlayerInputs(initialInputs);
        setAutocompleteStates(initialInputs.map(value => ({ value, showSuggestions: false })));
        setScores(new Array(initialInputs.length).fill(0));
      } else {
        // No session participants, use default initialization
        setPlayerInputs(new Array(gameMinPlayers).fill(""));
        setAutocompleteStates(new Array(gameMinPlayers).fill({ value: "", showSuggestions: false }));
        setScores(new Array(gameMinPlayers).fill(0));
      }
    }
  }, [selectedGameId, open, selectedGame, sessionParticipants]);

  // Adjust scores array when player inputs change
  useEffect(() => {
    setScores((prev) => {
      if (playerInputs.length > prev.length) {
        // Add new scores for new players
        return [...prev, ...new Array(playerInputs.length - prev.length).fill(0)];
      } else if (playerInputs.length < prev.length) {
        // Remove scores for removed players (scores are managed by index, so this is handled by handleRemovePlayer)
        return prev.slice(0, playerInputs.length);
      }
      return prev;
    });
  }, [playerInputs.length]);

  const getPlayerSuggestions = (query: string): Player[] => {
    if (!query.trim()) {
      // When empty, show recently used players, or all players if no recent matches
      const recentlyUsed = getRecentlyUsedPlayers();
      return recentlyUsed.length > 0 ? recentlyUsed : players;
    }
    const lowerQuery = query.toLowerCase();
    return players.filter((player) =>
      player.name.toLowerCase().includes(lowerQuery)
    );
  };

  const findPlayerByName = (name: string): Player | undefined => {
    return players.find((p) => p.name.toLowerCase() === name.toLowerCase().trim());
  };

  const handlePlayerInputChange = (index: number, value: string) => {
    setPlayerInputs((prev) => {
      const newInputs = [...prev];
      newInputs[index] = value;
      return newInputs;
    });
    
    setAutocompleteStates((prev) => {
      const newStates = [...prev];
      newStates[index] = { value, showSuggestions: value.length > 0 };
      return newStates;
    });
  };

  const handlePlayerSelect = (index: number, playerName: string) => {
    setPlayerInputs((prev) => {
      const newInputs = [...prev];
      newInputs[index] = playerName;
      return newInputs;
    });
    
    setAutocompleteStates((prev) => {
      const newStates = [...prev];
      newStates[index] = { value: playerName, showSuggestions: false };
      return newStates;
    });
  };

  const handleAddPlayer = () => {
    if (!selectedGame) return;
    const gameMaxPlayers = Math.max(...selectedGame.supportedPlayerCounts);
    if (playerInputs.length < gameMaxPlayers) {
      setPlayerInputs((prev) => [...prev, ""]);
      setAutocompleteStates((prev) => [...prev, { value: "", showSuggestions: false }]);
    }
  };

  const handleRemovePlayer = (index: number) => {
    if (!selectedGame) return;
    const gameMinPlayers = Math.min(...selectedGame.supportedPlayerCounts);
    if (playerInputs.length > gameMinPlayers) {
      setPlayerInputs((prev) => prev.filter((_, i) => i !== index));
      setAutocompleteStates((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleScoreChange = (index: number, value: number) => {
    setScores((prev) => {
      const newScores = [...prev];
      newScores[index] = value;
      return newScores;
    });
  };

  const getSelectedPlayerIds = (): string[] => {
    return playerInputs
      .map((input) => findPlayerByName(input))
      .filter((player): player is Player => player !== undefined)
      .map((player) => player.id);
  };

  const canSubmit = () => {
    if (!selectedGame || !user) return false;
    
    const selectedPlayerIds = getSelectedPlayerIds();
    
    // Check if we have valid player count
    if (!selectedGame.supportedPlayerCounts.includes(selectedPlayerIds.length)) {
      return false;
    }
    
    // Check if all player inputs are valid (all filled with valid player names)
    if (playerInputs.length !== selectedPlayerIds.length) {
      return false;
    }
    
    // Check for duplicate players
    if (new Set(selectedPlayerIds).size !== selectedPlayerIds.length) {
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
      const selectedPlayerIds = getSelectedPlayerIds();
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
        sessionCode: sessionCode,
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

  const renderContent = (isDrawer: boolean = false) => {
    if (gamesLoading || playersLoading) {
      return <div className={isDrawer ? "py-4 px-4" : "py-4"}>Loading...</div>;
    }

    if (games.length === 0) {
      return (
        <>
          {isDrawer ? (
            <DrawerHeader>
              <DrawerTitle>New Match</DrawerTitle>
              <DrawerDescription>
                You need to create at least one game before creating a match.
              </DrawerDescription>
            </DrawerHeader>
          ) : (
            <DialogHeader>
              <DialogTitle>New Match</DialogTitle>
              <DialogDescription>
                You need to create at least one game before creating a match.
              </DialogDescription>
            </DialogHeader>
          )}
          {isDrawer ? (
            <DrawerFooter>
              <DrawerClose asChild>
                <Button type="button" variant="outline">
                  Close
                </Button>
              </DrawerClose>
            </DrawerFooter>
          ) : (
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Close
                </Button>
              </DialogClose>
            </DialogFooter>
          )}
        </>
      );
    }

    if (players.length === 0) {
      return (
        <>
          {isDrawer ? (
            <DrawerHeader>
              <DrawerTitle>New Match</DrawerTitle>
              <DrawerDescription>
                You need to create at least one player before creating a match.
              </DrawerDescription>
            </DrawerHeader>
          ) : (
            <DialogHeader>
              <DialogTitle>New Match</DialogTitle>
              <DialogDescription>
                You need to create at least one player before creating a match.
              </DialogDescription>
            </DialogHeader>
          )}
          {isDrawer ? (
            <DrawerFooter>
              <DrawerClose asChild>
                <Button type="button" variant="outline">
                  Close
                </Button>
              </DrawerClose>
            </DrawerFooter>
          ) : (
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Close
                </Button>
              </DialogClose>
            </DialogFooter>
          )}
        </>
      );
    }

    return (
      <form onSubmit={handleSubmit}>
        {isDrawer ? (
          <DrawerHeader>
            <DrawerTitle>New Match</DrawerTitle>
          </DrawerHeader>
        ) : (
          <DialogHeader>
            <DialogTitle>New Match</DialogTitle>
          </DialogHeader>
        )}
        <div className={isDrawer ? "grid gap-4 py-4 px-4" : "grid gap-4 py-4"}>
          <div className="grid gap-2">
            <Label htmlFor="game">
              Game <span className="text-destructive">*</span>
            </Label>
            <select
              id="game"
              value={selectedGameId}
              onChange={(e) => {
                setSelectedGameId(e.target.value);
              }}
              required
              disabled={!!defaultGameId}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
            <>
              <div className="grid gap-2">
                <div className="grid gap-2">
                  {playerInputs.map((inputValue, index) => {
                    const suggestions = getPlayerSuggestions(inputValue);
                    const state = autocompleteStates[index] || { value: "", showSuggestions: false };
                    const gameMinPlayers = Math.min(...selectedGame.supportedPlayerCounts);
                    const canRemove = playerInputs.length > gameMinPlayers;
                    
                    const player = findPlayerByName(inputValue);
                    const isValidPlayer = player !== undefined;
                    
                    return (
                      <div key={index} className="relative grid gap-1">
                        <div className="flex gap-2 items-center">
                          <div className="flex-1 relative">
                            <Input
                              type="text"
                              value={inputValue}
                              onChange={(e) => handlePlayerInputChange(index, e.target.value)}
                              onFocus={() => {
                                setAutocompleteStates((prev) => {
                                  const newStates = [...prev];
                                  // Show suggestions when focused, even if empty (to show recently used players)
                                  newStates[index] = { value: inputValue, showSuggestions: true };
                                  return newStates;
                                });
                              }}
                              onBlur={(e) => {
                                // Delay closing to allow click events on suggestions to fire
                                const blurValue = e.target.value;
                                setTimeout(() => {
                                  setAutocompleteStates((prev) => {
                                    const newStates = [...prev];
                                    newStates[index] = { value: blurValue, showSuggestions: false };
                                    return newStates;
                                  });
                                  
                                  // Clear invalid input - only allow valid player names
                                  // Use the value from state at the time of checking, not the blur event
                                  setPlayerInputs((prev) => {
                                    const currentValue = prev[index];
                                    if (currentValue && !findPlayerByName(currentValue)) {
                                      const newInputs = [...prev];
                                      newInputs[index] = "";
                                      return newInputs;
                                    }
                                    return prev;
                                  });
                                }, 200);
                              }}
                              placeholder={`Player ${index + 1}`}
                              className="w-full"
                            />
                            {state.showSuggestions && suggestions.length > 0 && (
                              <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                                {suggestions.map((player) => (
                                  <button
                                    key={player.id}
                                    type="button"
                                    className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground"
                                    onMouseDown={(e) => {
                                      // Prevent input blur when clicking suggestion
                                      e.preventDefault();
                                      handlePlayerSelect(index, player.name);
                                    }}
                                  >
                                    {player.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          {isValidPlayer && (
                            <>
                              {selectedGame.isBinaryScore ? (
                                <Switch
                                  checked={scores[index] === 1}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      // Set this player as winner and all others as losers
                                      setScores(() => {
                                        // Create array of correct length, all 0s except this index
                                        const newScores = new Array(playerInputs.length).fill(0);
                                        newScores[index] = 1;
                                        return newScores;
                                      });
                                    } else {
                                      handleScoreChange(index, 0);
                                    }
                                  }}
                                />
                              ) : (
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
                                  className="w-24"
                                />
                              )}
                            </>
                          )}
                          
                          {canRemove && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleRemovePlayer(index)}
                              className="px-3"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {selectedGame && playerInputs.length < Math.max(...selectedGame.supportedPlayerCounts) && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddPlayer}
                      className="w-full"
                    >
                      Add Player
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        {isDrawer ? (
          <DrawerFooter>
            <DrawerClose asChild>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </DrawerClose>
            <Button type="submit" disabled={isSubmitting || !canSubmit()}>
              {isSubmitting ? "Creating..." : "Create Match"}
            </Button>
          </DrawerFooter>
        ) : (
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
        )}
      </form>
    );
  };

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[525px]">
          {renderContent(false)}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        {renderContent(true)}
      </DrawerContent>
    </Drawer>
  );
}

