import * as THREE from "three";
import { W, H, computeWood, type WoodKind } from "./woodPixels";

export type WoodSet = { map: THREE.Texture; bumpMap: THREE.Texture };

// One set per theme and surface, built in a worker (see woodWorker). Each is a
// promise the shelf waits on; they start building as soon as this module loads.
const cache = new Map<string, Promise<WoodSet>>();
const waiting = new Map<string, (pixels: { color: Uint8ClampedArray; bump: Uint8ClampedArray }) => void>();

let worker: Worker | null | undefined;
function getWorker() {
  if (worker === undefined) {
    try {
      worker = new Worker(new URL("./woodWorker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (e: MessageEvent<{ key: string; color: Uint8ClampedArray; bump: Uint8ClampedArray }>) => {
        waiting.get(e.data.key)?.(e.data);
        waiting.delete(e.data.key);
      };
      // If the worker can't run, finish whatever it was given here instead
      worker.onerror = () => {
        worker = null;
        for (const [key, resolve] of waiting) {
          const [kind, seed, seams] = key.split(":");
          resolve(computeWood(kind as WoodKind, Number(seed), Number(seams)));
        }
        waiting.clear();
      };
    } catch {
      worker = null; // No module workers: build on the main thread, as before
    }
  }
  return worker;
}

function toTexture(pixels: Uint8ClampedArray) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  img.data.set(pixels);
  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

/** Shared wood textures; clone and set `repeat` per surface */
export function woodTextures(kind: WoodKind, seed: number, seams = 0): Promise<WoodSet> {
  const key = `${kind}:${seed}:${seams}`;
  let set = cache.get(key);
  if (!set) {
    const w = getWorker();
    const pixels = w
      ? new Promise<{ color: Uint8ClampedArray; bump: Uint8ClampedArray }>((resolve) => {
          waiting.set(key, resolve);
          w.postMessage({ key, kind, seed, seams });
        })
      : Promise.resolve(computeWood(kind, seed, seams));
    set = pixels.then(({ color, bump }) => {
      const map = toTexture(color);
      map.colorSpace = THREE.SRGBColorSpace;
      return { map, bumpMap: toTexture(bump) };
    });
    cache.set(key, set);
  }
  return set;
}

const themes = new Map<boolean, Promise<[WoodSet, WoodSet]>>();
const ready = new Map<boolean, [WoodSet, WoodSet]>();

/** The boards and back panel for a theme (the same promise each time, for use()) */
export function shelfWood(dark: boolean) {
  let set = themes.get(dark);
  if (!set) {
    set = Promise.all([
      woodTextures(dark ? "walnut" : "oak", 7),
      woodTextures(dark ? "walnutPanel" : "oakPanel", 11, 2),
    ]);
    set.then((wood) => ready.set(dark, wood));
    themes.set(dark, set);
  }
  return set;
}

/** A theme's wood if it's already built, so switching themes needn't suspend */
export function shelfWoodIfReady(dark: boolean) {
  return ready.get(dark);
}

// Start both themes now (current one first), so the shelf rarely waits and a
// theme switch finds its wood ready
if (typeof document !== "undefined") {
  const dark = document.documentElement.classList.contains("dark");
  void shelfWood(dark);
  void shelfWood(!dark);
}

/** A copy of a wood set tiled for a surface `lengthIn` × `acrossIn` inches */
export function tiledWood(set: WoodSet, lengthIn: number, acrossIn: number, rotate = false): WoodSet {
  const tile = (t: THREE.Texture) => {
    const c = t.clone();
    c.repeat.set(lengthIn / 48, acrossIn / 12);
    if (rotate) {
      c.center.set(0.5, 0.5);
      c.rotation = Math.PI / 2;
    }
    c.needsUpdate = true;
    return c;
  };
  return { map: tile(set.map), bumpMap: tile(set.bumpMap) };
}
