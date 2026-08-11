'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '@/store/useGameStore';
import { squareToPosition } from '../boardUtils';

/** Pulsing red ring + light on the king currently in check. Hidden during checkmate, where the victory particles take over. */
export function CheckAura() {
  const check = useGameStore((s) => s.state.check);
  const checkmate = useGameStore((s) => s.state.checkmate);
  const turn = useGameStore((s) => s.state.turn);
  const pieces = useGameStore((s) => s.state.pieces);
  const ringRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  const kingSquare = useMemo(() => {
    if (!check) return null;
    return pieces.find((p) => p.type === 'king' && p.color === turn)?.square ?? null;
  }, [check, turn, pieces]);

  useFrame((state) => {
    if (!ringRef.current || !lightRef.current) return;
    const pulse = 0.6 + Math.sin(state.clock.elapsedTime * 6) * 0.4;
    ringRef.current.scale.setScalar(1 + pulse * 0.15);
    const material = ringRef.current.material as THREE.MeshBasicMaterial;
    material.opacity = 0.4 + pulse * 0.4;
    lightRef.current.intensity = 1.2 + pulse * 1.4;
  });

  if (!kingSquare || checkmate) return null;

  const [x, , z] = squareToPosition(kingSquare);

  return (
    <group position={[x, 0.03, z]}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.46, 32]} />
        <meshBasicMaterial color="#ff2b2b" transparent opacity={0.7} depthWrite={false} />
      </mesh>
      <pointLight ref={lightRef} position={[0, 1, 0]} color="#ff3b3b" intensity={1.5} distance={2.5} />
    </group>
  );
}
