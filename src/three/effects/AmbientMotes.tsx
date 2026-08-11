'use client';

import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Mote {
  basePosition: THREE.Vector3;
  speed: number;
  phase: number;
  color: THREE.Color;
}

/** Slow-drifting embers/dust: gold on the hero half of the board, purple on the villain half. */
export function AmbientMotes({ count = 40 }: { count?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const [motes] = useState<Mote[]>(() =>
    Array.from({ length: count }, () => {
      const side = Math.random() < 0.5 ? 1 : -1;
      const x = (Math.random() - 0.5) * 9;
      const z = side * (1 + Math.random() * 4.5);
      const y = 0.3 + Math.random() * 2.2;
      return {
        basePosition: new THREE.Vector3(x, y, z),
        speed: 0.3 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        color: new THREE.Color(side > 0 ? '#ffd77a' : '#c084fc'),
      };
    }),
  );

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;

    motes.forEach((mote, i) => {
      const bob = Math.sin(t * mote.speed + mote.phase) * 0.3;
      const drift = Math.cos(t * mote.speed * 0.6 + mote.phase) * 0.2;
      dummy.position.set(mote.basePosition.x + drift, mote.basePosition.y + bob, mote.basePosition.z);
      dummy.scale.setScalar(0.03 + Math.sin(t * 2 + mote.phase) * 0.01);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, mote.color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial vertexColors transparent opacity={0.55} depthWrite={false} />
    </instancedMesh>
  );
}
