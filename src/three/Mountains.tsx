'use client';

import { useState } from 'react';
import * as THREE from 'three';

interface MountainProps {
  position: [number, number, number];
  baseSize: number;
  height: number;
  rockColor: string;
  snowy: boolean;
}

const LAYER_COUNT = 4;

/** A single blocky, terraced peak — stacked tapering cubes instead of a smooth cone, for a low-poly voxel look. */
function Mountain({ position, baseSize, height, rockColor, snowy }: MountainProps) {
  const layerHeight = height / LAYER_COUNT;

  return (
    <group position={position}>
      {Array.from({ length: LAYER_COUNT }, (_, i) => {
        const t = i / (LAYER_COUNT - 1);
        const size = baseSize * (1 - t * 0.8);
        const y = layerHeight * i + layerHeight / 2;
        const isTop = i === LAYER_COUNT - 1;
        return (
          <mesh key={i} position={[0, y, 0]} receiveShadow>
            <boxGeometry args={[size, layerHeight, size]} />
            <meshStandardMaterial
              color={isTop && snowy ? '#eef3fb' : rockColor}
              roughness={0.95}
              flatShading
            />
          </mesh>
        );
      })}
    </group>
  );
}

interface MountainConfig {
  position: [number, number, number];
  baseSize: number;
  height: number;
  rockColor: string;
  snowy: boolean;
}

const DEFAULT_NEAR_COLOR = '#5f6478';
const DEFAULT_FAR_COLOR = '#aebfd4';

/** Ring of distant blocky peaks framing the castle backdrop, with far peaks fading paler (atmospheric perspective). */
export function Mountains({
  nearColor = DEFAULT_NEAR_COLOR,
  farColor = DEFAULT_FAR_COLOR,
  snowy = true,
}: {
  nearColor?: string;
  farColor?: string;
  /** Desliga os topos brancos (picos nevados não combinam com todo cenário). */
  snowy?: boolean;
}) {
  const [configs] = useState<MountainConfig[]>(() => {
    const near = new THREE.Color(nearColor);
    const far = new THREE.Color(farColor);
    const count = 18;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const dist = 24 + Math.random() * 16;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const height = 7 + Math.random() * 11;
      const baseSize = 5 + Math.random() * 5;
      const t = (dist - 24) / 16;
      const rockColor = near.clone().lerp(far, t).getStyle();
      return { position: [x, -0.55, z] as [number, number, number], baseSize, height, rockColor, snowy: snowy && height > 12 };
    });
  });

  return (
    <>
      {configs.map((config, i) => (
        <Mountain
          key={i}
          position={config.position}
          baseSize={config.baseSize}
          height={config.height}
          rockColor={config.rockColor}
          snowy={config.snowy}
        />
      ))}
    </>
  );
}
