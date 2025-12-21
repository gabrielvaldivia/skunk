import { useState, FormEvent } from "react";
import type { Game } from "../models/Game";
import { useAuth } from "../context/AuthContext";
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
import { Checkbox } from "@/components/ui/checkbox";

interface AddGameFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (game: Omit<Game, "id">) => Promise<void>;
}

type ScoreCalculation = "all" | "winnerOnly" | "losersSum";

export function AddGameForm({
  open,
  onOpenChange,
  onSubmit,
}: AddGameFormProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [minPlayers, setMinPlayers] = useState(2);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [trackScore, setTrackScore] = useState(true);
  const [matchWinningCondition, setMatchWinningCondition] = useState<
    "highest" | "lowest"
  >("highest");
  const [roundWinningCondition, setRoundWinningCondition] = useState<
    "highest" | "lowest"
  >("highest");
  const [scoreCalculation, setScoreCalculation] =
    useState<ScoreCalculation>("all");
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

      if (scoreCalculation === "all") {
        countAllScores = true;
        countLosersOnly = false;
      } else if (scoreCalculation === "winnerOnly") {
        // Only winner's score counts - both flags false
        countAllScores = false;
        countLosersOnly = false;
      } else if (scoreCalculation === "losersSum") {
        // Winner gets sum of losers' scores
        countAllScores = false;
        countLosersOnly = true;
      }

      // Build winning conditions string
      const gameCondition = `game:${matchWinningCondition}`;
      const roundCondition = `round:${roundWinningCondition}`;
      const winningConditions = `${gameCondition}|${roundCondition}`;

      const newGame: Omit<Game, "id"> = {
        title: title.trim(),
        isBinaryScore: !trackScore, // If not tracking score, it's binary (win/loss)
        supportedPlayerCounts,
        createdByID: user.uid,
        countAllScores,
        countLosersOnly,
        highestScoreWins: matchWinningCondition === "highest",
        highestRoundScoreWins: roundWinningCondition === "highest",
        winningConditions,
        creationDate: Date.now(),
      };

      await onSubmit(newGame);
      onOpenChange(false);
      // Reset form
      setTitle("");
      setMinPlayers(2);
      setMaxPlayers(4);
      setTrackScore(true);
      setMatchWinningCondition("highest");
      setRoundWinningCondition("highest");
      setScoreCalculation("all");
    } catch (err) {
      console.error("Error creating game:", err);
      alert("Failed to create game");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Game</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">
                Game Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter game title"
                autoFocus
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="minPlayers">Minimum Players</Label>
                <Input
                  id="minPlayers"
                  type="number"
                  min="2"
                  max="10"
                  value={minPlayers}
                  onChange={(e) => setMinPlayers(parseInt(e.target.value) || 2)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="maxPlayers">Maximum Players</Label>
                <Input
                  id="maxPlayers"
                  type="number"
                  min={minPlayers}
                  max="10"
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(parseInt(e.target.value) || 4)}
                />
              </div>
            </div>

            <div className="grid gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="trackScore"
                  checked={trackScore}
                  onCheckedChange={(checked) => setTrackScore(checked === true)}
                />
                <Label
                  htmlFor="trackScore"
                  className="font-normal cursor-pointer"
                >
                  Track Score
                </Label>
              </div>

              {trackScore && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="matchWinning">
                      Match Winning Condition
                    </Label>
                    <select
                      id="matchWinning"
                      value={matchWinningCondition}
                      onChange={(e) =>
                        setMatchWinningCondition(
                          e.target.value as "highest" | "lowest"
                        )
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="highest">Highest Total Score Wins</option>
                      <option value="lowest">Lowest Total Score Wins</option>
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="roundWinning">
                      Round Winning Condition
                    </Label>
                    <select
                      id="roundWinning"
                      value={roundWinningCondition}
                      onChange={(e) =>
                        setRoundWinningCondition(
                          e.target.value as "highest" | "lowest"
                        )
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="highest">Highest Score Wins</option>
                      <option value="lowest">Lowest Score Wins</option>
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="scoreCalculation">
                      Total Score Calculation
                    </Label>
                    <select
                      id="scoreCalculation"
                      value={scoreCalculation}
                      onChange={(e) =>
                        setScoreCalculation(e.target.value as ScoreCalculation)
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="all">All Players' Scores Count</option>
                      <option value="winnerOnly">
                        Only Winner's Score Counts
                      </option>
                      <option value="losersSum">
                        Winner Gets Sum of Losers' Scores
                      </option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? "Creating..." : "Create Game"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
