/**
 * One-time migration for existing data. Run from the browser console while
 * signed in as admin (see README.md in this folder):
 *
 * - Player photos stored inline as base64 (`photoData`) -> Firebase Storage `photoURL`
 * - Game cover art stored inline as data: URLs -> Firebase Storage URLs
 * - Player `email` fields removed from the publicly readable /players node
 *
 * Deploy storage.rules first, otherwise uploads fail and images are left inline.
 * Pass { dryRun: true } to only report what would change.
 */
import { get, ref, update } from "firebase/database";
import { database } from "../services/firebase";
import { getCurrentUser } from "../services/authService";
import { getGames, getPlayers } from "../services/databaseService";
import { storeImage, AVATAR_MAX_SIZE, COVER_ART_MAX_SIZE } from "../services/storageService";
import { isAdminEmail } from "../lib/admin";

export type MigrationReport = {
  photosMoved: number;
  coversMoved: number;
  emailsRemoved: number;
  failures: string[];
};

export async function migrateLegacyData({ dryRun = false } = {}): Promise<MigrationReport> {
  const user = getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    throw new Error("Only admins can run the migration.");
  }

  const report: MigrationReport = { photosMoved: 0, coversMoved: 0, emailsRemoved: 0, failures: [] };
  // parsePlayer drops unknown fields, so read emails from the raw records
  const rawPlayers = ((await get(ref(database, "players"))).val() ?? {}) as Record<string, { email?: unknown }>;

  for (const player of await getPlayers()) {
    const updates: Record<string, unknown> = {};

    if (player.photoData && !player.photoURL) {
      const url = dryRun
        ? "(dry run)"
        : await storeImage(`data:image/jpeg;base64,${player.photoData}`, `players/${player.id}`, AVATAR_MAX_SIZE);
      if (url.startsWith("data:")) {
        report.failures.push(`player ${player.id}: photo upload failed`);
      } else {
        updates.photoURL = url;
        updates.photoData = null;
        report.photosMoved++;
      }
    }

    if (rawPlayers[player.id]?.email !== undefined) {
      updates.email = null;
      report.emailsRemoved++;
    }

    if (!dryRun && Object.keys(updates).length > 0) {
      await update(ref(database, `players/${player.id}`), updates);
    }
  }

  for (const game of await getGames()) {
    if (!game.coverArt?.startsWith("data:")) continue;
    const url = dryRun ? "(dry run)" : await storeImage(game.coverArt, `games/${game.id}`, COVER_ART_MAX_SIZE);
    if (url.startsWith("data:")) {
      report.failures.push(`game ${game.id}: cover upload failed`);
      continue;
    }
    if (!dryRun) await update(ref(database, `games/${game.id}`), { coverArt: url });
    report.coversMoved++;
  }

  console.log(dryRun ? "Dry run:" : "Migration complete:", report);
  return report;
}
