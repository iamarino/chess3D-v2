'use client';

import { useMemo, useRef } from 'react';
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

// Mármore com pequenos pingos/respingos brancos espalhados e pouquíssimas
// rachadas finas. Duas variantes: "black" (moldura, bem escura, encostando
// nas casas do tabuleiro) e "slate" (plinto e pilastras, um cinza-chumbo
// mais claro) — sem essa diferença de tom o plinto/pilastras se confundem
// com as casas pretas do tabuleiro e a base perde profundidade visual.
type MarbleVariant = 'black' | 'slate';

const MARBLE_PALETTES: Record<MarbleVariant, { base: string; veins: string[]; specks: string[] }> = {
  black: {
    base: '#0c0c0f',
    veins: ['rgba(200,200,208,0.4)', 'rgba(150,150,160,0.3)'],
    specks: ['rgba(255,255,255,0.9)', 'rgba(230,230,238,0.7)', 'rgba(190,190,200,0.5)'],
  },
  slate: {
    base: '#4a4a52',
    veins: ['rgba(230,230,236,0.4)', 'rgba(180,180,190,0.3)'],
    specks: ['rgba(255,255,255,0.85)', 'rgba(235,235,242,0.65)', 'rgba(205,205,214,0.45)'],
  },
};

const MARBLE_CANVAS_SIZE = 256;
const MARBLE_TILE_WORLD_SIZE = 1.6; // cada tile da textura cobre esta quantidade de unidades do mundo

const sharedMarbleCanvases: Partial<Record<MarbleVariant, HTMLCanvasElement>> = {};

function getMarbleCanvas(variant: MarbleVariant): HTMLCanvasElement {
  const cached = sharedMarbleCanvases[variant];
  if (cached) return cached;

  const { base, veins, specks } = MARBLE_PALETTES[variant];
  const canvas = document.createElement('canvas');
  canvas.width = MARBLE_CANVAS_SIZE;
  canvas.height = MARBLE_CANVAS_SIZE;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // pouquíssimas rachadas, bem finas e discretas
  const veinCount = 1;
  for (let i = 0; i < veinCount; i++) {
    ctx.strokeStyle = veins[Math.floor(Math.random() * veins.length)];
    ctx.lineWidth = 0.4 + Math.random() * 0.4;

    let x = Math.random() * canvas.width;
    let y = Math.random() * canvas.height;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segments = 2 + Math.floor(Math.random() * 2);
    for (let s = 0; s < segments; s++) {
      const cx = x + (Math.random() - 0.5) * 100;
      const cy = y + (Math.random() - 0.5) * 100;
      const nx = x + (Math.random() - 0.5) * 140;
      const ny = y + (Math.random() - 0.5) * 140;
      ctx.quadraticCurveTo(cx, cy, nx, ny);
      x = nx;
      y = ny;
    }
    ctx.stroke();
  }

  // pequenos pingos brancos espalhados, esparsos, como respingos de mármore/granito
  const speckCount = 70;
  for (let i = 0; i < speckCount; i++) {
    const sx = Math.random() * canvas.width;
    const sy = Math.random() * canvas.height;
    const radius = 0.3 + Math.random() * 0.7;
    ctx.fillStyle = specks[Math.floor(Math.random() * specks.length)];
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  sharedMarbleCanvases[variant] = canvas;
  return canvas;
}

function makeMarbleTexture(
  worldWidth: number,
  worldHeight: number,
  variant: MarbleVariant = 'black',
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(getMarbleCanvas(variant));
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(worldWidth / MARBLE_TILE_WORLD_SIZE, worldHeight / MARBLE_TILE_WORLD_SIZE);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface PillarProps {
  position: [number, number, number];
  glowColor: string;
  bannerColor: string;
  outward: 1 | -1;
  active: boolean;
}

function Pillar({ position, glowColor, bannerColor, outward, active }: PillarProps) {
  const bannerRef = useRef<THREE.Mesh>(null);
  const pillarMarble = useMemo(() => makeMarbleTexture(2 * Math.PI * 0.18, 1.8, 'slate'), []);

  useFrame((state) => {
    if (bannerRef.current) {
      bannerRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 1.4 + position[0]) * 0.18;
    }
  });

  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 1.8, 10]} />
        <meshStandardMaterial map={pillarMarble} roughness={0.3} metalness={0.2} />
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

  const marbleLong = useMemo(() => makeMarbleTexture(OUTER * 2, FRAME_THICKNESS), []);
  const marbleShort = useMemo(() => makeMarbleTexture(FRAME_THICKNESS, HALF * 2), []);
  const marblePlinth = useMemo(() => makeMarbleTexture(PLINTH_HALF * 2, PLINTH_HALF * 2, 'slate'), []);

  return (
    <group>
      {/* frame (picture-frame ring, leaves the checkered squares open) — mármore preto polido */}
      <mesh position={[0, FRAME_Y, HALF + FRAME_THICKNESS / 2]} receiveShadow castShadow>
        <boxGeometry args={[OUTER * 2, FRAME_HEIGHT, FRAME_THICKNESS]} />
        <meshStandardMaterial map={marbleLong} roughness={0.3} metalness={0.2} />
      </mesh>
      <mesh position={[0, FRAME_Y, -(HALF + FRAME_THICKNESS / 2)]} receiveShadow castShadow>
        <boxGeometry args={[OUTER * 2, FRAME_HEIGHT, FRAME_THICKNESS]} />
        <meshStandardMaterial map={marbleLong} roughness={0.3} metalness={0.2} />
      </mesh>
      <mesh position={[HALF + FRAME_THICKNESS / 2, FRAME_Y, 0]} receiveShadow castShadow>
        <boxGeometry args={[FRAME_THICKNESS, FRAME_HEIGHT, HALF * 2]} />
        <meshStandardMaterial map={marbleShort} roughness={0.3} metalness={0.2} />
      </mesh>
      <mesh position={[-(HALF + FRAME_THICKNESS / 2), FRAME_Y, 0]} receiveShadow castShadow>
        <boxGeometry args={[FRAME_THICKNESS, FRAME_HEIGHT, HALF * 2]} />
        <meshStandardMaterial map={marbleShort} roughness={0.3} metalness={0.2} />
      </mesh>

      {/* plinth beneath everything, wide enough for the pillars to stand on — mesmo mármore preto */}
      <mesh position={[0, -PLINTH_HEIGHT / 2 - 0.02, 0]} receiveShadow castShadow>
        <boxGeometry args={[PLINTH_HALF * 2, PLINTH_HEIGHT, PLINTH_HALF * 2]} />
        <meshStandardMaterial map={marblePlinth} roughness={0.3} metalness={0.2} />
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
