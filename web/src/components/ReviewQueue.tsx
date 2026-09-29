import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useGamesData, usePlayersData, useReviewQueue } from "../context/DataCacheContext";
import {
  approveGame, approveImage, banUser, deleteGame, dismissReport, rejectImage, subscribeToReports, updatePlayer,
  type PendingImage, type Report,
} from "../services/databaseService";
import type { Game } from "../models/Game";

const asSrc = (image: PendingImage) => (image.kind === "player" ? `data:image/jpeg;base64,${image.image}` : image.image);

/** Admin: games and photos people added, waiting to be shown to everyone */
export function ReviewQueue() {
  const { games, refreshGames } = useGamesData();
  const { players } = usePlayersData();
  const { allPending } = useReviewQueue();
  const [busy, setBusy] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  useEffect(() => subscribeToReports(setReports), []);

  const pendingGames = games.filter((g) => g.pending);
  const coverFor = (gameId: string) => allPending.find((p) => p.kind === "game" && p.targetId === gameId);
  const byUser = (uid?: string) =>
    players.find((p) => p.ownerID === uid || p.googleUserID === uid || (uid && p.linkedGoogleUserIDs?.[uid]))?.name ?? "Someone";
  // Uploads not tied to a pending game: profile photos, and covers for games already on the shelf
  const otherImages = allPending.filter((p) => p.kind === "player" || !pendingGames.some((g) => g.id === p.targetId));

  const run = async (key: string, action: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await action();
      await refreshGames();
      toast.success(done);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't work");
    } finally {
      setBusy(null);
    }
  };

  const approveAll = (game: Game, cover?: PendingImage) =>
    run(game.id, async () => {
      if (cover) await approveImage(cover);
      await approveGame(game.id);
    }, `${game.title} is on the shelf`);

  const reportItems = reports.map((report) => {
    const game = report.kind === "game" ? games.find((g) => g.id === report.targetId) : undefined;
    const player = report.kind === "player" ? players.find((p) => p.id === report.targetId) : undefined;
    const ownerUid = game?.createdByID ?? player?.ownerID;
    const name = game?.title ?? player?.name ?? "Already removed";
    return (
      <li key={report.id} className="review-item">
        <span className="review-thumb review-thumb-empty">Report</span>
        <div className="review-text">
          <strong>
            <a href={report.kind === "game" ? `/games/${report.targetId}` : `/players/${report.targetId}`}>{name}</a>
          </strong>
          <span>{report.reason ? `"${report.reason}"` : "No reason given"} · reported by {byUser(report.reportedBy)}</span>
        </div>
        <div className="review-actions">
          <Button size="sm" variant="secondary" disabled={busy === report.id}
            onClick={() => run(report.id, () => dismissReport(report.id), "Dismissed")}>Dismiss</Button>
          {game && (
            <Button size="sm" variant="destructive" disabled={busy === report.id}
              onClick={() => window.confirm(`Delete ${game.title}?`) &&
                run(report.id, async () => { await deleteGame(game.id); await dismissReport(report.id); }, `${game.title} deleted`)}>
              Delete game
            </Button>
          )}
          {player?.photoData && (
            <Button size="sm" variant="destructive" disabled={busy === report.id}
              onClick={() => run(report.id, async () => { await updatePlayer(player.id, { photoData: null }); await dismissReport(report.id); }, "Photo removed")}>
              Remove photo
            </Button>
          )}
          {ownerUid && (
            <Button size="sm" variant="destructive" disabled={busy === report.id}
              onClick={() => window.confirm(`Ban ${byUser(ownerUid)}? They won't be able to add or change anything.`) &&
                run(report.id, () => banUser(ownerUid), "Banned")}>
              Ban {report.kind === "game" ? "creator" : "player"}
            </Button>
          )}
        </div>
      </li>
    );
  });

  if (!pendingGames.length && !otherImages.length && !reports.length) {
    return <p className="form-hint">Nothing waiting for review.</p>;
  }

  return (
    <ul className="review-list">
      {reportItems}
      {pendingGames.map((game) => {
        const cover = coverFor(game.id);
        return (
          <li key={game.id} className="review-item">
            {cover ? <img src={asSrc(cover)} alt="" className="review-thumb" /> : <span className="review-thumb review-thumb-empty">No cover</span>}
            <div className="review-text">
              <strong>{game.title}</strong>
              <span>New game by {byUser(game.createdByID)}</span>
            </div>
            <div className="review-actions">
              <Button size="sm" disabled={busy === game.id} onClick={() => approveAll(game, cover)}>Approve</Button>
              {cover && (
                <Button size="sm" variant="secondary" disabled={busy === game.id}
                  onClick={() => run(game.id, async () => { await rejectImage(cover); await approveGame(game.id); }, `${game.title} approved without its cover`)}>
                  Drop cover
                </Button>
              )}
              <Button size="sm" variant="destructive" disabled={busy === game.id}
                onClick={() => run(game.id, async () => { if (cover) await rejectImage(cover); await deleteGame(game.id); }, `${game.title} deleted`)}>
                Delete
              </Button>
            </div>
          </li>
        );
      })}
      {otherImages.map((image) => {
        const name = image.kind === "player"
          ? players.find((p) => p.id === image.targetId)?.name ?? "A player"
          : games.find((g) => g.id === image.targetId)?.title ?? "A game";
        return (
          <li key={image.id} className="review-item">
            <img src={asSrc(image)} alt="" className={`review-thumb${image.kind === "player" ? " review-thumb-round" : ""}`} />
            <div className="review-text">
              <strong>{name}</strong>
              <span>{image.kind === "player" ? "New profile photo" : "New cover"} by {byUser(image.uploadedBy)}</span>
            </div>
            <div className="review-actions">
              <Button size="sm" disabled={busy === image.id} onClick={() => run(image.id, () => approveImage(image), "Approved")}>Approve</Button>
              <Button size="sm" variant="destructive" disabled={busy === image.id} onClick={() => run(image.id, () => rejectImage(image), "Rejected")}>Reject</Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
