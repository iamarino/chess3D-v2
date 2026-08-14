'use client';

import { PillarFlame } from './effects/PillarFlame';
import { WALL_DIST, WALL_HEIGHT } from './CastleWalls';

interface TorchPost {
  position: [number, number, number];
  rotationY: number;
}

// Ficam um pouco abaixo do topo da muralha (WALL_HEIGHT) e um pouco pra
// dentro da parede (WALL_DIST - INSET) — encostadas na face voltada pro
// tabuleiro, não flutuando à frente dela.
const TORCH_HEIGHT = WALL_HEIGHT - 0.05;
const WALL_INSET = 0.3;
// Duas tochas por lado, simétricas em torno do centro de cada muralha —
// dentro do comprimento da parede (16 unidades, ±8) com sobra pras esquinas.
const ALONG_WALL_OFFSET = 3.6;

const TORCH_POSTS: TorchPost[] = [-ALONG_WALL_OFFSET, ALONG_WALL_OFFSET].flatMap((o) => [
  { position: [o, TORCH_HEIGHT, WALL_DIST - WALL_INSET], rotationY: 0 },
  { position: [o, TORCH_HEIGHT, -(WALL_DIST - WALL_INSET)], rotationY: Math.PI },
  { position: [WALL_DIST - WALL_INSET, TORCH_HEIGHT, o], rotationY: Math.PI / 2 },
  { position: [-(WALL_DIST - WALL_INSET), TORCH_HEIGHT, o], rotationY: -Math.PI / 2 },
]);

/** One iron wall bracket holding a lit flame — rotationY points its bracket back into the wall behind it. */
function TorchSconce({ position, rotationY }: TorchPost) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow position={[0, 0, 0.08]}>
        <boxGeometry args={[0.06, 0.06, 0.22]} />
        <meshStandardMaterial color="#2a2620" roughness={0.6} metalness={0.4} />
      </mesh>
      <group position={[0, 0.1, 0.18]} scale={0.55}>
        <PillarFlame color="#ff9d3f" coreColor="#ffe3a0" active />
      </group>
    </group>
  );
}

/**
 * Anel de tochas acesas na muralha em volta do tabuleiro — luz de fogo de
 * verdade (não só os `pointLight`s soltos que o cenário noturno já tinha),
 * reaproveitando o mesmo `PillarFlame` (cone + brasas + luz oscilante) usado
 * nos pilares do tabuleiro.
 */
export function WallTorches() {
  return (
    <>
      {TORCH_POSTS.map((post, i) => (
        <TorchSconce key={i} position={post.position} rotationY={post.rotationY} />
      ))}
    </>
  );
}
