/**
 * Shrink oversized player photos to the size the app now saves: a 256px
 * square JPEG. Older uploads were stored at full size, and every player record
 * is downloaded when the app loads.
 *
 * Only photos over 60KB are touched; the rest are already app-sized.
 *
 * Usage (from web/, signed in with `firebase login`):
 *   npm run shrink-photos            Dry run: list what would shrink
 *   npm run shrink-photos -- --apply Save the smaller photos
 */
import { execFileSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import sharp from "sharp";

const PROJECT = "skunk-68e66";
const DATABASE = `https://${PROJECT}-default-rtdb.firebaseio.com`;
const LIMIT = 60 * 1024;
const apply = process.argv.includes("--apply");

type PlayerRecord = { name?: string; photoData?: string };

function firebase(args: string[]) {
  return execFileSync("npx", ["--yes", "firebase-tools", ...args, "--project", PROJECT], {
    stdio: ["ignore", "pipe", "inherit"],
    encoding: "utf8",
  });
}

// Same as the app: centre-cropped 256px square JPEG, base64 without the data: prefix
async function shrink(photoData: string) {
  const jpeg = await sharp(Buffer.from(photoData, "base64"))
    .rotate() // honour EXIF orientation, as browsers do when drawing the photo
    .resize(256, 256, { fit: "cover", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return jpeg.toString("base64");
}

const kb = (n: number) => `${Math.round(n / 1024)}KB`;

async function main() {
  const players: Record<string, PlayerRecord> = await (await fetch(`${DATABASE}/players.json`)).json();
  const todo = Object.entries(players ?? {}).filter(([, p]) => (p.photoData?.length ?? 0) > LIMIT);

  console.log(`${todo.length} oversized photo(s):`);
  const results: { id: string; name: string; photoData: string }[] = [];
  for (const [id, p] of todo) {
    const photoData = await shrink(p.photoData!);
    results.push({ id, name: p.name ?? "(no name)", photoData });
    console.log(`  ${p.name}: ${kb(p.photoData!.length)} → ${kb(photoData.length)}`);
  }
  if (!apply) {
    console.log("\nDry run. Run with --apply to save them.");
    return;
  }

  const dir = mkdtempSync(join(tmpdir(), "skunk-shrink-"));
  try {
    for (const r of results) {
      try {
        const file = join(dir, `${r.id}.json`);
        writeFileSync(file, JSON.stringify({ photoData: r.photoData }));
        firebase(["database:update", `/players/${r.id}`, file, "--force"]);
        console.log(`  ✓ ${r.name}`);
      } catch (err) {
        console.log(`  ✗ ${r.name}: ${err instanceof Error ? err.message : err}`);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
