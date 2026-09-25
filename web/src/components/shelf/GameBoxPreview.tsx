import { useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import type { Game } from "@/models/Game";
import { shelfBoxFor } from "@/lib/boxDimensions";
import { traditionalKind } from "@/lib/traditionalGames";
import { useCoverAspect } from "@/hooks/useCoverAspects";
import { requestBoxArt, type BoxArt } from "./boxTextures";
import { BOX_GEOMETRY, boxMaterials } from "./boxMaterials";

// Box in inches → scene units, fitted to a 1-unit tall frame
function Box({ game }: { game: Game }) {
  const aspect = useCoverAspect(game.coverArt);
  const box = shelfBoxFor(game, aspect);
  const invalidate = useThree((s) => s.invalidate);
  const [art, setArt] = useState<BoxArt | null>(null);
  const { width, height, depth } = box;

  useEffect(() => {
    const cancel = requestBoxArt(game.title, game.coverArt, { width, height, depth }, traditionalKind(game.title), (a) => {
      setArt(a);
      invalidate();
    });
    return () => {
      cancel();
      setArt(null);
    };
  }, [game.title, game.coverArt, width, height, depth, invalidate]);

  const materials = useMemo(() => boxMaterials(art), [art]);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  // Normalise so the box's larger face side is 1 unit, whatever its real size
  const scale = 1 / Math.max(width, height);
  return (
    // Turned a little to show the spine and lid edge, like a product shot
    <group rotation={[0.18, -0.55, 0.04]}>
      <mesh geometry={BOX_GEOMETRY} material={materials} scale={[width * scale, height * scale, depth * scale]} />
    </group>
  );
}

/** A single game's box in 3D, slightly tilted; used as the game page's hero */
export function GameBoxPreview({ game, size = 180 }: { game: Game; size?: number }) {
  return (
    <div style={{ width: size, height: size }}>
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ fov: 25, position: [0, 0, 3.3] }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NeutralToneMapping;
        }}
      >
        <ambientLight intensity={0.35} />
        <directionalLight position={[-2, 3, 4]} intensity={2} />
        <Environment resolution={128} environmentIntensity={0.6}>
          <Lightformer intensity={3} position={[0, 4, 4]} scale={[10, 2, 1]} />
          <Lightformer intensity={1} position={[-5, 1, 2]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} />
          <Lightformer intensity={1} position={[5, 1, 2]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} />
        </Environment>
        <Box game={game} />
      </Canvas>
    </div>
  );
}
