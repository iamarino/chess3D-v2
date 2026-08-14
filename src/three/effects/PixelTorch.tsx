'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface PixelTorchProps {
  position: [number, number, number];
}

const POST_COLOR = '#5a4636';
const POST_BAND_COLOR = '#8f7a63';
const BOWL_COLOR = '#5c5c62';
// Vermelho mais saturado (menos laranja/amarelo) — a pedido, pra bater com
// o tom dos tijolos da muralha em vez do laranja-âmbar original.
const FLAME_OUTER = '#c22a1a';
const FLAME_INNER = '#e8531f';
const EMBER_COLOR = '#8f1710';

const POST_HEIGHT = 0.42;
const BOWL_Y = POST_HEIGHT;
const FLAME_BASE_Y = BOWL_Y + 0.08;

/**
 * Tocha de pé estilo voxel/Minecraft: poste de madeira com uma tigela de
 * metal no topo segurando brasas acesas — referência visual do usuário
 * (substitui a versão anterior, de parede). Fica de pé sobre a superfície
 * cinza do plinto (`BoardBase.tsx`), sem depender de encostar numa face
 * vertical. Visual diferente de propósito do `PillarFlame` (cone suave nos
 * pilares de canto) — essa é a tocha "de item", em blocos sem gradiente.
 */
export function PixelTorch({ position }: PixelTorchProps) {
  const lightRef = useRef<THREE.PointLight>(null);
  const flameRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const flicker = Math.sin(t * 13) * 0.08 + Math.sin(t * 27 + 2) * 0.05 + Math.sin(t * 6.1) * 0.06;
    if (lightRef.current) lightRef.current.intensity = 1 + flicker * 1.1;
    if (flameRef.current) flameRef.current.scale.setScalar(1 + flicker * 0.25);
  });

  return (
    <group position={position}>
      {/* poste — duas cores empilhadas pra quebrar a superfície lisa, sem textura de verdade */}
      <mesh position={[0, POST_HEIGHT * 0.27, 0]} castShadow>
        <boxGeometry args={[0.1, POST_HEIGHT * 0.54, 0.1]} />
        <meshStandardMaterial color={POST_COLOR} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, POST_HEIGHT * 0.77, 0]} castShadow>
        <boxGeometry args={[0.1, POST_HEIGHT * 0.46, 0.1]} />
        <meshStandardMaterial color={POST_BAND_COLOR} roughness={0.9} flatShading />
      </mesh>
      {/* tigela de metal no topo do poste, segurando as brasas */}
      <mesh position={[0, BOWL_Y, 0]} castShadow>
        <boxGeometry args={[0.24, 0.09, 0.24]} />
        <meshStandardMaterial color={BOWL_COLOR} roughness={0.6} metalness={0.5} flatShading />
      </mesh>
      {/* chama — blocos empilhados sem gradiente, brasa vermelha na ponta, estilo voxel */}
      <group ref={flameRef} position={[0, FLAME_BASE_Y, 0]}>
        <mesh>
          <boxGeometry args={[0.16, 0.14, 0.16]} />
          <meshBasicMaterial color={FLAME_OUTER} />
        </mesh>
        <mesh position={[0, 0.08, 0]}>
          <boxGeometry args={[0.09, 0.11, 0.09]} />
          <meshBasicMaterial color={FLAME_INNER} />
        </mesh>
        <mesh position={[0, 0.15, 0]}>
          <boxGeometry args={[0.045, 0.06, 0.045]} />
          <meshBasicMaterial color={EMBER_COLOR} />
        </mesh>
      </group>
      <pointLight ref={lightRef} position={[0, FLAME_BASE_Y + 0.06, 0]} color="#ff5a2e" intensity={1} distance={6.5} />
    </group>
  );
}
