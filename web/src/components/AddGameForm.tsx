import { useState } from "react";
import type { FormEvent } from "react";
import type { Game } from "../models/Game";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RangeSlider } from "@/components/ui/range-slider";
import { Slider } from "@/components/ui/slider";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

interface AddGameFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (game: Omit<Game, "id">) => Promise<void>;
}

type ScoreCalculation = "all" | "winnerOnly" | "losersSum";

export interface GameFormContentProps {
  title: string;
  setTitle: (title: string) => void;
  minPlayers: number;
  setMinPlayers: (min: number) => void;
  maxPlayers: number;
  setMaxPlayers: (max: number) => void;
  hasMax: boolean;
  setHasMax: (hasMax: boolean) => void;
  trackScore: boolean;
  setTrackScore: (track: boolean) => void;
  isTeamBased: boolean;
  setIsTeamBased: (isTeam: boolean) => void;
  trackRounds: boolean;
  setTrackRounds: (track: boolean) => void;
  matchWinningCondition: "highest" | "lowest";
  setMatchWinningCondition: (condition: "highest" | "lowest") => void;
  roundWinningCondition: "highest" | "lowest";
  setRoundWinningCondition: (condition: "highest" | "lowest") => void;
  scoreCalculation: ScoreCalculation;
  setScoreCalculation: (calc: ScoreCalculation) => void;
  coverArt?: string;
  setCoverArt: (coverArt: string) => void;
  coverArtPreview?: string;
  setCoverArtPreview: (preview: string | null) => void;
  isSubmitting: boolean;
  onSubmit: (e: FormEvent) => void;
  className?: string;
  submitButtonText?: string;
  showSubmitButton?: boolean;
  formId?: string;
}

export function GameFormContent({
  title,
  setTitle,
  minPlayers,
  setMinPlayers,
  maxPlayers,
  setMaxPlayers,
  hasMax,
  setHasMax,
  trackScore,
  setTrackScore,
  isTeamBased,
  setIsTeamBased,
  trackRounds,
  setTrackRounds,
  matchWinningCondition,
  setMatchWinningCondition,
  roundWinningCondition,
  setRoundWinningCondition,
  scoreCalculation,
  setScoreCalculation,
  coverArt,
  setCoverArt,
  coverArtPreview,
  setCoverArtPreview,
  isSubmitting,
  onSubmit,
  className,
  submitButtonText = "Create Game",
  showSubmitButton = true,
  formId,
}: GameFormContentProps) {
  return (
    <form id={formId} onSubmit={onSubmit} className={cn("grid items-start gap-6", className)}>
      <div className="grid gap-4">
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

        <div className="grid gap-2">
          <Label htmlFor="coverArt">
            Cover Art (optional)
          </Label>
          <Input
            id="coverArt"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              if (!file.type.startsWith("image/")) {
                alert("Please select an image file");
                return;
              }

              if (file.size > 5 * 1024 * 1024) {
                alert("Image size must be less than 5MB");
                return;
              }

              const reader = new FileReader();
              reader.onloadend = () => {
                const result = reader.result as string;
                setCoverArtPreview(result);
                // Store as data URL for saving
                setCoverArt(result);
              };
              reader.readAsDataURL(file);
            }}
            className="cursor-pointer"
          />
          {(coverArtPreview || coverArt) && (
            <div className="mt-2 flex items-center gap-2">
              <img
                src={coverArtPreview || coverArt || ''}
                alt="Cover art preview"
                className="w-20 h-20 object-cover rounded-md border"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setCoverArtPreview(null);
                  setCoverArt("");
                  // Reset file input
                  const fileInput = document.getElementById('coverArt') as HTMLInputElement;
                  if (fileInput) {
                    fileInput.value = '';
                  }
                }}
              >
                Remove
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <div className="flex justify-between items-center">
            <Label>Player Count</Label>
            <div className="flex items-center gap-2">
              {hasMax ? (
                <>
                  <Input
                    type="number"
                    min={2}
                    value={minPlayers}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value) && value >= 2) {
                        setMinPlayers(value);
                        if (value > maxPlayers) {
                          setMaxPlayers(value);
                        }
                      }
                    }}
                    className="w-16 h-8 text-center text-sm"
                  />
                  <span className="text-sm text-muted-foreground">-</span>
                  <div className="relative group">
                    <Input
                      type="number"
                      min={minPlayers}
                      value={maxPlayers}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (!isNaN(value) && value >= minPlayers) {
                          setMaxPlayers(value);
                        }
                      }}
                      className="w-16 h-8 text-center text-sm pr-6"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setMaxPlayers(minPlayers);
                        setHasMax(false);
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-1"
                      aria-label="Remove max"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Input
                    type="number"
                    min={2}
                    value={minPlayers}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value) && value >= 2) {
                        setMinPlayers(value);
                        setMaxPlayers(value);
                      }
                    }}
                    className="w-16 h-8 text-center text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setMaxPlayers(minPlayers + 2);
                      setHasMax(true);
                    }}
                    className="text-sm text-primary hover:underline"
                  >
                    Add max
                  </button>
                </>
              )}
            </div>
          </div>
          {hasMax ? (
            <RangeSlider
              min={2}
              max={Math.max(10, minPlayers, maxPlayers)}
              minValue={minPlayers}
              maxValue={maxPlayers}
              onValueChange={({ min, max }) => {
                setMinPlayers(min);
                setMaxPlayers(max);
              }}
            />
          ) : (
            <Slider
              min={2}
              max={Math.max(10, minPlayers)}
              value={minPlayers}
              onValueChange={(value) => {
                setMinPlayers(value);
                setMaxPlayers(value);
              }}
            />
          )}
        </div>

        <div className="grid gap-4">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="isTeamBased"
              className="font-normal cursor-pointer"
            >
              Team-Based Game
            </Label>
            <Switch
              id="isTeamBased"
              checked={isTeamBased}
              onCheckedChange={(checked) => setIsTeamBased(checked === true)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label
              htmlFor="trackScore"
              className="font-normal cursor-pointer"
            >
              Track Score
            </Label>
            <Switch
              id="trackScore"
              checked={trackScore}
              onCheckedChange={(checked) => setTrackScore(checked === true)}
            />
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

              <div className="flex items-center justify-between">
                <Label
                  htmlFor="trackRounds"
                  className="font-normal cursor-pointer"
                >
                  Track Rounds
                </Label>
                <Switch
                  id="trackRounds"
                  checked={trackRounds}
                  onCheckedChange={(checked) => setTrackRounds(checked === true)}
                />
              </div>

              {trackRounds && (
                <>
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
            </>
          )}
        </div>
      </div>
      {showSubmitButton && (
        <Button type="submit" disabled={isSubmitting || !title.trim()}>
          {isSubmitting ? (submitButtonText === "Update Game" ? "Updating..." : "Creating...") : submitButtonText}
        </Button>
      )}
    </form>
  );
}

export function AddGameForm({
  open,
  onOpenChange,
  onSubmit,
}: AddGameFormProps) {
  const { user } = useAuth();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [title, setTitle] = useState("");
  const [minPlayers, setMinPlayers] = useState(2);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [hasMax, setHasMax] = useState(true);
  const [trackScore, setTrackScore] = useState(false);
  const [isTeamBased, setIsTeamBased] = useState(false);
  const [trackRounds, setTrackRounds] = useState(false);
  const [matchWinningCondition, setMatchWinningCondition] = useState<
    "highest" | "lowest"
  >("highest");
  const [roundWinningCondition, setRoundWinningCondition] = useState<
    "highest" | "lowest"
  >("highest");
  const [scoreCalculation, setScoreCalculation] =
    useState<ScoreCalculation>("all");
  const [coverArt, setCoverArt] = useState("");
  const [coverArtPreview, setCoverArtPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;

    setIsSubmitting(true);
    try {
      // Generate supported player counts from min to max
      const supportedPlayerCounts: number[] = [];
      const effectiveMax = hasMax ? maxPlayers : minPlayers;
      for (let i = minPlayers; i <= effectiveMax; i++) {
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
      // Always include round condition (use current value if trackRounds is enabled, otherwise default to "highest")
      const gameCondition = `game:${matchWinningCondition}`;
      const roundConditionValue = trackRounds ? roundWinningCondition : "highest";
      const roundCondition = `round:${roundConditionValue}`;
      const winningConditions = `${gameCondition}|${roundCondition}`;

      const newGame: Omit<Game, "id"> = {
        title: title.trim(),
        isBinaryScore: !trackScore, // If not tracking score, it's binary (win/loss)
        isTeamBased,
        supportedPlayerCounts,
        createdByID: user.uid,
        countAllScores,
        countLosersOnly,
        highestScoreWins: matchWinningCondition === "highest",
        highestRoundScoreWins: roundConditionValue === "highest",
        winningConditions,
        creationDate: Date.now(),
        ...(coverArt && coverArt.trim() ? { coverArt: coverArt.trim() } : {}),
      };

      await onSubmit(newGame);
      onOpenChange(false);
      // Reset form
      setTitle("");
      setMinPlayers(2);
      setMaxPlayers(4);
      setHasMax(true);
      setTrackScore(false);
      setIsTeamBased(false);
      setTrackRounds(false);
      setMatchWinningCondition("highest");
      setRoundWinningCondition("highest");
      setScoreCalculation("all");
      setCoverArt("");
      setCoverArtPreview(null);
    } catch (err) {
      console.error("Error creating game:", err);
      alert("Failed to create game");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Add New Game</DialogTitle>
          </DialogHeader>
          <GameFormContent
            title={title}
            setTitle={setTitle}
            minPlayers={minPlayers}
            setMinPlayers={setMinPlayers}
            maxPlayers={maxPlayers}
            setMaxPlayers={setMaxPlayers}
            hasMax={hasMax}
            setHasMax={setHasMax}
            trackScore={trackScore}
            setTrackScore={setTrackScore}
            isTeamBased={isTeamBased}
            setIsTeamBased={setIsTeamBased}
            trackRounds={trackRounds}
            setTrackRounds={setTrackRounds}
            matchWinningCondition={matchWinningCondition}
            setMatchWinningCondition={setMatchWinningCondition}
            roundWinningCondition={roundWinningCondition}
            setRoundWinningCondition={setRoundWinningCondition}
            scoreCalculation={scoreCalculation}
            setScoreCalculation={setScoreCalculation}
            coverArt={coverArt}
            setCoverArt={setCoverArt}
            coverArtPreview={coverArtPreview || undefined}
            setCoverArtPreview={setCoverArtPreview}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Add New Game</DrawerTitle>
        </DrawerHeader>
        <GameFormContent
          title={title}
          setTitle={setTitle}
          minPlayers={minPlayers}
          setMinPlayers={setMinPlayers}
          maxPlayers={maxPlayers}
          setMaxPlayers={setMaxPlayers}
          hasMax={hasMax}
          setHasMax={setHasMax}
          trackScore={trackScore}
          setTrackScore={setTrackScore}
          isTeamBased={isTeamBased}
          setIsTeamBased={setIsTeamBased}
          trackRounds={trackRounds}
          setTrackRounds={setTrackRounds}
          matchWinningCondition={matchWinningCondition}
          setMatchWinningCondition={setMatchWinningCondition}
          roundWinningCondition={roundWinningCondition}
          setRoundWinningCondition={setRoundWinningCondition}
          scoreCalculation={scoreCalculation}
          setScoreCalculation={setScoreCalculation}
          coverArt={coverArt}
          setCoverArt={setCoverArt}
          coverArtPreview={coverArtPreview || undefined}
          setCoverArtPreview={setCoverArtPreview}
          isSubmitting={isSubmitting}
          className="px-4"
          onSubmit={handleSubmit}
        />
        <DrawerFooter className="pt-2">
          <DrawerClose asChild>
            <Button type="button" variant="outline" disabled={isSubmitting}>
              Cancel
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
