import { computeWood, type WoodKind } from "./woodPixels";

// Builds wood pixels off the main thread, so the shelf's first frame isn't
// held up by ~half a second of per-pixel maths on phones
self.onmessage = (e: MessageEvent<{ key: string; kind: WoodKind; seed: number; seams: number }>) => {
  const { key, kind, seed, seams } = e.data;
  const { color, bump } = computeWood(kind, seed, seams);
  self.postMessage({ key, color, bump }, { transfer: [color.buffer, bump.buffer] });
};
