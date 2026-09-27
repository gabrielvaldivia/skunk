/**
 * Give players without a profile photo their Google photo.
 *
 * The app does this for each player when they next sign in; this fills in
 * everyone else now. Players who already have a photo are never touched.
 *
 * Usage (from web/, signed in with `firebase login`):
 *   npm run photos            Dry run: list who would get a photo
 *   npm run photos -- --apply Save the photos
 *
 * Reads accounts with `firebase auth:export` and writes with
 * `firebase database:update`, so the Firebase CLI's own sign-in is all it needs.
 */
import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import sharp from "sharp";

const PROJECT = "skunk-68e66";
const DATABASE = `https://${PROJECT}-default-rtdb.firebaseio.com`;
const apply = process.argv.includes("--apply");

type AuthUser = { localId: string; photoUrl?: string; providerUserInfo?: { photoUrl?: string }[] };
type PlayerRecord = { name?: string; googleUserID?: string; linkedGoogleUserIDs?: Record<string, true>; photoData?: string };

function firebase(args: string[]) {
  return execFileSync("npx", ["--yes", "firebase-tools", ...args, "--project", PROJECT], {
    stdio: ["ignore", "pipe", "inherit"],
    encoding: "utf8",
  });
}

// Same as the app: 256px square JPEG, base64 without the data: prefix
async function photoData(url: string) {
  const res = await fetch(url.replace(/=s\d+-c$/, "=s256-c"));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const jpeg = await sharp(Buffer.from(await res.arrayBuffer()))
    .resize(256, 256, { fit: "cover" })
    .jpeg({ quality: 85 })
    .toBuffer();
  return jpeg.toString("base64");
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), "skunk-photos-"));
  try {
    // Accounts hold the Google photo; players are public
    const usersFile = join(dir, "users.json");
    firebase(["auth:export", usersFile, "--format=json"]);
    const users: AuthUser[] = JSON.parse(readFileSync(usersFile, "utf8")).users ?? [];
    const photoByUid = new Map<string, string>();
    for (const u of users) {
      const url = u.providerUserInfo?.find((p) => p.photoUrl)?.photoUrl ?? u.photoUrl;
      if (url) photoByUid.set(u.localId, url);
    }
    const players: Record<string, PlayerRecord> = await (await fetch(`${DATABASE}/players.json`)).json();

    const todo: { id: string; name: string; url: string }[] = [];
    let withPhoto = 0;
    for (const [id, p] of Object.entries(players ?? {})) {
      const uids = [p.googleUserID, ...Object.keys(p.linkedGoogleUserIDs ?? {})].filter(Boolean) as string[];
      if (!uids.length) continue; // Never signed in: no Google photo to use
      if (p.photoData) {
        withPhoto++;
        continue;
      }
      const url = uids.map((uid) => photoByUid.get(uid)).find(Boolean);
      if (url) todo.push({ id, name: p.name ?? "(no name)", url });
    }

    console.log(`${withPhoto} signed-in players already have a photo (left alone).`);
    console.log(`${todo.length} would get their Google photo:`);
    for (const t of todo) console.log(`  ${t.name}`);
    if (!apply) {
      console.log("\nDry run. Run with --apply to save them.");
      return;
    }

    for (const t of todo) {
      try {
        const file = join(dir, `${t.id}.json`);
        writeFileSync(file, JSON.stringify({ photoData: await photoData(t.url) }));
        firebase(["database:update", `/players/${t.id}`, file, "--force"]);
        console.log(`  ✓ ${t.name}`);
      } catch (err) {
        console.log(`  ✗ ${t.name}: ${err instanceof Error ? err.message : err}`);
      }
    }
  } finally {
    // The export holds everyone's account details; don't leave it lying around
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
