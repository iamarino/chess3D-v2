'use client';

import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface EmberParticle {
  x: number;
  z: number;
  speed: number;
  wobblePhase: number;
  startOffset: number;
}

const RISE_HEIGHT = 8;
const SPREAD = 22;

/** Brasas subindo do chão em looping — usado no cenário vulcânico pra reforçar o calor/perigo do ar. */
export function Embers({ count = 60 }: { count?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const [embers] = useState<EmberParticle[]>(() =>
    Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * SPREAD,
      z: (Math.random() - 0.5) * SPREAD,
      speed: 0.4 + Math.random() * 0.7,
      wobblePhase: Math.random() * Math.PI * 2,
      startOffset: Math.random() * RISE_HEIGHT,
    })),
  );

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;

    embers.forEach((ember, i) => {
      const rise = (ember.startOffset + t * ember.speed) % RISE_HEIGHT;
      const wobble = Math.sin(t * 1.6 + ember.wobblePhase) * 0.4;
      const fadeOut = 1 - rise / RISE_HEIGHT;
      dummy.position.set(ember.x + wobble, 0.2 + rise, ember.z);
      dummy.scale.setScalar(0.035 * fadeOut);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#ff6a2e" transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} />
    </instancedMesh>
  );
}
