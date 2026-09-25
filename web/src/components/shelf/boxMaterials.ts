import * as THREE from "three";
import type { BoxArt } from "./boxTextures";

// Faint paper fibre for the lid's roughness, so the gloss breaks up like
// printed card rather than looking like plastic. Shared by every box.
let paperGrainTexture: THREE.Texture | null = null;
function paperGrain() {
  if (!paperGrainTexture) {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = 150 + Math.random() * 70;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    paperGrainTexture = new THREE.CanvasTexture(canvas);
    paperGrainTexture.wrapS = paperGrainTexture.wrapT = THREE.RepeatWrapping;
    paperGrainTexture.repeat.set(3, 3);
  }
  return paperGrainTexture;
}

// One unit box shared by every game and scaled per mesh. Faces are regrouped
// so each box is two draw calls (body + cover) instead of six.
export const BOX_GEOMETRY = (() => {
  const g = new THREE.BoxGeometry(1, 1, 1);
  const index = Array.from(g.index!.array);
  // BoxGeometry faces are 6 indices each, ordered +x, -x, +y, -y, +z, -z
  const face = (i: number) => index.slice(i * 6, i * 6 + 6);
  g.setIndex([...face(0), ...face(1), ...face(2), ...face(3), ...face(5), ...face(4)]);
  g.clearGroups();
  g.addGroup(0, 30, 0);
  g.addGroup(30, 6, 1);
  return g;
})();

/** Phones and tablets: fragment shading is the main cost there */
export const IS_TOUCH = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

// Body + lid materials for a box, matching the two groups of BOX_GEOMETRY.
// `glossy` adds the clearcoat sheen; it costs a second specular pass per pixel.
export function boxMaterials(art: BoxArt | null, glossy = true) {
  if (!glossy) {
    return [
      new THREE.MeshStandardMaterial({ color: art?.color ?? "#9a9a9a", roughness: 0.75 }),
      new THREE.MeshStandardMaterial({
        map: art?.cover ?? null,
        color: art ? "#fff" : "#9a9a9a",
        emissiveMap: art?.cover ?? null,
        emissive: art ? "#fff" : "#000",
        emissiveIntensity: 0.3,
        roughness: 0.45,
      }),
    ];
  }
  return [
    // Raw cardboard edges: matte
    new THREE.MeshStandardMaterial({ color: art?.color ?? "#9a9a9a", roughness: 0.75 }),
    // Printed, laminated lid. A little self-light keeps the art bright under
    // the shelf's shadows; the clearcoat over paper grain catches the light
    // rig as the box turns, like a real glossy box
    new THREE.MeshPhysicalMaterial({
      map: art?.cover ?? null,
      color: art ? "#fff" : "#9a9a9a",
      emissiveMap: art?.cover ?? null,
      emissive: art ? "#fff" : "#000",
      emissiveIntensity: 0.3,
      roughness: 0.5,
      roughnessMap: paperGrain(),
      clearcoat: 0.8,
      clearcoatRoughness: 0.22,
      envMapIntensity: 1.6,
    }),
  ];
}
