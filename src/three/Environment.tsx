'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { QUALITY_PRESETS, useSettingsStore } from '@/store/useSettingsStore';
import { AmbientMotes } from './effects/AmbientMotes';
import { CastleWalls } from './CastleWalls';
import { Mountains } from './Mountains';

const SKY_VERTEX_SHADER = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT_SHADER = `
  uniform vec3 topColor;
  uniform vec3 bottomColor;
  uniform float offset;
  uniform float exponent;
  varying vec3 vWorldPosition;
  void main() {
    float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
    gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
  }
`;

/**
 * A bright castle-balcony backdrop: gradient daytime sky, distant blocky
 * mountains, a crenellated parapet, atmospheric fog, and ambient motes.
 * Entirely procedural — no external assets.
 */
export function Environment() {
  const quality = useSettingsStore((s) => s.quality);
  const motesCount = QUALITY_PRESETS[quality].ambientMotes;

  const skyMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          topColor: { value: new THREE.Color('#4a90d9') },
          bottomColor: { value: new THREE.Color('#cfe9f7') },
          offset: { value: 8 },
          exponent: { value: 0.6 },
        },
        vertexShader: SKY_VERTEX_SHADER,
        fragmentShader: SKY_FRAGMENT_SHADER,
        side: THREE.BackSide,
      }),
    [],
  );

  return (
    <>
      <fogExp2 attach="fog" args={['#cfe9f7', 0.015]} />
      <mesh material={skyMaterial} renderOrder={-1}>
        <sphereGeometry args={[60, 32, 15]} />
      </mesh>
      <mesh position={[0, -0.58, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[30, 48]} />
        <meshStandardMaterial color="#9c9384" roughness={0.95} metalness={0.05} />
      </mesh>
      <Mountains />
      <CastleWalls />
      <pointLight position={[0, 3, 6]} color="#ffb454" intensity={0.2} distance={12} />
      <pointLight position={[0, 3, -6]} color="#8e2de2" intensity={0.2} distance={12} />
      {motesCount > 0 && <AmbientMotes count={motesCount} />}
    </>
  );
}
