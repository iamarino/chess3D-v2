'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '@/store/useGameStore';
import { heroesVillainsTheme } from '@/themes/heroes-villains/theme';
import { PillarFlame } from './effects/PillarFlame';

const theme = heroesVillainsTheme;

const HALF = 4; // 8 squares of size 1, centered at origin
const FRAME_THICKNESS = 0.4;
const FRAME_HEIGHT = 0.1;
const FRAME_Y = 0.02;
const PLINTH_HEIGHT = 0.5;
const OUTER = HALF + FRAME_THICKNESS;
const PILLAR_DIST = OUTER + 0.35;
// Plinth must reach well past the pillars so they stand on solid ground
// instead of floating past its edge (pillar base radius + banner overhang).
const PLINTH_HALF = PILLAR_DIST + 0.7;
const PLINTH_TOP_Y = -PLINTH_HEIGHT / 2 - 0.02 + PLINTH_HEIGHT / 2;

const FRAME_COLOR = '#8a8378';
const PLINTH_COLOR = '#726c60';
const PILLAR_COLOR = '#797264';

interface PillarProps {
  position: [number, number, number];
  glowColor: string;
  bannerColor: string;
  outward: 1 | -1;
  active: boolean;
}

function Pillar({ position, glowColor, bannerColor, outward, active }: PillarProps) {
  const bannerRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (bannerRef.current) {
      bannerRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 1.4 + position[0]) * 0.18;
    }
  });

  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 1.8, 10]} />
        <meshStandardMaterial color={PILLAR_COLOR} roughness={0.85} metalness={0.1} flatShading />
      </mesh>
      <group position={[0, 1.85, 0]}>
        <PillarFlame color={glowColor} active={active} />
      </group>
      <mesh ref={bannerRef} position={[0.24 * outward, 1.3, 0]}>
        <planeGeometry args={[0.4, 0.7]} />
        <meshStandardMaterial color={bannerColor} side={THREE.DoubleSide} roughness={0.85} />
      </mesh>
    </group>
  );
}

/** Static structure around the interactive squares: frame, plinth, corner pillars with banners. */
export function BoardBase() {
  const turn = useGameStore((s) => s.state.turn);
  const heroGlow = theme.pieces.hero.accentColor;
  const villainGlow = theme.pieces.villain.accentColor;
  const heroBanner = theme.pieces.hero.primaryColor;
  const villainBanner = theme.pieces.villain.primaryColor;

  return (
    <group>
      {/* frame (picture-frame ring, leaves the checkered squares open) */}
      <mesh position={[0, FRAME_Y, HALF + FRAME_THICKNESS / 2]} receiveShadow castShadow>
        <boxGeometry args={[OUTER * 2, FRAME_HEIGHT, FRAME_THICKNESS]} />
        <meshStandardMaterial color={FRAME_COLOR} roughness={0.9} metalness={0.05} flatShading />
      </mesh>
      <mesh position={[0, FRAME_Y, -(HALF + FRAME_THICKNESS / 2)]} receiveShadow castShadow>
        <boxGeometry args={[OUTER * 2, FRAME_HEIGHT, FRAME_THICKNESS]} />
        <meshStandardMaterial color={FRAME_COLOR} roughness={0.9} metalness={0.05} flatShading />
      </mesh>
      <mesh position={[HALF + FRAME_THICKNESS / 2, FRAME_Y, 0]} receiveShadow castShadow>
        <boxGeometry args={[FRAME_THICKNESS, FRAME_HEIGHT, HALF * 2]} />
        <meshStandardMaterial color={FRAME_COLOR} roughness={0.9} metalness={0.05} flatShading />
      </mesh>
      <mesh position={[-(HALF + FRAME_THICKNESS / 2), FRAME_Y, 0]} receiveShadow castShadow>
        <boxGeometry args={[FRAME_THICKNESS, FRAME_HEIGHT, HALF * 2]} />
        <meshStandardMaterial color={FRAME_COLOR} roughness={0.9} metalness={0.05} flatShading />
      </mesh>

      {/* plinth beneath everything, wide enough for the pillars to stand on */}
      <mesh position={[0, -PLINTH_HEIGHT / 2 - 0.02, 0]} receiveShadow castShadow>
        <boxGeometry args={[PLINTH_HALF * 2, PLINTH_HEIGHT, PLINTH_HALF * 2]} />
        <meshStandardMaterial color={PLINTH_COLOR} roughness={0.95} metalness={0.05} flatShading />
      </mesh>

      {/* corner pillars: hero side (z > 0, gold) vs villain side (z < 0, purple) */}
      <Pillar
        position={[PILLAR_DIST, PLINTH_TOP_Y, PILLAR_DIST]}
        glowColor={heroGlow}
        bannerColor={heroBanner}
        outward={1}
        active={turn === 'hero'}
      />
      <Pillar
        position={[-PILLAR_DIST, PLINTH_TOP_Y, PILLAR_DIST]}
        glowColor={heroGlow}
        bannerColor={heroBanner}
        outward={-1}
        active={turn === 'hero'}
      />
      <Pillar
        position={[PILLAR_DIST, PLINTH_TOP_Y, -PILLAR_DIST]}
        glowColor={villainGlow}
        bannerColor={villainBanner}
        outward={1}
        active={turn === 'villain'}
      />
      <Pillar
        position={[-PILLAR_DIST, PLINTH_TOP_Y, -PILLAR_DIST]}
        glowColor={villainGlow}
        bannerColor={villainBanner}
        outward={-1}
        active={turn === 'villain'}
      />
    </group>
  );
}
