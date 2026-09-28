import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Game } from "@/models/Game";
import { shelfBoxFor } from "@/lib/boxDimensions";
import { traditionalKind } from "@/lib/traditionalGames";
import { readCoverAspect } from "@/hooks/useCoverAspects";
import { requestBoxArt } from "./boxTextures";
import { BOX_GEOMETRY, boxMaterials } from "./boxMaterials";

// Small tilted boxes for lists, e.g. beside match avatars. A live canvas per
// row would run out of WebGL contexts, so one shared renderer draws each game
// once and the picture is cached as an image.

const SNAPSHOT_PX = 96;

let stage: {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  group: THREE.Group;
} | null = null;

function getStage() {
  if (stage) return stage;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(SNAPSHOT_PX, SNAPSHOT_PX, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;
  pmrem.dispose();
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(-2, 3, 4);
  scene.add(light);
  // Same turn as the game page's hero box, framed tighter to fill small sizes
  const camera = new THREE.PerspectiveCamera(25, 1, 0.1, 20);
  camera.position.set(0, 0, 2.6);
  const group = new THREE.Group();
  group.rotation.set(0.18, -0.55, 0.04);
  scene.add(group);
  stage = { renderer, scene, camera, group };
  return stage;
}

export async function renderSnapshot(game: Game): Promise<string | null> {
  const aspect = game.coverArt ? await readCoverAspect(game.coverArt) : undefined;
  const box = shelfBoxFor(game, aspect);
  const { width, height, depth } = box;
  const art = await new Promise<Parameters<typeof boxMaterials>[0] | undefined>((resolve) => {
    requestBoxArt(game.title, game.coverArt, { width, height, depth }, traditionalKind(game.title), resolve, () =>
      resolve(undefined)
    );
  });
  if (!art) return null;
  try {
    const { renderer, scene, camera, group } = getStage();
    const materials = boxMaterials(art);
    const scale = 1 / Math.max(width, height);
    const mesh = new THREE.Mesh(BOX_GEOMETRY, materials);
    mesh.scale.set(width * scale, height * scale, depth * scale);
    group.add(mesh);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL("image/png");
    group.remove(mesh);
    materials.forEach((m) => m.dispose());
    art?.cover.dispose();
    return url;
  } catch {
    return null;
  }
}

