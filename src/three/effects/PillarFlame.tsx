'use client';

import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface PillarFlameProps {
  color: string;
  coreColor?: string;
  active: boolean;
}

interface Ember {
  angle: number;
  radius: number;
  speed: number;
  phase: number;
}

const EMBER_COUNT = 7;
const IDLE_SCALE = 0.7;
const ACTIVE_SCALE = 1.45;
const IDLE_INTENSITY = 0.5;
const ACTIVE_INTENSITY = 2.2;

/** A flickering brazier flame sitting on a pillar cap; flares up and spits embers on its team's turn. */
export function PillarFlame({ color, coreColor = '#fff2c0', active }: PillarFlameProps) {
  const groupRef = useRef<THREE.Group>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const embersRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const baseIntensity = useRef(1.1 + Math.random() * 0.3);
  const currentScale = useRef(active ? ACTIVE_SCALE : IDLE_SCALE);
  const currentIntensityMul = useRef(active ? ACTIVE_INTENSITY : IDLE_INTENSITY);

  const [embers] = useState<Ember[]>(() =>
    Array.from({ length: EMBER_COUNT }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: 0.03 + Math.random() * 0.05,
      speed: 0.5 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
    })),
  );

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const flicker = Math.sin(t * 11) * 0.06 + Math.sin(t * 23 + 1.7) * 0.04 + Math.sin(t * 5.3) * 0.05;

    const targetScale = active ? ACTIVE_SCALE : IDLE_SCALE;
    const targetIntensityMul = active ? ACTIVE_INTENSITY : IDLE_INTENSITY;
    currentScale.current = THREE.MathUtils.damp(currentScale.current, targetScale, 4, delta);
    currentIntensityMul.current = THREE.MathUtils.damp(currentIntensityMul.current, targetIntensityMul, 4, delta);

    if (groupRef.current) {
      groupRef.current.scale.setScalar(currentScale.current);
    }
    if (outerRef.current) {
      outerRef.current.scale.set(1 + flicker * 0.5, 1 + flicker, 1 + flicker * 0.5);
      outerRef.current.rotation.y = t * 0.6;
    }
    if (innerRef.current) {
      innerRef.current.scale.set(1 + flicker * 0.7, 1 + flicker * 1.3, 1 + flicker * 0.7);
      innerRef.current.rotation.y = -t * 0.9;
    }
    if (lightRef.current) {
      lightRef.current.intensity = (baseIntensity.current + flicker * 1.4) * currentIntensityMul.current;
    }

    const mesh = embersRef.current;
    if (mesh) {
      embers.forEach((ember, i) => {
        const cycle = (t * ember.speed + ember.phase) % 1.4;
        const rise = cycle * 0.5;
        const fade = active ? Math.max(0, 1 - cycle / 1.4) : 0;
        const wobble = Math.sin(t * 3 + ember.phase) * 0.02;
        dummy.position.set(
          Math.cos(ember.angle) * ember.radius + wobble,
          0.18 + rise,
          Math.sin(ember.angle) * ember.radius + wobble,
        );
        dummy.scale.setScalar(0.02 * fade);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={outerRef} position={[0, 0.16, 0]}>
        <coneGeometry args={[0.13, 0.4, 8]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.75}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={innerRef} position={[0, 0.14, 0]}>
        <coneGeometry args={[0.07, 0.26, 8]} />
        <meshBasicMaterial
          color={coreColor}
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <pointLight ref={lightRef} position={[0, 0.3, 0]} color={color} intensity={1.1} distance={4.5} />
      <instancedMesh ref={embersRef} args={[undefined, undefined, EMBER_COUNT]} frustumCulled={false}>
        <sphereGeometry args={[1, 5, 5]} />
        <meshBasicMaterial
          color={coreColor}
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
    </group>
  );
}
