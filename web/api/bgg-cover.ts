import { BggError, bggErrorResponse, bggImageUrl } from '../server/bgg';

/** Same-origin covers work as WebGL textures; BGG's image CDN has no CORS headers. */
export async function GET(request: Request) {
  try {
    const input = new URL(request.url).searchParams.get('url') ?? '';
    const url = input.length <= 2000 ? bggImageUrl(input) : undefined;
    if (!url) throw new BggError('Invalid cover.', 400);
    // Fixed CDN allowlist, no redirects, no caller-supplied credentials.
    const cover = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
    const type = cover.headers.get('content-type')?.split(';')[0] ?? '';
    if (!cover.ok || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type)) throw new BggError('Cover unavailable.', 404);
    return new Response(cover.body, { headers: {
      'content-type': type, 'cache-control': 'public, max-age=86400',
      'vercel-cdn-cache-control': 'max-age=604800, stale-while-revalidate=2592000',
      'x-content-type-options': 'nosniff',
    } });
  } catch (error) { return bggErrorResponse(error); }
}
