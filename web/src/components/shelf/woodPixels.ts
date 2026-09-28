// Procedural wood: long wavy grain lines, growth rings, fine pores and the odd
// knot. Pure pixel maths (no DOM), so it can run in a worker. Tiles seamlessly
// along the grain (u), so planks of any length just repeat it.

export const W = 1024; // along the grain; one tile ≈ 48 inches of board
export const H = 256; // across the grain

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Value noise that wraps every `period` cells in x, so the texture tiles
function makeNoise(seed: number, period: number) {
  const rand = mulberry32(seed);
  const size = 256;
  const grid = new Float32Array(size * size).map(() => rand());
  const at = (x: number, y: number) => grid[((((y % size) + size) % size) * size) + ((((x % period) + period) % period) % size)];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const tx = smooth(x - xi);
    const ty = smooth(y - yi);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * tx;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * tx;
    return a + (b - a) * ty;
  };
}

export type Tone = { light: [number, number, number]; dark: [number, number, number] };

export const TONES: Record<"oak" | "walnut" | "oakPanel" | "walnutPanel", Tone> = {
  oak: { light: [214, 170, 118], dark: [158, 108, 62] },
  walnut: { light: [112, 74, 48], dark: [58, 36, 22] },
  oakPanel: { light: [196, 152, 104], dark: [140, 94, 54] },
  walnutPanel: { light: [84, 56, 38], dark: [40, 25, 16] },
};

export type WoodKind = keyof typeof TONES;

/** RGBA pixels for the wood colour map and its greyscale bump map */
export function computeWood(kind: WoodKind, seed: number, seams: number) {
  const tone = TONES[kind];
  const img = { data: new Uint8ClampedArray(W * H * 4) };
  const bump = new Uint8ClampedArray(W * H);

  // Periods chosen so each octave wraps exactly at the tile edge
  const warp = makeNoise(seed, 4);
  const rings = makeNoise(seed + 1, 8);
  const pores = makeNoise(seed + 2, 256);
  const rand = mulberry32(seed + 3);
  const knots = Array.from({ length: 2 }, () => ({ x: rand() * W, y: rand() * H, r: 10 + rand() * 14 }));

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      // Wavy offset across the grain, stronger near knots
      let offset = (warp(u * 4, v * 3) - 0.5) * 0.35 + (rings(u * 8, v * 6) - 0.5) * 0.08;
      for (const k of knots) {
        const dx = (((x - k.x + W * 1.5) % W) - W / 2) / (k.r * 4);
        const dy = (y - k.y) / k.r;
        const d = dx * dx + dy * dy;
        offset += Math.exp(-d) * 0.25 * Math.sign(dy || 1);
      }
      // Growth rings: bands across the board that the warp bends into grain lines
      const band = (v + offset) * 14;
      const ring = Math.pow(Math.abs(Math.sin(band * Math.PI)), 0.6);
      const fine = pores(u * 256, v * 64);
      let t = 0.35 + ring * 0.45 + (fine - 0.5) * 0.25;
      for (const k of knots) {
        const dx = (((x - k.x + W * 1.5) % W) - W / 2) / (k.r * 1.6);
        const dy = (y - k.y) / (k.r * 0.8);
        t -= Math.exp(-(dx * dx + dy * dy) * 1.5) * 0.55;
      }
      // Board seams for panelling
      if (seams > 0) {
        const s = (v * seams) % 1;
        if (s < 0.012 || s > 0.988) t -= 0.5;
      }
      t = Math.min(1, Math.max(0, t));
      const i = (y * W + x) * 4;
      img.data[i] = tone.dark[0] + (tone.light[0] - tone.dark[0]) * t;
      img.data[i + 1] = tone.dark[1] + (tone.light[1] - tone.dark[1]) * t;
      img.data[i + 2] = tone.dark[2] + (tone.light[2] - tone.dark[2]) * t;
      img.data[i + 3] = 255;
      bump[y * W + x] = t * 255;
    }
  }

  const bumpRgba = new Uint8ClampedArray(W * H * 4);
  for (let p = 0; p < bump.length; p++) {
    bumpRgba[p * 4] = bumpRgba[p * 4 + 1] = bumpRgba[p * 4 + 2] = bump[p];
    bumpRgba[p * 4 + 3] = 255;
  }
  return { color: img.data, bump: bumpRgba };
}

