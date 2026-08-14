'use client';

import { useState } from 'react';
import * as THREE from 'three';

/** `'snow'` topa os picos altos em branco; `'lava'` acende o topo de TODO pico em laranja (luz própria); `'none'` não destaca o topo. */
export type PeakStyle = 'snow' | 'lava' | 'none';

interface MountainProps {
  position: [number, number, number];
  baseSize: number;
  height: number;
  rockColor: string;
  peak: PeakStyle;
}

const LAYER_COUNT = 4;
const LAVA_PEAK_COLOR = '#ff5a1f';

/** A single blocky, terraced peak — stacked tapering cubes instead of a smooth cone, for a low-poly voxel look. */
function Mountain({ position, baseSize, height, rockColor, peak }: MountainProps) {
  const layerHeight = height / LAYER_COUNT;

  return (
    <group position={position}>
      {Array.from({ length: LAYER_COUNT }, (_, i) => {
        const t = i / (LAYER_COUNT - 1);
        const size = baseSize * (1 - t * 0.8);
        const y = layerHeight * i + layerHeight / 2;
        const isTop = i === LAYER_COUNT - 1;
        const isLavaPeak = isTop && peak === 'lava';
        return (
          <mesh key={i} position={[0, y, 0]} receiveShadow>
            <boxGeometry args={[size, layerHeight, size]} />
            <meshStandardMaterial
              color={isTop && peak === 'snow' ? '#eef3fb' : isLavaPeak ? LAVA_PEAK_COLOR : rockColor}
              emissive={isLavaPeak ? LAVA_PEAK_COLOR : undefined}
              emissiveIntensity={isLavaPeak ? 1.4 : 0}
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
  peak: PeakStyle;
}

const DEFAULT_NEAR_COLOR = '#5f6478';
const DEFAULT_FAR_COLOR = '#aebfd4';

/** Ring of distant blocky peaks framing the backdrop, with far peaks fading paler (atmospheric perspective). */
export function Mountains({
  nearColor = DEFAULT_NEAR_COLOR,
  farColor = DEFAULT_FAR_COLOR,
  peakStyle = 'snow',
}: {
  nearColor?: string;
  farColor?: string;
  peakStyle?: PeakStyle;
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
      // Neve só nos picos altos (visual antigo); lava acende qualquer pico —
      // um campo vulcânico ativo não depende de altura pra brilhar.
      const peak: PeakStyle = peakStyle === 'snow' ? (height > 12 ? 'snow' : 'none') : peakStyle;
      return { position: [x, -0.55, z] as [number, number, number], baseSize, height, rockColor, peak };
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
          peak={config.peak}
        />
      ))}
    </>
  );
}
