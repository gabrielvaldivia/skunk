import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { easing } from "maath";
import * as THREE from "three";
import type { Game } from "@/models/Game";
import { shelfBoxFor, type ShelfBox } from "@/lib/boxDimensions";
import { requestBoxArt, type BoxArt } from "./boxTextures";
import { BOX_GEOMETRY, IS_TOUCH, boxMaterials } from "./boxMaterials";
import { tiledWood, woodTextures, type WoodSet } from "./woodTexture";
import { useCoverAspects } from "@/hooks/useCoverAspects";
import { traditionalKind } from "@/lib/traditionalGames";

// Scene units are inches scaled down, so real box sizes carry straight through
const S = 0.1;
const GAP = 1.2; // between boxes, inches
const PLANK = 0.75; // shelf board thickness, inches
const CLEARANCE = 1.5; // headroom above the tallest box on a shelf, inches
const SHELF_DEPTH = 10;
const HEADER_ROOM = 5; // space above the first shelf for the page header, inches

/** Pixels of the screen covered by UI; `margin` is how much room the box leaves around itself */
export type FocusArea = {
  top: number;
  right: number;
  bottom: number;
  margin: number;
  /** Room left beside the box, as a multiple of its width (default 1.5) */
  marginX?: number;
  /** Fade the shelf out to the page background, for a full-screen page look */
  solidBackdrop?: boolean;
  /**
   * Pixels a page on top has scrolled; the selected box moves up with it, so
   * box and page scroll as one. A ref, so scrolling doesn't re-render.
   */
  scroll?: { current: number };
  /** Extra turn for the selected box from swiping (radians), with its spin and whether a finger is on it */
  turn?: { current: BoxTurn };
};

export type BoxTurn = { angle: number; velocity: number; dragging: boolean };
const NO_FOCUS_INSETS: FocusArea = { top: 0, right: 0, bottom: 0, margin: 1.6 };

type Placed = { game: Game; box: ShelfBox; x: number; y: number };

// Set when the current pointer gesture was a scroll-drag, so it doesn't also select a box
const DragContext = createContext<{ current: boolean }>({ current: false });

// Pack face-out boxes left-to-right into shelves of a fixed width. Full rows
// spread across the whole shelf so they line up; each sits on its own plank.
function layout(games: Game[], shelfWidth: number, aspects: Map<string, number>) {
  type Row = { items: { game: Game; box: ShelfBox }[]; used: number; height: number };
  const rows: Row[] = [];
  let current: Row = { items: [], used: 0, height: 0 };
  for (const game of games) {
    const box = shelfBoxFor(game, aspects.get(game.id));
    const gap = current.items.length ? GAP : 0;
    if (current.items.length && current.used + gap + box.width > shelfWidth) {
      rows.push(current);
      current = { items: [], used: 0, height: 0 };
    }
    current.used += (current.items.length ? GAP : 0) + box.width;
    current.items.push({ game, box });
    current.height = Math.max(current.height, box.height);
  }
  if (current.items.length) rows.push(current);

  const placed: Placed[] = [];
  const planks: number[] = [];
  let y = 0;
  rows.forEach((row, i) => {
    y -= row.height + CLEARANCE;
    planks.push(y);
    const isLast = i === rows.length - 1;
    const gap = isLast || row.items.length < 2 ? GAP : GAP + (shelfWidth - row.used) / (row.items.length - 1);
    let x = -(isLast ? row.used : shelfWidth) / 2;
    for (const item of row.items) {
      placed.push({ ...item, x: x + item.box.width / 2, y: y + item.box.height / 2 });
      x += item.box.width + gap;
    }
    y -= PLANK;
  });
  return { placed, planks, totalHeight: -y };
}

// Covers only exist while a box is near the viewport, so memory stays flat
// no matter how many games there are
// Covers only exist while a box is near the viewport, so memory stays flat
// no matter how many games there are
function useBoxArt(game: Game, box: ShelfBox, near: boolean) {
  const [art, setArt] = useState<BoxArt | null>(null);
  const invalidate = useThree((s) => s.invalidate);
  // Layout makes new box objects on every pass (e.g. each search keystroke);
  // key on the numbers so textures are only rebuilt when the size changes
  const { width, height, depth } = box;
  useEffect(() => {
    if (!near) return;
    const kind = traditionalKind(game.title);
    const cancel = requestBoxArt(game.title, game.coverArt, { width, height, depth }, kind, (a) => {
      setArt(a);
      invalidate();
    });
    return () => {
      cancel();
      setArt(null);
    };
  }, [near, game.title, game.coverArt, width, height, depth, invalidate]);
  return art;
}

// Swiped round and let go: coast on the flick, then settle facing front or
// back. Advances the page's shared turn state in place; returns the angle.
function coastTurn(turn: BoxTurn, d: number) {
  if (!turn.dragging) {
    turn.angle += turn.velocity * d;
    turn.velocity *= Math.exp(-d * 3);
    if (Math.abs(turn.velocity) < 1.5) {
      const rest = Math.round(turn.angle / Math.PI) * Math.PI;
      turn.angle += (rest - turn.angle) * (1 - Math.exp(-d * 6));
      turn.velocity *= Math.exp(-d * 6);
    }
  }
  return turn.angle;
}

function GameBox({
  placed,
  viewH,
  focus,
  selected,
  anySelected,
  onSelect,
}: {
  placed: Placed;
  viewH: number;
  focus: FocusArea;
  selected: boolean;
  anySelected: boolean;
  onSelect: (id: string | null) => void;
}) {
  const { game, box } = placed;
  const [near, setNear] = useState(false);
  const art = useBoxArt(game, box, near || selected);
  const group = useRef<THREE.Group>(null);
  const scrollGroup = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const invalidate = useThree((s) => s.invalidate);
  const size = useThree((s) => s.size);
  const dragged = useContext(DragContext);

  // On touch devices, only the box you pick up gets the glossy lid
  const glossy = !IS_TOUCH || selected;
  const materials = useMemo(() => boxMaterials(art, glossy), [art, glossy]);

  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  const home = useMemo(
    () => new THREE.Vector3(placed.x * S, placed.y * S, (-SHELF_DEPTH / 2 + box.depth / 2 + 1) * S),
    [placed.x, placed.y, box.depth]
  );
  const scratch = useRef({ target: new THREE.Vector3(), rot: new THREE.Euler() });
  const scale = useMemo(
    () => new THREE.Vector3(box.width * S, box.height * S, box.depth * S),
    [box.width, box.height, box.depth]
  );

  // Dragging the selected box: it follows the pointer, and a flick (or a long
  // drag) throws it back onto the shelf
  const drag = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    offset: new THREE.Vector3(),
    worldPerPx: 0,
    samples: [] as { t: number; x: number; y: number }[],
    // Tumble left over from a throw, decaying as the box flies home
    spin: new THREE.Vector2(),
  });

  useFrame((state, dt) => {
    const { target, rot } = scratch.current;
    const g = group.current;
    if (!g) return;
    // Load when within about a screen of the camera; unload well past that
    const dy = Math.abs(state.camera.position.y - home.y);
    if (!near && dy < viewH * 1.3) setNear(true);
    else if (near && dy > viewH * 2.5) setNear(false);
    const d = Math.min(dt, 0.05);
    const active = hovered && !anySelected;
    if (selected) {
      // Float in front of the camera and slowly turn to show off the box
      const cam = state.camera as THREE.PerspectiveCamera;
      const fitHeight = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      // Centre in the space left clear of any panel or sheet
      const freeWidth = Math.max(1, size.width - focus.right);
      const freeHeight = Math.max(1, size.height - focus.bottom - focus.top);
      const aspect = freeWidth / freeHeight;
      const dist = Math.max(
        (box.height * S * focus.margin) / fitHeight / (freeHeight / size.height),
        (box.width * S * (focus.marginX ?? 1.5)) / (fitHeight * aspect) / (freeHeight / size.height)
      );
      const worldPerPx = (dist * fitHeight) / size.height;
      drag.current.worldPerPx = worldPerPx;
      target.set(
        cam.position.x - (focus.right / 2) * worldPerPx,
        cam.position.y + ((focus.bottom - focus.top) / 2) * worldPerPx,
        cam.position.z - dist
      );
      target.add(drag.current.offset);
      const t = state.clock.elapsedTime;
      if (drag.current.active) {
        // Lean into the drag, like holding a real box by its middle
        const o = drag.current.offset;
        rot.set(-o.y * 0.9, o.x * 0.9, -o.x * 0.5);
      } else {
        rot.set(0.08 + Math.sin(t * 0.8) * 0.05, Math.sin(t * 0.5) * 0.45, 0);
      }
      // Plus however far it's been swiped round
      if (focus.turn) rot.y += coastTurn(focus.turn.current, d);
    } else {
      // Put back after being swiped round a few times: drop whole turns so it
      // doesn't unwind them all on the way home
      if (Math.abs(g.rotation.y) > Math.PI) {
        g.rotation.y = THREE.MathUtils.euclideanModulo(g.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
      }
      target.copy(home);
      if (active) target.z += box.depth * S * 0.8 + 0.1;
      rot.set(active ? -0.06 : 0, active ? 0.18 : 0, 0);
      const spin = drag.current.spin;
      if (spin.lengthSq() > 1e-4) {
        rot.x += spin.y;
        rot.y += spin.x;
        spin.multiplyScalar(Math.exp(-d * 6));
      }
    }
    const sg = scrollGroup.current;
    if (sg) {
      if (selected) sg.position.y = (focus.scroll?.current ?? 0) * drag.current.worldPerPx;
      // Closing: ease the leftover scroll offset out as the box flies home
      else if (sg.position.y !== 0 && !easing.damp(sg.position, "y", 0, 0.08, d)) sg.position.y = 0;
    }
    const following = drag.current.active || !!focus.turn?.current.dragging;
    const moved = easing.damp3(g.position, target, following ? 0.03 : 0.08, d);
    const turned = easing.dampE(g.rotation, rot, following ? 0.06 : 0.1, d);
    // The selected box idles, so keep it rendering; everything else settles
    if (moved || turned || selected || (sg && sg.position.y !== 0) || drag.current.spin.lengthSq() > 1e-4) invalidate();
  });

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!selected) return;
    e.stopPropagation();
    try {
      // Keep receiving moves when the pointer outruns the box
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      // Not an active pointer (synthetic events); dragging still works
    }
    const dr = drag.current;
    dr.active = true;
    dr.moved = false;
    dr.startX = e.clientX;
    dr.startY = e.clientY;
    dr.samples = [{ t: performance.now(), x: e.clientX, y: e.clientY }];
    invalidate();
  };
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const dr = drag.current;
    if (!dr.active) return;
    e.stopPropagation();
    const dx = e.clientX - dr.startX;
    const dy = e.clientY - dr.startY;
    if (Math.hypot(dx, dy) > 6) dr.moved = true;
    dr.offset.set(dx * dr.worldPerPx, -dy * dr.worldPerPx, 0);
    const now = performance.now();
    dr.samples.push({ t: now, x: e.clientX, y: e.clientY });
    // Keep ~100ms of history for the release velocity
    while (dr.samples.length > 2 && now - dr.samples[0].t > 100) dr.samples.shift();
    invalidate();
  };
  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    const dr = drag.current;
    if (!dr.active) return;
    e.stopPropagation();
    dr.active = false;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      // Wasn't captured
    }
    const first = dr.samples[0];
    const last = dr.samples[dr.samples.length - 1];
    const ms = Math.max(1, last.t - first.t);
    const vx = (last.x - first.x) / ms; // px per ms
    const vy = (last.y - first.y) / ms;
    const speed = Math.hypot(vx, vy);
    const distance = Math.hypot(last.x - dr.startX, last.y - dr.startY);
    const thrown = dr.moved && (speed > 0.6 || distance > Math.min(size.width, size.height) * 0.3);
    dr.offset.set(0, 0, 0);
    if (thrown) {
      // Tumble in the direction of the flick as it flies back to its slot
      dr.spin.set(THREE.MathUtils.clamp(vx * 1.2, -3, 3), THREE.MathUtils.clamp(vy * 1.2, -3, 3));
      onSelect(null);
    }
    invalidate();
  };

  const onPointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    if (!anySelected || selected) document.body.style.cursor = "pointer";
    invalidate();
  };
  const onPointerOut = () => {
    setHovered(false);
    document.body.style.cursor = "";
    invalidate();
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // A drag of the selected box ends in pointerup, not a tap
    if (dragged.current || drag.current.moved) {
      drag.current.moved = false;
      return;
    }
    onSelect(selected ? null : game.id);
    invalidate();
  };

  return (
    <>
    {/* Outer group carries the page scroll offset, applied directly (no
        easing) so the box stays glued to the content scrolling with it */}
    <group ref={scrollGroup}>
    <group ref={group} position={home}>
      <mesh
        geometry={BOX_GEOMETRY}
        material={materials}
        scale={scale}
        // Casts onto the shelf, but covers stay unshaded so the art reads clearly
        castShadow
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClick}
      />
    </group>
    </group>
    </>
  );
}

function woodMaterial(set: WoodSet, lengthIn: number, acrossIn: number, rotate = false, roughness = 0.62) {
  const { map, bumpMap } = tiledWood(set, lengthIn, acrossIn, rotate);
  return new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 0.6, roughness });
}

function Shelves({ planks, width, dark, viewH }: { planks: number[]; width: number; dark: boolean; viewH: number }) {
  // Run the case well past the top so overscroll never shows the page behind it
  const top = PLANK + CLEARANCE + HEADER_ROOM + 30;
  // …and a full screen past the bottom, so short shelves (a search, a small
  // My Games) still fill tall phone screens
  const needed = top - ((planks.length ? planks[planks.length - 1] - PLANK : 0) - Math.max(60, (viewH / S) * 1.2));
  // One fixed height, whatever the number of shelves, so the wood grain stays
  // put when switching My Games / All Games or searching (textures are tiled
  // from the panel's edge, so a different height would shift them)
  const h = Math.max(needed, 6000);
  const bottom = top - h;
  const outer = width + 4;

  const materials = useMemo(() => {
    const boards = woodTextures(dark ? "walnut" : "oak", 7);
    const panel = woodTextures(dark ? "walnutPanel" : "oakPanel", 11, 2);
    // BoxGeometry faces: +x, -x, +y, -y, +z, -z. Each face is tiled for its own
    // size so the grain keeps real-world scale everywhere.
    const plankEnd = woodMaterial(boards, SHELF_DEPTH, PLANK);
    const plankTop = woodMaterial(boards, outer, SHELF_DEPTH);
    const plankFront = woodMaterial(boards, outer, PLANK * 3);
    const wallSide = woodMaterial(boards, h, SHELF_DEPTH, true);
    const wallFront = woodMaterial(boards, h, PLANK * 3, true);
    const wallEnd = woodMaterial(boards, SHELF_DEPTH, PLANK);
    const back = woodMaterial(panel, outer, h, false, 0.75);
    return {
      plank: [plankEnd, plankEnd, plankTop, plankTop, plankFront, plankFront],
      wall: [wallSide, wallSide, wallEnd, wallEnd, wallFront, wallFront],
      back,
      all: [plankEnd, plankTop, plankFront, wallSide, wallFront, wallEnd, back],
    };
  }, [dark, outer, h]);

  useEffect(
    () => () =>
      materials.all.forEach((m) => {
        m.map?.dispose();
        m.bumpMap?.dispose();
        m.dispose();
      }),
    [materials]
  );

  return (
    <group>
      {planks.map((y) => (
        <mesh key={y} position={[0, (y - PLANK / 2) * S, 0]} material={materials.plank} castShadow receiveShadow>
          <boxGeometry args={[outer * S, PLANK * S, SHELF_DEPTH * S]} />
        </mesh>
      ))}
      <mesh position={[0, (bottom + h / 2) * S, (-SHELF_DEPTH / 2 - 0.25) * S]} material={materials.back} receiveShadow>
        <boxGeometry args={[outer * S, h * S, 0.5 * S]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (outer / 2 + 0.375) * S, (bottom + h / 2) * S, 0]} material={materials.wall} castShadow receiveShadow>
          <boxGeometry args={[0.75 * S, h * S, SHELF_DEPTH * S]} />
        </mesh>
      ))}
    </group>
  );
}

// Vertical scrolling via wheel and drag, driving the camera rather than the page
function CameraRig({
  totalHeight,
  fitDist,
  viewH,
  enabled,
  resetKey,
}: {
  totalHeight: number;
  fitDist: number;
  viewH: number;
  enabled: boolean;
  resetKey?: string;
}) {
  const { camera, gl, size, invalidate } = useThree();
  const dragged = useContext(DragContext);
  const scrollY = useRef(0); // world units scrolled down from the top
  const fling = useRef(0); // momentum after a flick, world units per second
  const touching = useRef(false); // a finger is dragging the shelf
  const target = useRef(new THREE.Vector3());

  const top = PLANK + CLEARANCE + HEADER_ROOM;
  const startY = top * S - viewH / 2;
  const maxScroll = Math.max(0, (top + totalHeight + 8) * S - viewH);
  const pxToWorld = viewH / size.height;

  // A new search result set starts from the top of the shelf
  useEffect(() => {
    scrollY.current = 0;
    invalidate();
  }, [resetKey, invalidate]);

  useEffect(() => {
    const el = gl.domElement;
    const clamp = (v: number) => THREE.MathUtils.clamp(v, 0, maxScroll);
    const onWheel = (e: WheelEvent) => {
      if (!enabled) return;
      e.preventDefault();
      scrollY.current = clamp(scrollY.current + e.deltaY * pxToWorld);
      invalidate();
    };
    let downY = 0;
    let downScroll = 0;
    let down = false;
    let samples: { t: number; y: number }[] = [];
    const onDown = (e: PointerEvent) => {
      down = true;
      dragged.current = false;
      downY = e.clientY;
      downScroll = scrollY.current;
      // Catching a moving shelf stops it, like a native scroll view
      fling.current = 0;
      samples = [{ t: performance.now(), y: e.clientY }];
    };
    const onMove = (e: PointerEvent) => {
      if (!down || !enabled) return;
      const dy = e.clientY - downY;
      if (Math.abs(dy) > 6) dragged.current = true;
      if (dragged.current) {
        touching.current = true;
        scrollY.current = clamp(downScroll - dy * pxToWorld);
        const now = performance.now();
        samples.push({ t: now, y: e.clientY });
        while (samples.length > 2 && now - samples[0].t > 80) samples.shift();
        invalidate();
      }
    };
    const onUp = () => {
      if (down && touching.current && samples.length > 1) {
        // Carry the release speed on as momentum (world units per second)
        const first = samples[0];
        const last = samples[samples.length - 1];
        const dt = Math.max(1, last.t - first.t);
        if (performance.now() - last.t < 60) fling.current = (-(last.y - first.y) / dt) * 1000 * pxToWorld;
        invalidate();
      }
      down = false;
      touching.current = false;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [gl, maxScroll, pxToWorld, enabled, invalidate, dragged]);

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    // Momentum from a fling, slowing like native scrolling
    if (fling.current !== 0) {
      scrollY.current += fling.current * d;
      fling.current *= Math.exp(-d * 2.2);
      if (scrollY.current < 0 || scrollY.current > maxScroll || Math.abs(fling.current) < 0.02) fling.current = 0;
      scrollY.current = THREE.MathUtils.clamp(scrollY.current, 0, maxScroll);
      invalidate();
    }
    scrollY.current = Math.min(scrollY.current, maxScroll);
    target.current.set(0, startY - scrollY.current, fitDist + (SHELF_DEPTH / 2) * S);
    // Distance only changes on first load or a resize: jump there instead of
    // flying in, and keep easing for scrolling alone
    if (Math.abs(camera.position.z - target.current.z) > 0.001) {
      camera.position.copy(target.current);
      invalidate();
      return;
    }
    // Fingers and flings track tightly; the wheel keeps a little smoothing
    const smooth = touching.current || fling.current !== 0 ? 0.02 : 0.12;
    if (easing.damp3(camera.position, target.current, smooth, d)) invalidate();
  });
  return null;
}

// Dims the shelf behind a selected box and catches taps outside it, so the
// first tap dismisses instead of selecting another box
// Page background (--background), for a scrim that turns the shelf into a plain page
const PAGE_BG = { light: "hsl(0, 0%, 100%)", dark: "hsl(240, 6%, 4.5%)" };

function Scrim({ active, dark, solid, onDismiss }: { active: boolean; dark: boolean; solid: boolean; onDismiss: () => void }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(
    // Not tone-mapped, so a solid scrim matches the page colour exactly
    () => new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    []
  );
  useEffect(() => {
    material.color.set(solid ? PAGE_BG[dark ? "dark" : "light"] : "#000");
  }, [material, solid, dark]);
  useEffect(() => () => material.dispose(), [material]);
  const invalidate = useThree((s) => s.invalidate);

  useFrame((state, dt) => {
    const m = mesh.current;
    if (!m) return;
    // Just in front of the shelf, following the camera; the selected box floats in front of it
    m.position.set(state.camera.position.x, state.camera.position.y, (SHELF_DEPTH / 2 + 0.5) * S);
    const target = !active ? 0 : solid ? 1 : dark ? 0.55 : 0.4;
    const fading = easing.damp(material, "opacity", target, 0.08, Math.min(dt, 0.05));
    m.visible = material.opacity > 0.001;
    if (fading) invalidate();
  });

  return (
    <mesh
      ref={mesh}
      material={material}
      renderOrder={1}
      visible={false}
      onClick={
        active
          ? (e) => {
              e.stopPropagation();
              onDismiss();
            }
          : undefined
      }
      onPointerOver={active ? (e) => e.stopPropagation() : undefined}
    >
      <planeGeometry args={[200, 200]} />
    </mesh>
  );
}

// Key light from above-left-front that follows the camera, so its shadow map
// only has to cover what's on screen: planks shade the wall below them and
// boxes cast onto the back panel
function KeyLight({ width, viewH, dark }: { width: number; viewH: number; dark: boolean }) {
  const light = useRef<THREE.DirectionalLight>(null);
  useFrame((state) => {
    const l = light.current;
    if (!l) return;
    const { x, y } = state.camera.position;
    l.position.set(x - 0.5, y + 2.4, 2.6);
    l.target.position.set(x, y, 0);
    l.target.updateMatrixWorld();
  });
  const halfW = (width * S) / 2 + 1;
  const halfH = viewH / 2 + 1;
  return (
    <directionalLight
      ref={light}
      intensity={dark ? 1.6 : 2.2}
      castShadow
      shadow-mapSize={IS_TOUCH ? [1024, 1024] : [2048, 2048]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.02}
      shadow-radius={6}
      shadow-camera-left={-halfW}
      shadow-camera-right={halfW}
      shadow-camera-top={halfH}
      shadow-camera-bottom={-halfH}
      shadow-camera-near={0.1}
      shadow-camera-far={8}
    />
  );
}

function ShelfScene({
  games,
  selectedId,
  onSelect,
  dark,
  resetKey,
  focus,
}: {
  games: Game[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  dark: boolean;
  resetKey?: string;
  focus: FocusArea;
}) {
  const size = useThree((s) => s.size);
  const cam = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const aspect = size.width / size.height;
  // About three square boxes across on a phone, more on wider screens
  const shelfWidth = THREE.MathUtils.clamp(aspect * 50, 38, 120);
  const aspects = useCoverAspects(games);
  const { placed, planks, totalHeight } = useMemo(
    () => layout(aspects ? games : [], shelfWidth, aspects ?? new Map()),
    [games, shelfWidth, aspects]
  );

  const halfFov = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  // Distance at which the whole shelf width fits the viewport
  const fitDist = ((shelfWidth + 6) * S) / 2 / halfFov / aspect;
  const viewH = 2 * fitDist * halfFov;

  return (
    <>
      <CameraRig totalHeight={totalHeight} fitDist={fitDist} viewH={viewH} enabled={!selectedId} resetKey={resetKey} />
      <KeyLight width={shelfWidth + 6} viewH={viewH} dark={dark} />
      <Shelves planks={planks} width={shelfWidth} dark={dark} viewH={viewH} />
      <Scrim active={selectedId !== null} dark={dark} solid={!!focus.solidBackdrop} onDismiss={() => onSelect(null)} />
      {placed.map((p) => (
        <GameBox
          key={p.game.id}
          placed={p}
          viewH={viewH}
          focus={focus}
          selected={p.game.id === selectedId}
          anySelected={selectedId !== null}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

export function GameShelf({
  games,
  selectedId,
  onSelect,
  dark,
  resetKey,
  focus = NO_FOCUS_INSETS,
}: {
  games: Game[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  dark: boolean;
  /** Changing this scrolls back to the top, e.g. when the search query changes */
  resetKey?: string;
  /** Screen area covered by a panel or sheet; the selected box floats in the rest */
  focus?: FocusArea;
}) {
  const dragged = useRef(false);
  return (
    <DragContext.Provider value={dragged}>
      <Canvas
        frameloop="demand"
        shadows="soft"
        // Phones have 3× screens; 1.5× looks nearly the same at half the pixels
        dpr={IS_TOUCH ? [1, 1.5] : [1, 1.75]}
        camera={{ fov: 30, near: 0.05, far: 100, position: [0, 0, 10] }}
        gl={{ antialias: true, alpha: true }}
        // Neutral keeps cover art colours true; R3F's default ACES washes them out
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NeutralToneMapping;
        }}
        style={{ touchAction: "none" }}
        onPointerMissed={() => {
          if (!dragged.current) onSelect(null);
        }}
      >
        <ambientLight intensity={dark ? 0.12 : 0.18} />
        {/* Local light rig instead of a fetched HDR, so there's no network dependency.
            Kept dim: it's fill and reflections, the key light does the shading */}
        <Environment resolution={256} environmentIntensity={0.55}>
          <Lightformer intensity={3} position={[0, 4, 4]} scale={[10, 2, 1]} />
          <Lightformer intensity={1} position={[-5, 1, 2]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} />
          <Lightformer intensity={1} position={[5, 1, 2]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} />
        </Environment>
        <ShelfScene games={games} selectedId={selectedId} onSelect={onSelect} dark={dark} resetKey={resetKey} focus={focus} />
      </Canvas>
    </DragContext.Provider>
  );
}
