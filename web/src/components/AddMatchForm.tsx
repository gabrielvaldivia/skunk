import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import type { Match, Team } from "../models/Match";
import type { Player } from "../models/Player";
import { useAuth } from "../context/AuthContext";
import { useGames } from "../hooks/useGames";
import { usePlayers } from "../hooks/usePlayers";
import { useActivity } from "../hooks/useActivity";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { computeWinnerID } from "../models/Match";
import { useMediaQuery } from "@/hooks/use-media-query";
import "./AddGameForm.css";
import { PlayerPicker } from "./match-form/PlayerPicker";
import { ScoreInput } from "./match-form/ScoreInput";
import { GameCombobox } from "./match-form/GameCombobox";
import { toast } from "sonner";

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
  const [gameQuery, setGameQuery] = useState<string>("");
  const [playerInputs, setPlayerInputs] = useState<string[]>([]);
  const [scores, setScores] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autocompleteStates, setAutocompleteStates] = useState<Array<{ value: string; showSuggestions: boolean }>>([]);
  const [teamAssignments, setTeamAssignments] = useState<Map<string, string>>(new Map()); // playerId -> teamId
  const [teams, setTeams] = useState<string[]>(["team1", "team2"]); // Array of team IDs

  const selectedGame = games.find((g) => g.id === selectedGameId);

  // Keep the game query in sync with the selected game
  useEffect(() => {
    const selected = games.find((g) => g.id === selectedGameId);
    setGameQuery(selected ? selected.title : "");
  }, [selectedGameId, games]);

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

  const getGameSuggestions = (query: string) => {
    const lower = query.trim().toLowerCase();
    if (!lower) {
      // Alphabetical when empty
      return [...games].sort((a, b) => a.title.localeCompare(b.title));
    }
    return games
      .filter((g) => g.title.toLowerCase().includes(lower))
      .sort((a, b) => a.title.localeCompare(b.title));
  };

  const visibleGameSuggestions = getGameSuggestions(gameQuery);

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

  // Initialize team assignments when game changes or when switching to team-based
  useEffect(() => {
    if (selectedGame?.isTeamBased && open) {
      // Reset team assignments when game changes
      setTeamAssignments(new Map());
      // Ensure at least 2 teams
      setTeams((prev) => (prev.length < 2 ? ["team1", "team2"] : prev));
    } else if (!selectedGame?.isTeamBased) {
      // Clear team assignments when switching to non-team game
      setTeamAssignments(new Map());
    }
  }, [selectedGameId, selectedGame?.isTeamBased, open]);

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

  const openPlayerSuggestions = (index: number, value: string) => {
    setAutocompleteStates((prev) => {
      const newStates = [...prev];
      // Show suggestions when focused, even if empty (to show recently used players)
      newStates[index] = { value, showSuggestions: true };
      return newStates;
    });
  };

  const closePlayerSuggestions = (index: number, blurValue: string) => {
    // Delay closing to allow click events on suggestions to fire
    setTimeout(() => {
      setAutocompleteStates((prev) => {
        const newStates = [...prev];
        newStates[index] = { value: blurValue, showSuggestions: false };
        return newStates;
      });
      // Clear invalid input - only allow valid player names
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
  };

  // Binary games: this player wins, everyone else loses
  const markWinner = (index: number) => {
    const newScores = new Array(playerInputs.length).fill(0);
    newScores[index] = 1;
    setScores(newScores);
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

      // Handle team-based games
      if (selectedGame.isTeamBased) {
        // Group players by team
        const teamMap = new Map<string, string[]>(); // teamId -> playerIds[]
        selectedPlayerIds.forEach(playerId => {
          const teamId = teamAssignments.get(playerId) || teams[0];
          if (!teamMap.has(teamId)) {
            teamMap.set(teamId, []);
          }
          teamMap.get(teamId)!.push(playerId);
        });

        // Create teams array
        const matchTeams: Team[] = Array.from(teamMap.entries()).map(([teamId, playerIds]) => ({
          teamId,
          playerIDs: playerIds,
        }));

        match.teams = matchTeams;

        // Calculate winning team
        const winnerTeamId = computeWinnerID({ ...match, id: "" }, selectedGame);
        if (winnerTeamId) {
          match.winnerTeamId = winnerTeamId;
        }
      } else {
        // Individual player games - calculate winner as before
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
      }

      await onSubmit(match);
      onOpenChange(false);
    } catch (err) {
      console.error("Error creating match:", err);
      toast.error("Failed to create match");
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
            </DrawerFooter>
          ) : (
            <DialogFooter>
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
            </DrawerFooter>
          ) : (
            <DialogFooter>
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
              <GameCombobox
                query={gameQuery}
                onQueryChange={setGameQuery}
                suggestions={visibleGameSuggestions}
                onSelect={(game) => {
                  setSelectedGameId(game.id);
                  setGameQuery(game.title);
                }}
              />
          </div>

          {selectedGame && (
            <>
              {selectedGame.isTeamBased ? (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    {playerInputs.map((inputValue, index) => {
                      const suggestions = getPlayerSuggestions(inputValue);
                      const state = autocompleteStates[index] || { value: "", showSuggestions: false };
                      const gameMinPlayers = Math.min(...selectedGame.supportedPlayerCounts);
                      const canRemove = playerInputs.length > gameMinPlayers;
                      
                      const player = findPlayerByName(inputValue);
                      const isValidPlayer = player !== undefined;
                      const playerTeamId = player ? teamAssignments.get(player.id) || teams[0] : teams[0];
                      
                      return (
                        <div key={index} className="relative grid gap-1">
                          <div className="flex gap-2 items-center">
                            <PlayerPicker
                              index={index}
                              value={inputValue}
                              player={player}
                              suggestions={suggestions}
                              showSuggestions={state.showSuggestions}
                              onChange={(value) => handlePlayerInputChange(index, value)}
                              onFocus={() => openPlayerSuggestions(index, inputValue)}
                              onBlur={(value) => closePlayerSuggestions(index, value)}
                              onSelect={(name) => handlePlayerSelect(index, name)}
                            />
                            
                            {isValidPlayer && (
                              <select
                                value={playerTeamId}
                                onChange={(e) => {
                                  if (player) {
                                    setTeamAssignments(prev => {
                                      const newMap = new Map(prev);
                                      newMap.set(player.id, e.target.value);
                                      return newMap;
                                    });
                                  }
                                }}
                                className="flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
                              >
                                {teams.map((teamId, teamIndex) => (
                                  <option key={teamId} value={teamId}>
                                    Team {teamIndex + 1}
                                  </option>
                                ))}
                              </select>
                            )}
                            
                            {canRemove && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (player) {
                                    setTeamAssignments(prev => {
                                      const newMap = new Map(prev);
                                      newMap.delete(player.id);
                                      return newMap;
                                    });
                                  }
                                  handleRemovePlayer(index);
                                }}
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="flex gap-2 items-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTeams([...teams, `team${teams.length + 1}`]);
                      }}
                    >
                      Add Team
                    </Button>
                    {teams.length > 2 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Remove last team and reassign players to first team
                          const teamToRemove = teams[teams.length - 1];
                          setTeams(teams.slice(0, -1));
                          setTeamAssignments(prev => {
                            const newMap = new Map(prev);
                            const firstTeam = teams[0];
                            prev.forEach((teamId, playerId) => {
                              if (teamId === teamToRemove) {
                                newMap.set(playerId, firstTeam);
                              }
                            });
                            return newMap;
                          });
                        }}
                      >
                        Remove Team
                      </Button>
                    )}
                  </div>

                  {/* Score inputs for team-based games - still individual scores */}
                  <div className="grid gap-2">
                    <Label>Player Scores</Label>
                    {playerInputs.map((inputValue, index) => {
                      const player = findPlayerByName(inputValue);
                      if (!player) return null;
                      
                      return (
                        <div key={index} className="flex items-center gap-2">
                          <span className="text-sm w-32">{player.name}:</span>
                          <ScoreInput
                            isBinary={selectedGame.isBinaryScore}
                            value={scores[index]}
                            onChange={(value) => handleScoreChange(index, value)}
                            onMarkWinner={() => markWinner(index)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
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
                          <PlayerPicker
                            index={index}
                            value={inputValue}
                            player={player}
                            suggestions={suggestions}
                            showSuggestions={state.showSuggestions}
                            onChange={(value) => handlePlayerInputChange(index, value)}
                            onFocus={() => openPlayerSuggestions(index, inputValue)}
                            onBlur={(value) => closePlayerSuggestions(index, value)}
                            onSelect={(name) => handlePlayerSelect(index, name)}
                          />
                          
                          {isValidPlayer && (
                            <>
                              <ScoreInput
                                id={`score-${index}`}
                                isBinary={selectedGame.isBinaryScore}
                                value={scores[index]}
                                onChange={(value) => handleScoreChange(index, value)}
                                onMarkWinner={() => markWinner(index)}
                              />
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
              )}
            </>
          )}
        </div>
        {isDrawer ? (
          <DrawerFooter>
            <Button type="submit" disabled={isSubmitting || !canSubmit()}>
              {isSubmitting ? "Creating..." : "Create Match"}
            </Button>
          </DrawerFooter>
        ) : (
          <DialogFooter>
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

