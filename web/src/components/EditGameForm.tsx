import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import type { Game } from "../models/Game";
import { useAuth } from "../context/AuthContext";
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
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { GameFormContent } from "./AddGameForm";

type ScoreCalculation = "all" | "winnerOnly" | "losersSum";

interface EditGameFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: Game;
  onSubmit: (gameId: string, game: Partial<Game>) => Promise<void>;
  onDelete?: (gameId: string) => Promise<void>;
}

export function EditGameForm({
  open,
  onOpenChange,
  game,
  onSubmit,
  onDelete,
}: EditGameFormProps) {
  const { user } = useAuth();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Extract values from game
  const minPlayers = Math.min(...game.supportedPlayerCounts);
  const maxPlayers = Math.max(...game.supportedPlayerCounts);
  const hasMax = minPlayers !== maxPlayers;
  const trackScore = !game.isBinaryScore;

  // Parse winning conditions
  const winningConditions = game.winningConditions || "game:high|round:high";
  const gameCondition = winningConditions
    .split("|")
    .find((c) => c.startsWith("game:"));
  const roundCondition = winningConditions
    .split("|")
    .find((c) => c.startsWith("round:"));
  const matchWinningCondition = gameCondition?.includes("low")
    ? "lowest"
    : "highest";
  const roundWinningCondition = roundCondition?.includes("low")
    ? "lowest"
    : "highest";

  // Determine trackRounds and scoreCalculation
  // trackRounds is enabled if there's a round condition (but it's always in the string, so we check if it differs from default)
  // Actually, trackRounds should be determined by whether the game has rounds tracking enabled
  // For now, we'll infer it from whether countAllScores is being used (when score-based)
  // This is tricky - let's default to false and let the user adjust if needed
  const trackRounds = false; // Default - user can enable if needed

  let scoreCalculation: ScoreCalculation = "all";
  if (game.countLosersOnly) {
    scoreCalculation = "losersSum";
  } else if (
    !game.countAllScores &&
    !game.countLosersOnly &&
    !game.isBinaryScore
  ) {
    scoreCalculation = "winnerOnly";
  }

  const [title, setTitle] = useState(game.title);
  const [minPlayersState, setMinPlayers] = useState(minPlayers);
  const [maxPlayersState, setMaxPlayers] = useState(maxPlayers);
  const [hasMaxState, setHasMax] = useState(hasMax);
  const [trackScoreState, setTrackScore] = useState(trackScore);
  const [isTeamBased, setIsTeamBased] = useState(game.isTeamBased || false);
  const [trackRoundsState, setTrackRounds] = useState(trackRounds);
  const [matchWinningConditionState, setMatchWinningCondition] = useState<
    "highest" | "lowest"
  >(matchWinningCondition as "highest" | "lowest");
  const [roundWinningConditionState, setRoundWinningCondition] = useState<
    "highest" | "lowest"
  >(roundWinningCondition as "highest" | "lowest");
  const [scoreCalculationState, setScoreCalculation] =
    useState<ScoreCalculation>(scoreCalculation);
  const [coverArt, setCoverArt] = useState(game.coverArt || "");
  const [coverArtPreview, setCoverArtPreview] = useState<string | null>(
    game.coverArt || null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset form when game changes
  useEffect(() => {
    if (game) {
      const min = Math.min(...game.supportedPlayerCounts);
      const max = Math.max(...game.supportedPlayerCounts);
      setTitle(game.title);
      setMinPlayers(min);
      setMaxPlayers(max);
      setHasMax(min !== max);
      setTrackScore(!game.isBinaryScore);
      setIsTeamBased(game.isTeamBased || false);
      setCoverArt(game.coverArt || "");
      setCoverArtPreview(game.coverArt || null);

      const winningConditionsStr =
        game.winningConditions || "game:high|round:high";
      const gameCond = winningConditionsStr
        .split("|")
        .find((c) => c.startsWith("game:"));
      const roundCond = winningConditionsStr
        .split("|")
        .find((c) => c.startsWith("round:"));
      setMatchWinningCondition(
        gameCond?.includes("low") ? "lowest" : "highest"
      );
      setRoundWinningCondition(
        roundCond?.includes("low") ? "lowest" : "highest"
      );
      // Note: trackRounds detection is difficult from existing data, defaulting to false
      setTrackRounds(false);

      let calc: ScoreCalculation = "all";
      if (game.countLosersOnly) {
        calc = "losersSum";
      } else if (
        !game.countAllScores &&
        !game.countLosersOnly &&
        !game.isBinaryScore
      ) {
        calc = "winnerOnly";
      }
      setScoreCalculation(calc);
    }
  }, [game]);

  const handleDelete = async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(game.id);
      onOpenChange(false);
      setShowDeleteDialog(false);
    } catch (err) {
      console.error("Error deleting game:", err);
      alert("Failed to delete game");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;

    setIsSubmitting(true);
    try {
      // Generate supported player counts from min to max
      const supportedPlayerCounts: number[] = [];
      const effectiveMax = hasMaxState ? maxPlayersState : minPlayersState;
      for (let i = minPlayersState; i <= effectiveMax; i++) {
        supportedPlayerCounts.push(i);
      }

      // Determine score calculation settings
      let countAllScores = false;
      let countLosersOnly = false;

      if (scoreCalculationState === "all") {
        countAllScores = true;
        countLosersOnly = false;
      } else if (scoreCalculationState === "winnerOnly") {
        countAllScores = false;
        countLosersOnly = false;
      } else if (scoreCalculationState === "losersSum") {
        countAllScores = false;
        countLosersOnly = true;
      }

      // Build winning conditions string
      const gameCondition = `game:${matchWinningConditionState}`;
      const roundConditionValue = trackRoundsState
        ? roundWinningConditionState
        : "highest";
      const roundCondition = `round:${roundConditionValue}`;
      const winningConditions = `${gameCondition}|${roundCondition}`;

      const updatedGame: Partial<Game> = {
        title: title.trim(),
        isBinaryScore: !trackScoreState,
        isTeamBased,
        supportedPlayerCounts,
        countAllScores,
        countLosersOnly,
        highestScoreWins: matchWinningConditionState === "highest",
        highestRoundScoreWins: roundConditionValue === "highest",
        winningConditions,
        ...(coverArt && coverArt.trim()
          ? { coverArt: coverArt.trim() }
          : coverArt === ""
          ? { coverArt: undefined }
          : {}),
      };

      await onSubmit(game.id, updatedGame);
      onOpenChange(false);
    } catch (err) {
      console.error("Error updating game:", err);
      alert("Failed to update game");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isDesktop) {
    return (
      <>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Edit Game</DialogTitle>
            </DialogHeader>
            <GameFormContent
              title={title}
              setTitle={setTitle}
              minPlayers={minPlayersState}
              setMinPlayers={setMinPlayers}
              maxPlayers={maxPlayersState}
              setMaxPlayers={setMaxPlayers}
              hasMax={hasMaxState}
              setHasMax={setHasMax}
              trackScore={trackScoreState}
              setTrackScore={setTrackScore}
              isTeamBased={isTeamBased}
              setIsTeamBased={setIsTeamBased}
              trackRounds={trackRoundsState}
              setTrackRounds={setTrackRounds}
              matchWinningCondition={matchWinningConditionState}
              setMatchWinningCondition={setMatchWinningCondition}
              roundWinningCondition={roundWinningConditionState}
              setRoundWinningCondition={setRoundWinningCondition}
              scoreCalculation={scoreCalculationState}
              setScoreCalculation={setScoreCalculation}
              coverArt={coverArt}
              setCoverArt={setCoverArt}
              coverArtPreview={coverArtPreview || undefined}
              setCoverArtPreview={setCoverArtPreview}
              isSubmitting={isSubmitting}
              onSubmit={handleSubmit}
              submitButtonText="Update Game"
              showSubmitButton={false}
              formId="edit-game-form"
            />
            <DialogFooter className="flex-col sm:flex-row sm:justify-between">
              {onDelete && (
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isSubmitting}
                >
                  Delete Game
                </Button>
              )}
              <div className={onDelete ? "ml-auto" : ""}>
                <Button
                  type="submit"
                  form="edit-game-form"
                  disabled={isSubmitting || !title.trim()}
                >
                  {isSubmitting ? "Updating..." : "Update Game"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Delete Game</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{game.title}"? This action
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>Edit Game</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <GameFormContent
              title={title}
              setTitle={setTitle}
              minPlayers={minPlayersState}
              setMinPlayers={setMinPlayers}
              maxPlayers={maxPlayersState}
              setMaxPlayers={setMaxPlayers}
              hasMax={hasMaxState}
              setHasMax={setHasMax}
              trackScore={trackScoreState}
              setTrackScore={setTrackScore}
              isTeamBased={isTeamBased}
              setIsTeamBased={setIsTeamBased}
              trackRounds={trackRoundsState}
              setTrackRounds={setTrackRounds}
              matchWinningCondition={matchWinningConditionState}
              setMatchWinningCondition={setMatchWinningCondition}
              roundWinningCondition={roundWinningConditionState}
              setRoundWinningCondition={setRoundWinningCondition}
              scoreCalculation={scoreCalculationState}
              setScoreCalculation={setScoreCalculation}
              coverArt={coverArt}
              setCoverArt={setCoverArt}
              coverArtPreview={coverArtPreview || undefined}
              setCoverArtPreview={setCoverArtPreview}
              isSubmitting={isSubmitting}
              onSubmit={handleSubmit}
              className="px-0"
              submitButtonText="Update Game"
              showSubmitButton={false}
              formId="edit-game-form-mobile"
            />
          </div>
          <DrawerFooter className="flex-col gap-2">
            <Button
              type="submit"
              form="edit-game-form-mobile"
              disabled={isSubmitting || !title.trim()}
              className="w-full"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
            {onDelete && (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isSubmitting}
                className="w-full"
              >
                Delete Game
              </Button>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Game</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{game.title}"? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
