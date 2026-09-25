import type { Game } from "../models/Game";
import type { Worker } from "tesseract.js";

export type Point = [number, number];
/** Corners in source pixels: top-left, top-right, bottom-right, bottom-left */
export type Quad = [Point, Point, Point, Point];

const MAX_SOURCE = 2000;
const MAX_COVER = 1000;

/** Draw an image into a canvas, capped so warping and OCR stay quick on phones */
export function toCanvas(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const scale = Math.min(1, MAX_SOURCE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function loadImageFile(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(toCanvas(img, img.naturalWidth, img.naturalHeight));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image"));
    };
    img.src = url;
  });
}

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/**
 * Flatten the photographed cover into a front-facing rectangle: map each
 * output pixel back through the square-to-quad homography and sample the
 * source bilinearly.
 */
export function warpQuad(source: HTMLCanvasElement, quad: Quad): HTMLCanvasElement {
  const [p0, p1, p2, p3] = quad;
  let w = Math.max(dist(p0, p1), dist(p3, p2));
  let h = Math.max(dist(p0, p3), dist(p1, p2));
  const scale = Math.min(1, MAX_COVER / Math.max(w, h));
  w = Math.max(1, Math.round(w * scale));
  h = Math.max(1, Math.round(h * scale));

  // Heckbert's square-to-quad mapping: (u, v) in [0,1]² → source (x, y)
  const [x0, y0] = p0, [x1, y1] = p1, [x2, y2] = p2, [x3, y3] = p3;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1 || 1e-9;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const hh = (dx1 * dy3 - dx3 * dy1) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3, f = y0;

  const sw = source.width, sh = source.height;
  const src = source.getContext("2d")!.getImageData(0, 0, sw, sh).data;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const dst = img.data;

  for (let j = 0; j < h; j++) {
    const v = (j + 0.5) / h;
    for (let i = 0; i < w; i++) {
      const u = (i + 0.5) / w;
      const z = g * u + hh * v + 1;
      const x = Math.min(sw - 1.001, Math.max(0, (a * u + b * v + c) / z - 0.5));
      const y = Math.min(sh - 1.001, Math.max(0, (d * u + e * v + f) / z - 0.5));
      const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi;
      const i00 = (yi * sw + xi) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
      const o = (j * w + i) * 4;
      for (let k = 0; k < 3; k++) {
        const top = src[i00 + k] + (src[i10 + k] - src[i00 + k]) * fx;
        const bot = src[i01 + k] + (src[i11 + k] - src[i01 + k]) * fx;
        dst[o + k] = top + (bot - top) * fy;
      }
      dst[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

// --- reading the cover -----------------------------------------------------

// Tesseract runs on the phone, in a worker; its ~4 MB of model loads once, on the first scan
let workerPromise: Promise<Worker> | null = null;
function getWorker() {
  if (!workerPromise) {
    workerPromise = import("tesseract.js").then(async ({ createWorker }) => {
      const worker = await createWorker("eng");
      // Sparse text: box covers scatter words around art rather than in paragraphs
      await worker.setParameters({ tessedit_pageseg_mode: "11" as never });
      return worker;
    });
    workerPromise.catch(() => (workerPromise = null));
  }
  return workerPromise;
}

export type OcrWord = { text: string; confidence: number; height: number };
export type OcrResult = { words: OcrWord[]; title: string };

export async function readCover(cover: HTMLCanvasElement): Promise<OcrResult> {
  const worker = await getWorker();
  const { data } = await worker.recognize(cover, {}, { blocks: true });
  const words: OcrWord[] = [];
  const lines: { text: string; top: number; bottom: number; left: number }[] = [];
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs) {
      for (const line of para.lines) {
        for (const w of line.words) {
          words.push({ text: w.text, confidence: w.confidence, height: w.bbox.y1 - w.bbox.y0 });
        }
        const text = cleanLine(line.text);
        // Skip fragments misread from artwork ("Nn", "Kd")
        if (line.confidence >= 60 && /\p{L}{3}/u.test(text)) {
          lines.push({ text, top: line.bbox.y0, bottom: line.bbox.y1, left: line.bbox.x0 });
        }
      }
    }
  }
  return { words, title: titleCase(guessTitle(lines)) };
}

// The title is usually the biggest confident text on the box, often stacked
// over a couple of lines ("TICKET / TO RIDE"), so pull in its neighbours of a similar size
function guessTitle(lines: { text: string; top: number; bottom: number; left: number }[]) {
  if (!lines.length) return "";
  const size = (l: (typeof lines)[number]) => l.bottom - l.top;
  const biggest = lines.reduce((a, b) => (size(b) > size(a) ? b : a));
  const big = lines.filter((l) => size(l) >= size(biggest) * 0.7).sort((a, b) => a.top - b.top || a.left - b.left);
  let from = big.indexOf(biggest), to = from;
  const near = (a: (typeof lines)[number], b: (typeof lines)[number]) => b.top - a.bottom < size(biggest) * 0.8;
  while (from > 0 && near(big[from - 1], big[from])) from--;
  while (to < big.length - 1 && near(big[to], big[to + 1])) to++;
  return big.slice(from, to + 1).map((l) => l.text).join(" ");
}

function cleanLine(s: string) {
  return s.replace(/\s+/g, " ").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}!?]+$/gu, "").trim();
}

function titleCase(s: string) {
  if (s !== s.toUpperCase()) return s;
  const small = new Set(["a", "an", "and", "at", "for", "in", "of", "on", "or", "the", "to"]);
  return s
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && small.has(w) ? w : w.replace(/\p{L}/u, (ch) => ch.toUpperCase())))
    .join(" ");
}

// --- matching against games ------------------------------------------------

const STOP = new Set(["the", "a", "an", "of", "and"]);

export function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Games whose titles show up in the text read off the cover, best first */
export function matchGames(games: Game[], ocr: OcrResult, limit = 3): Game[] {
  const words = ocr.words.filter((w) => w.confidence >= 30).flatMap((w) => normalize(w.text).split(" ")).filter(Boolean);
  if (!words.length) return [];
  const wordSet = new Set(words);
  const compact = words.join("");

  const scored = games.map((game) => {
    const all = normalize(game.title).split(" ").filter(Boolean);
    const tokens = all.filter((t) => !STOP.has(t)).length ? all.filter((t) => !STOP.has(t)) : all;
    if (!tokens.length) return { game, score: 0, size: 0 };
    let hits = 0;
    for (const t of tokens) {
      if (wordSet.has(t)) hits += 1;
      else if (t.length >= 4 && words.some((w) => levenshtein(t, w) <= (t.length >= 7 ? 2 : 1))) hits += 0.8;
    }
    let score = hits / tokens.length;
    // OCR often splits or merges words in stylised logos ("7 WONDERS" → "7WONDERS")
    const joined = tokens.join("");
    if (joined.length >= 5 && compact.includes(joined)) score = Math.max(score, 1);
    // Very short titles ("Go", "Uno") turn up by accident; trust them a little less
    if (joined.length <= 3) score *= 0.9;
    return { game, score, size: joined.length };
  });

  return scored
    .filter((s) => s.score >= 0.6)
    .sort((a, b) => b.score - a.score || b.size - a.size)
    .slice(0, limit)
    .map((s) => s.game);
}

// --- matching by artwork ---------------------------------------------------

// Titles in stylised logos often can't be read, so also compare the scan to
// the covers games already have. A cover's signature is a tiny, blurred
// colour thumbnail, normalised per channel so lighting and white balance
// in the photo matter less.
const GRID = 16;
const signatures = new Map<string, Promise<Float32Array | null>>();

function signature(source: CanvasImageSource, width: number, height: number): Float32Array {
  // Step down in two passes so each cell averages its area instead of sampling a pixel
  const mid = document.createElement("canvas");
  mid.width = mid.height = GRID * 4;
  const mctx = mid.getContext("2d")!;
  mctx.imageSmoothingQuality = "high";
  // Skip a thin border, where the scan's corners are least exact
  const ix = width * 0.04, iy = height * 0.04;
  mctx.drawImage(source, ix, iy, width - ix * 2, height - iy * 2, 0, 0, mid.width, mid.height);
  const small = document.createElement("canvas");
  small.width = small.height = GRID;
  const sctx = small.getContext("2d", { willReadFrequently: true })!;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(mid, 0, 0, GRID, GRID);
  const px = sctx.getImageData(0, 0, GRID, GRID).data;

  const n = GRID * GRID;
  const sig = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    sig[i] = (r + g + b) / 3; // brightness
    sig[n + i] = r - g; // red–green
    sig[n * 2 + i] = (r + g) / 2 - b; // yellow–blue
  }
  for (let c = 0; c < 3; c++) {
    let mean = 0, sq = 0;
    for (let i = 0; i < n; i++) mean += sig[c * n + i];
    mean /= n;
    for (let i = 0; i < n; i++) sq += (sig[c * n + i] - mean) ** 2;
    const sd = Math.sqrt(sq / n);
    for (let i = 0; i < n; i++) sig[c * n + i] = sd > 4 ? (sig[c * n + i] - mean) / sd : 0;
  }
  return sig;
}

// Correlation of two signatures, -1..1, with brightness counting double
function similarity(a: Float32Array, b: Float32Array) {
  const n = GRID * GRID;
  const weights = [2, 1, 1];
  let total = 0;
  for (let c = 0; c < 3; c++) {
    let dot = 0;
    for (let i = c * n; i < (c + 1) * n; i++) dot += a[i] * b[i];
    total += (weights[c] * dot) / n;
  }
  return total / 4;
}

function coverSignature(url: string) {
  let p = signatures.get(url);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          resolve(signature(img, img.naturalWidth, img.naturalHeight));
        } catch {
          resolve(null); // Host doesn't allow reading its pixels
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
    signatures.set(url, p);
  }
  return p;
}

/** Games whose cover art looks like the scan, with how alike they are (0..1) */
export async function matchCovers(games: Game[], scan: HTMLCanvasElement) {
  const sig = signature(scan, scan.width, scan.height);
  const scored = await Promise.all(
    games
      .filter((g) => g.coverArt)
      .map(async (game) => {
        const other = await coverSignature(game.coverArt!);
        return { game, score: other ? similarity(sig, other) : 0 };
      })
  );
  return scored.sort((a, b) => b.score - a.score);
}
