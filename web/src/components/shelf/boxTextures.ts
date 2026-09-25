import * as THREE from "three";
import type { ShelfBox } from "@/lib/boxDimensions";
import type { TraditionalKind } from "@/lib/traditionalGames";

// Longest edge of a cover texture. 384px keeps ~20 on-screen covers well
// under mobile GPU memory limits while still reading sharply when zoomed.
const COVER_PX = 384;

export type BoxArt = {
  cover: THREE.Texture;
  /** Body colour for the sides, sampled from the cover */
  color: THREE.Color;
};

function hashHue(title: string) {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return h % 360;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Required for remote hosts that send CORS headers; harmless for data URLs
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => img.decode().then(() => resolve(img), () => resolve(img));
    img.onerror = reject;
    img.src = src;
  });
}

function faceCanvas(box: ShelfBox) {
  const aspect = box.width / box.height;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(aspect >= 1 ? COVER_PX : COVER_PX * aspect);
  canvas.height = Math.round(aspect >= 1 ? COVER_PX / aspect : COVER_PX);
  return canvas;
}

// Draw the cover downscaled and cropped to the box face, like object-fit: cover
function drawCover(img: HTMLImageElement, box: ShelfBox) {
  const canvas = faceCanvas(box);
  const ctx = canvas.getContext("2d")!;
  const faceAspect = canvas.width / canvas.height;
  const imgAspect = img.width / img.height;
  let sw = img.width;
  let sh = img.height;
  if (imgAspect > faceAspect) sw = img.height * faceAspect;
  else sh = img.width / faceAspect;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);

  // Average of the left edge strip — the edge that meets the side of the box
  const strip = ctx.getImageData(0, 0, Math.max(1, Math.round(canvas.width * 0.05)), canvas.height).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < strip.length; i += 4) {
    r += strip[i];
    g += strip[i + 1];
    b += strip[i + 2];
  }
  const n = strip.length / 4;
  const color = new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
  return { canvas, color };
}

function drawGeneratedCover(title: string, box: ShelfBox) {
  const canvas = faceCanvas(box);
  const { width: w, height: h } = canvas;
  const ctx = canvas.getContext("2d")!;
  const hue = hashHue(title);
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, `hsl(${hue} 55% 42%)`);
  grad.addColorStop(1, `hsl(${(hue + 40) % 360} 60% 24%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // A few loose shapes so generated covers don't all look like flat cards
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(w * (0.2 + 0.35 * i), h * (0.75 - 0.2 * i), Math.min(w, h) * (0.18 + 0.08 * i), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const words = title.toUpperCase().split(/\s+/);
  const size = Math.min(w / 7, (w * 1.4) / Math.max(...words.map((x) => x.length)));
  ctx.font = `800 ${size}px system-ui, sans-serif`;
  const top = h * 0.32 - ((words.length - 1) * size * 1.05) / 2;
  words.forEach((word, i) => ctx.fillText(word, w / 2, top + i * size * 1.05));

  const color = new THREE.Color().setHSL(hue / 360, 0.55, 0.3, THREE.SRGBColorSpace);
  return { canvas, color };
}

const SUITS = ["♠", "♥", "♦", "♣"];

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, weight = 800) {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  const w = ctx.measureText(text).width;
  if (w > maxWidth) ctx.font = `${weight} ${(size * maxWidth) / w}px system-ui, sans-serif`;
}

// Designed covers for traditional games, so a shelf of Hearts, Chess and
// Farkle reads as decks, boards and dice rather than a wall of gradients
function drawTraditionalCover(title: string, box: ShelfBox, kind: TraditionalKind) {
  const canvas = faceCanvas(box);
  const { width: w, height: h } = canvas;
  const ctx = canvas.getContext("2d")!;
  const hue = hashHue(title);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (kind === "cards") {
    // A card back: white border, patterned field, suit medallion
    const red = hue % 2 === 0;
    const ink = red ? "#b3202a" : "#1d3a8a";
    ctx.fillStyle = "#f7f3ea";
    ctx.fillRect(0, 0, w, h);
    const m = w * 0.07;
    ctx.fillStyle = ink;
    ctx.fillRect(m, m, w - 2 * m, h - 2 * m);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = Math.max(1, w * 0.008);
    const step = w * 0.09;
    ctx.save();
    ctx.beginPath();
    ctx.rect(m, m, w - 2 * m, h - 2 * m);
    ctx.clip();
    for (let x = -h; x < w + h; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h, h);
      ctx.moveTo(x + h, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = "#f7f3ea";
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.45, w * 0.3, w * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.font = `${w * 0.38}px system-ui, sans-serif`;
    ctx.fillText(SUITS[hue % 4], w / 2, h * 0.46);
    ctx.fillStyle = "#f7f3ea";
    fitText(ctx, title.toUpperCase(), w - 4 * m, w * 0.11);
    ctx.fillText(title.toUpperCase(), w / 2, h * 0.82);
    return { canvas, color: new THREE.Color(ink) };
  }

  if (kind === "board") {
    // A game board: dark field, a corner of the playing grid, title plate
    const field = `hsl(${hue} 30% 18%)`;
    ctx.fillStyle = field;
    ctx.fillRect(0, 0, w, h);
    const cell = w / 8;
    ctx.save();
    ctx.translate(w * 0.5, h * 0.62);
    ctx.rotate(-Math.PI / 12);
    for (let i = -6; i < 6; i++) {
      for (let j = -6; j < 6; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? `hsl(${hue} 35% 70%)` : `hsl(${hue} 40% 32%)`;
        ctx.fillRect(i * cell, j * cell, cell, cell);
      }
    }
    ctx.restore();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(0,0,0,0.85)");
    grad.addColorStop(0.45, "rgba(0,0,0,0.2)");
    grad.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f3e9d2";
    fitText(ctx, title.toUpperCase(), w * 0.84, w * 0.13);
    ctx.fillText(title.toUpperCase(), w / 2, h * 0.2);
    return { canvas, color: new THREE.Color().setHSL(hue / 360, 0.3, 0.14, THREE.SRGBColorSpace) };
  }

  if (kind === "dice") {
    // Felt with a few scattered dice
    ctx.fillStyle = `hsl(${140 + (hue % 40)} 45% 24%)`;
    ctx.fillRect(0, 0, w, h);
    const die = (x: number, y: number, size: number, angle: number, pips: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = "#f8f5ee";
      ctx.beginPath();
      ctx.roundRect(-size / 2, -size / 2, size, size, size * 0.18);
      ctx.fill();
      ctx.fillStyle = "#222";
      const p = size * 0.26;
      const spots: Record<number, [number, number][]> = {
        1: [[0, 0]],
        3: [[-p, -p], [0, 0], [p, p]],
        5: [[-p, -p], [p, -p], [0, 0], [-p, p], [p, p]],
        6: [[-p, -p], [p, -p], [-p, 0], [p, 0], [-p, p], [p, p]],
      };
      for (const [sx, sy] of spots[pips]) {
        ctx.beginPath();
        ctx.arc(sx, sy, size * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };
    die(w * 0.3, h * 0.62, w * 0.3, -0.3, 5);
    die(w * 0.68, h * 0.7, w * 0.26, 0.4, 3);
    die(w * 0.55, h * 0.45, w * 0.22, 0.15, 6);
    ctx.fillStyle = "#fff";
    fitText(ctx, title.toUpperCase(), w * 0.84, w * 0.13);
    ctx.fillText(title.toUpperCase(), w / 2, h * 0.18);
    return { canvas, color: new THREE.Color().setHSL((140 + (hue % 40)) / 360, 0.45, 0.18, THREE.SRGBColorSpace) };
  }

  return drawGeneratedCover(title, box);
}

async function buildBoxArt(
  title: string,
  coverUrl: string | undefined,
  box: ShelfBox,
  kind: TraditionalKind | undefined
): Promise<BoxArt> {
  let drawn: { canvas: HTMLCanvasElement; color: THREE.Color } | null = null;
  if (coverUrl) {
    try {
      drawn = drawCover(await loadImage(coverUrl), box);
    } catch {
      // Broken URL, or a host without CORS headers: fall through to a generated cover
    }
  }
  drawn ??= kind ? drawTraditionalCover(title, box, kind) : drawGeneratedCover(title, box);
  const cover = new THREE.CanvasTexture(drawn.canvas);
  cover.colorSpace = THREE.SRGBColorSpace;
  cover.anisotropy = 4;
  return { cover, color: drawn.color.multiplyScalar(0.8) };
}

// Building a cover means decoding an image and drawing a canvas, and the GPU
// upload follows on the next render. Doing dozens at once stalls scrolling, so
// run at most a couple per animation frame.
type Job = { run: () => Promise<void>; cancelled: boolean };
const queue: Job[] = [];
let active = 0;
// One at a time on phones, so building covers doesn't stutter a fling
const MAX_ACTIVE = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches ? 1 : 2;

function pump() {
  while (active < MAX_ACTIVE && queue.length) {
    const job = queue.shift()!;
    if (job.cancelled) continue;
    active++;
    job.run().finally(() => {
      active--;
      requestAnimationFrame(pump);
    });
  }
}

/** Queue a cover build. Returns a cancel function that also frees the texture. */
export function requestBoxArt(
  title: string,
  coverUrl: string | undefined,
  box: ShelfBox,
  kind: TraditionalKind | undefined,
  onReady: (art: BoxArt) => void
) {
  let art: BoxArt | null = null;
  const job: Job = {
    cancelled: false,
    run: async () => {
      const built = await buildBoxArt(title, coverUrl, box, kind);
      if (job.cancelled) {
        built.cover.dispose();
        return;
      }
      art = built;
      onReady(built);
    },
  };
  queue.push(job);
  requestAnimationFrame(pump);
  return () => {
    job.cancelled = true;
    art?.cover.dispose();
  };
}
