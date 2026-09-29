/**
 * Cached copies of the public lists (games, players, matches) for browsing.
 *
 * GET /api/public?list=games. Vercel's CDN serves the same response to
 * everyone for a minute (and a stale one for up to 10 more while it
 * refreshes), so visitors never open a Realtime Database connection and the
 * database is read about once a minute per list, whatever the traffic.
 */
const LISTS = new Set(["games", "players", "matches"]);

export async function GET(request: Request) {
  const list = new URL(request.url).searchParams.get("list") ?? "";
  const databaseUrl = process.env.VITE_FIREBASE_DATABASE_URL?.replace(/\/$/, "");
  if (!LISTS.has(list) || !databaseUrl) {
    return new Response(JSON.stringify({ error: "Unknown list" }), { status: 400 });
  }
  const res = await fetch(`${databaseUrl}/${list}.json`);
  if (!res.ok) return new Response(JSON.stringify({ error: "Database unavailable" }), { status: 502 });
  return new Response(await res.text(), {
    headers: {
      "content-type": "application/json",
      // Browsers always ask again; Vercel's CDN answers from its copy
      "cache-control": "public, max-age=0, must-revalidate",
      "vercel-cdn-cache-control": "max-age=60, stale-while-revalidate=600",
    },
  });
}
