/**
 * Backfill games with cover art and box dimensions from BoardGameGeek.
 *
 * Usage:
 *   npm run bgg -- match            Find a BGG id for each game; writes scripts/data/bgg-matches.json to review
 *   npm run bgg -- apply --dry-run  Show what apply would change
 *   npm run bgg -- apply            Fetch covers + dimensions for reviewed matches and save them
 *   npm run bgg -- cors             One-time: let browsers load covers from Storage as WebGL textures
 *
 * Flags for apply:
 *   --replace-covers   Overwrite covers that already exist (default: only fill missing or broken ones)
 *   --replace-dims     Overwrite box sizes an admin already set
 *
 * Requires in web/.env (or the environment):
 *   BGG_TOKEN                        Bearer token from boardgamegeek.com/applications
 *   GOOGLE_APPLICATION_CREDENTIALS   Path to a Firebase service account JSON
 *   VITE_FIREBASE_DATABASE_URL, VITE_FIREBASE_STORAGE_BUCKET
 *
 * BGG terms: call the API server-side only, cache results, and credit
 * "Powered by BGG" in the app. Requests are spaced ~5s apart as BGG asks.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- BGG's XML is parsed into untyped trees */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { XMLParser } from "fast-xml-parser";
import sharp from "sharp";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getStorage } from "firebase-admin/storage";
import { traditionalKind } from "../src/lib/traditionalGames.ts";
import type { BoxDims, Game } from "../src/models/Game.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MATCHES_PATH = join(__dirname, "data/bgg-matches.json");
const BGG = "https://boardgamegeek.com/xmlapi2";
const REQUEST_GAP_MS = 5000;

// --- config ----------------------------------------------------------------

const env: Record<string, string> = {};
try {
  for (const line of readFileSync(join(__dirname, "../.env"), "utf8").split("\n")) {
    const m = line.match(/^([^=#]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
} catch {
  // No .env; fall back to process.env
}
const cfg = (key: string) => env[key] || process.env[key];

function requireCfg(key: string) {
  const value = cfg(key);
  if (!value) {
    console.error(`Missing ${key}. See the header of scripts/bgg-backfill.ts.`);
    process.exit(1);
  }
  return value;
}

// --- BGG client ------------------------------------------------------------

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  isArray: (name) => ["item", "name", "link"].includes(name),
});

let lastRequest = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Spaced out, retried on BGG's "queued" (202) and overload responses
async function bgg(path: string): Promise<any> {
  const token = requireCfg("BGG_TOKEN");
  for (let attempt = 0; attempt < 6; attempt++) {
    const wait = lastRequest + REQUEST_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    const res = await fetch(`${BGG}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 200) return xml.parse(await res.text());
    if (res.status === 401) throw new Error("BGG returned 401: check BGG_TOKEN (the header must be 'Bearer <token>')");
    if ([202, 429, 500, 502, 503].includes(res.status)) {
      const backoff = REQUEST_GAP_MS * 2 ** attempt;
      console.warn(`  BGG ${res.status}, retrying in ${backoff / 1000}s`);
      await sleep(backoff);
      continue;
    }
    throw new Error(`BGG ${res.status} for ${path}`);
  }
  throw new Error(`BGG kept failing for ${path}`);
}

const attr = (node: any, key = "value") => (node && typeof node === "object" ? node[key] : undefined);
const primaryName = (item: any) =>
  (item.name ?? []).find((n: any) => n.type === "primary")?.value ?? item.name?.[0]?.value;

type Candidate = { id: number; name: string; year?: number; ratings: number };

async function things(ids: number[], params: string) {
  const out = new Map<number, any>();
  for (let i = 0; i < ids.length; i += 20) {
    const batch = ids.slice(i, i + 20);
    const data = await bgg(`/thing?id=${batch.join(",")}&${params}`);
    for (const item of data.items?.item ?? []) out.set(Number(item.id), item);
  }
  return out;
}

// Exact-title matches first; the most-rated candidate wins
async function findCandidates(title: string): Promise<Candidate[]> {
  const query = encodeURIComponent(title.replace(/\s*\([^)]*\)\s*/g, " ").trim());
  let data = await bgg(`/search?query=${query}&type=boardgame&exact=1`);
  let items: any[] = data.items?.item ?? [];
  if (!items.length) {
    data = await bgg(`/search?query=${query}&type=boardgame`);
    items = data.items?.item ?? [];
  }
  const ids = items.slice(0, 8).map((i) => Number(i.id));
  if (!ids.length) return [];
  const details = await things(ids, "stats=1");
  return ids
    .map((id): Candidate | null => {
      const item = details.get(id);
      if (!item) return null;
      return {
        id,
        name: primaryName(item),
        year: Number(attr(item.yearpublished)) || undefined,
        ratings: Number(attr(item.statistics?.ratings?.usersrated)) || 0,
      };
    })
    .filter((c): c is Candidate => c !== null)
    .sort((a, b) => b.ratings - a.ratings);
}

// Versions carry per-edition box sizes in inches; "0" means unknown.
// Prefer the newest English edition with all three sides.
function pickDims(item: any): BoxDims | undefined {
  const versions: any[] = item.versions?.item ?? [];
  const sized = versions
    .map((v) => ({
      width: Number(attr(v.width)) || 0,
      length: Number(attr(v.length)) || 0,
      depth: Number(attr(v.depth)) || 0,
      year: Number(attr(v.yearpublished)) || 0,
      english: (v.link ?? []).some((l: any) => l.type === "language" && l.value === "English"),
    }))
    .filter((v) => v.width > 0 && v.length > 0 && v.depth > 0);
  if (!sized.length) return undefined;
  const pool = sized.some((v) => v.english) ? sized.filter((v) => v.english) : sized;
  pool.sort((a, b) => b.year - a.year);
  const { width, length, depth } = pool[0];
  return { width, length, depth };
}

// --- Firebase --------------------------------------------------------------

function firebase() {
  const app = initializeApp({
    credential: applicationDefault(),
    databaseURL: requireCfg("VITE_FIREBASE_DATABASE_URL"),
    storageBucket: requireCfg("VITE_FIREBASE_STORAGE_BUCKET"),
  });
  return { db: getDatabase(app), bucket: getStorage(app).bucket() };
}

async function loadGames(db: ReturnType<typeof getDatabase>): Promise<Game[]> {
  const snap = await db.ref("games").get();
  const val = (snap.val() ?? {}) as Record<string, Omit<Game, "id">>;
  return Object.entries(val).map(([id, g]) => ({ ...g, id }));
}

// A cover counts as missing when there is none or its URL no longer loads
async function hasWorkingCover(game: Game) {
  if (!game.coverArt) return false;
  if (game.coverArt.startsWith("data:")) return true;
  try {
    const res = await fetch(game.coverArt, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

// --- commands --------------------------------------------------------------

type Match = {
  gameId: string;
  title: string;
  bggId: number | null;
  bggName?: string;
  year?: number;
  /** "check" when the pick is ambiguous or fuzzy; review those first */
  confidence: "exact" | "check" | "none";
  /** Set true to leave this game alone in apply */
  skip?: boolean;
  candidates: Candidate[];
};

function readMatches(): Match[] {
  return existsSync(MATCHES_PATH) ? JSON.parse(readFileSync(MATCHES_PATH, "utf8")) : [];
}

function writeMatches(matches: Match[]) {
  mkdirSync(dirname(MATCHES_PATH), { recursive: true });
  writeFileSync(MATCHES_PATH, JSON.stringify(matches, null, 2) + "\n");
}

async function match() {
  requireCfg("BGG_TOKEN");
  const { db } = firebase();
  const games = await loadGames(db);
  const matches = readMatches();
  const done = new Set(matches.map((m) => m.gameId));
  const todo = games.filter((g) => !g.bggId && !done.has(g.id) && !traditionalKind(g.title));
  console.log(`${todo.length} games to match (${done.size} already in ${MATCHES_PATH}, traditional games skipped)`);

  for (const [i, game] of todo.entries()) {
    const candidates = await findCandidates(game.title);
    const best = candidates[0];
    const exact = best && best.name.toLowerCase() === game.title.toLowerCase();
    // Clear winner: exact title and far more ratings than the runner-up
    const clear = exact && (!candidates[1] || best.ratings > candidates[1].ratings * 5);
    matches.push({
      gameId: game.id,
      title: game.title,
      bggId: best?.id ?? null,
      bggName: best?.name,
      year: best?.year,
      confidence: !best ? "none" : clear ? "exact" : "check",
      candidates: candidates.slice(0, 5),
    });
    // Save as we go so an interrupted run picks up where it left off
    writeMatches(matches);
    console.log(`[${i + 1}/${todo.length}] ${game.title} → ${best ? `${best.name} (${best.year ?? "?"}) #${best.id}` : "no match"}${clear ? "" : "  ← check"}`);
  }

  const check = matches.filter((m) => m.confidence !== "exact").length;
  console.log(`\nDone. Review ${MATCHES_PATH}: ${check} entries need a look.`);
  console.log(`Fix bggId by hand (see "candidates"), or set "skip": true. Then run: npm run bgg -- apply --dry-run`);
}

async function apply(flags: Set<string>) {
  const dryRun = flags.has("--dry-run");
  requireCfg("BGG_TOKEN");
  const { db, bucket } = firebase();
  const games = new Map((await loadGames(db)).map((g) => [g.id, g]));
  const matches = readMatches().filter((m) => m.bggId && !m.skip);
  if (!matches.length) {
    console.log(`No matches to apply. Run "npm run bgg -- match" first.`);
    return;
  }

  const items = await things(
    [...new Set(matches.map((m) => m.bggId!))],
    "versions=1"
  );

  for (const m of matches) {
    const game = games.get(m.gameId);
    const item = items.get(m.bggId!);
    if (!game || !item) {
      console.warn(`- ${m.title}: ${!game ? "game no longer exists" : `BGG #${m.bggId} not found`}`);
      continue;
    }
    const updates: Record<string, unknown> = { bggId: m.bggId };
    const notes: string[] = [];

    const imageUrl: string | undefined = typeof item.image === "string" ? item.image.trim() : undefined;
    let orientation: BoxDims["orientation"];
    if (imageUrl && (flags.has("--replace-covers") || !(await hasWorkingCover(game)))) {
      const res = await fetch(imageUrl);
      if (res.ok) {
        const source = Buffer.from(await res.arrayBuffer());
        const meta = await sharp(source).metadata();
        const aspect = meta.width && meta.height ? meta.width / meta.height : 1;
        orientation = aspect > 1.1 ? "landscape" : aspect < 0.9 ? "portrait" : undefined;
        // 1024px is plenty for the zoomed-in box; the shelf downsizes further
        const webp = await sharp(source).resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
        const path = `covers/${game.id}.webp`;
        notes.push(`cover ${meta.width}×${meta.height} → ${path} (${Math.round(webp.length / 1024)} KB)`);
        if (!dryRun) {
          const token = randomUUID();
          await bucket.file(path).save(webp, {
            contentType: "image/webp",
            metadata: {
              cacheControl: "public, max-age=31536000",
              metadata: { firebaseStorageDownloadTokens: token, source: `bgg:${m.bggId}` },
            },
          });
          updates.coverArt = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
        }
      } else {
        notes.push(`cover download failed (${res.status})`);
      }
    } else if (!imageUrl) {
      notes.push("no BGG image");
    } else {
      notes.push("kept existing cover");
    }

    const dims = pickDims(item);
    if (dims && (flags.has("--replace-dims") || !game.boxDims)) {
      updates.boxDims = orientation ? { ...dims, orientation } : dims;
      notes.push(`box ${dims.width}×${dims.length}×${dims.depth} in${orientation ? ` ${orientation}` : ""}`);
    } else if (!dims) {
      notes.push("no box size on BGG");
    }

    console.log(`- ${m.title} (#${m.bggId}): ${notes.join("; ")}`);
    if (!dryRun) await db.ref(`games/${game.id}`).update(updates);
  }
  console.log(dryRun ? "\nDry run: nothing was written." : "\nDone.");
}

// Browsers need CORS headers to use Storage images as WebGL textures
async function cors() {
  const { bucket } = firebase();
  await bucket.setCorsConfiguration([{ origin: ["*"], method: ["GET", "HEAD"], maxAgeSeconds: 3600 }]);
  console.log(`CORS set on ${bucket.name}: GET/HEAD from any origin.`);
}

const [command, ...rest] = process.argv.slice(2);
const flags = new Set(rest);
const commands: Record<string, () => Promise<void>> = { match, apply: () => apply(flags), cors };
if (!command || !commands[command]) {
  console.log("Usage: npm run bgg -- <match|apply|cors> [--dry-run] [--replace-covers] [--replace-dims]");
  process.exit(command ? 1 : 0);
}
commands[command]().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
