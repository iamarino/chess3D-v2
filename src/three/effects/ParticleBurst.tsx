'use client';

import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ParticleBurstProps {
  position: [number, number, number];
  color: string;
  count?: number;
  spread?: number;
  duration?: number;
  onDone: () => void;
}

/**
 * A single instanced-mesh particle burst: N spheres launched outward and
 * upward from `position`, pulled down by gravity, fading and shrinking
 * over `duration`, then reporting completion via `onDone`.
 */
export function ParticleBurst({
  position,
  color,
  count = 24,
  spread = 1.6,
  duration = 0.9,
  onDone,
}: ParticleBurstProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const startTime = useRef<number | null>(null);
  const done = useRef(false);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Lazy state initializer (not useMemo): React only guarantees this runs
  // once per mount, so the burst's random spread stays stable for its
  // lifetime even if a future React version were to discard/recompute memos.
  const [velocities] = useState(() =>
    Array.from({ length: count }, () => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.5;
      const speed = spread * (0.5 + Math.random() * 0.5);
      return new THREE.Vector3(
        Math.cos(theta) * Math.sin(phi) * speed,
        Math.cos(phi) * speed + 1.4,
        Math.sin(theta) * Math.sin(phi) * speed,
      );
    }),
  );

  useFrame((state) => {
    if (done.current) return;
    if (startTime.current === null) startTime.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - startTime.current;
    const progress = t / duration;

    if (progress >= 1) {
      done.current = true;
      onDone();
      return;
    }

    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < count; i += 1) {
      const v = velocities[i];
      const px = position[0] + v.x * t;
      const py = Math.max(position[1] + 0.15 + v.y * t - 2.4 * t * t, 0.02);
      const pz = position[2] + v.z * t;
      const scale = Math.max(0, 1 - progress) * 0.09;
      dummy.position.set(px, py, pz);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    const material = mesh.material as THREE.MeshBasicMaterial;
    material.opacity = Math.max(0, 1 - progress);
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color={color} transparent opacity={1} depthWrite={false} />
    </instancedMesh>
  );
}
