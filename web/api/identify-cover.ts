/**
 * Identify a board game from a scanned box cover.
 *
 * POST { image: base64 JPEG, titles: string[] } with a Firebase ID token as
 * `Authorization: Bearer <token>`. Returns { title, libraryMatch }: the title
 * as printed on the box, and the library title it is (or null).
 *
 * Requires ANTHROPIC_API_KEY and VITE_FIREBASE_PROJECT_ID in the environment.
 */
import Anthropic from "@anthropic-ai/sdk";
import { createRemoteJWKSet, jwtVerify } from "jose";

const MODEL = "claude-haiku-4-5";
const MAX_IMAGE_CHARS = 3_000_000; // ~2.2 MB of JPEG; the app sends ~100 KB
const MAX_TITLES = 3000;

// Firebase ID tokens are signed by Google; only signed-in players can spend on scans
const firebaseKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

const client = new Anthropic();

const SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description:
        "The game's title as printed on the box, in normal title case (not all caps). Empty string if this isn't a game box or the title can't be made out.",
    },
    libraryMatch: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description:
        "The exact title from the library list that is this same game, or null if none is. Treat a different edition of the same game as a match; a different game in the same series is not.",
    },
  },
  required: ["title", "libraryMatch"],
  additionalProperties: false,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export async function POST(request: Request) {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token || !projectId) return json({ error: "Sign in to scan" }, 401);
  try {
    await jwtVerify(token, firebaseKeys, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
  } catch {
    return json({ error: "Sign in to scan" }, 401);
  }

  let image: unknown, titles: unknown;
  try {
    ({ image, titles } = await request.json());
  } catch {
    return json({ error: "Expected JSON" }, 400);
  }
  if (typeof image !== "string" || !image || image.length > MAX_IMAGE_CHARS) {
    return json({ error: "Expected a base64 JPEG image" }, 400);
  }
  const library = Array.isArray(titles)
    ? titles.filter((t): t is string => typeof t === "string").slice(0, MAX_TITLES)
    : [];

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system:
        "You identify board, card and party games from photos of their box covers, for a game night score-tracking app. The photo has already been cropped and flattened to the cover. Read the title from the cover art, using your knowledge of published games to resolve stylised logos.",
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
            {
              type: "text",
              text: `Which game is this? Games already in the library:\n${library.join("\n") || "(none)"}`,
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") return json({ title: "", libraryMatch: null });
    const text = response.content.find((b) => b.type === "text");
    const parsed = text?.type === "text" ? JSON.parse(text.text) : null;
    const title = typeof parsed?.title === "string" ? parsed.title.trim() : "";
    // Only trust a match that is really one of the titles we sent
    const libraryMatch = library.includes(parsed?.libraryMatch) ? (parsed.libraryMatch as string) : null;
    return json({ title, libraryMatch });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: "Too many scans, try again shortly" }, 429);
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("identify-cover: ANTHROPIC_API_KEY is missing or invalid");
      return json({ error: "Scanning isn't set up" }, 503);
    }
    if (err instanceof Anthropic.APIError) {
      console.error(`identify-cover: API error ${err.status}:`, err.message);
      return json({ error: "Couldn't identify the cover" }, 502);
    }
    console.error("identify-cover:", err);
    return json({ error: "Couldn't identify the cover" }, 500);
  }
}
