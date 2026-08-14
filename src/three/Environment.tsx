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

// Grama estilo Minecraft: pixels quadrados sólidos (sem blur/gradiente) em
// tons de verde levemente variados, como a textura dithered do bloco de grama.
const GRASS_COLORS = ['#63a83f', '#63a83f', '#5c9a3a', '#6fb848', '#578f36', '#63a83f'];
const GRASS_PX = 8; // tamanho de cada "pixel" do bloco, em pixels de canvas
const GRASS_GRID = 16; // 16x16 pixels por tile, como uma textura de bloco do Minecraft
const GRASS_TILE_WORLD_SIZE = 1; // cada tile da textura cobre 1 unidade do mundo

let sharedGrassCanvas: HTMLCanvasElement | null = null;

function getGrassCanvas(): HTMLCanvasElement {
  if (sharedGrassCanvas) return sharedGrassCanvas;

  const canvas = document.createElement('canvas');
  canvas.width = GRASS_PX * GRASS_GRID;
  canvas.height = GRASS_PX * GRASS_GRID;
  const ctx = canvas.getContext('2d')!;

  for (let y = 0; y < GRASS_GRID; y++) {
    for (let x = 0; x < GRASS_GRID; x++) {
      ctx.fillStyle = GRASS_COLORS[Math.floor(Math.random() * GRASS_COLORS.length)];
      ctx.fillRect(x * GRASS_PX, y * GRASS_PX, GRASS_PX, GRASS_PX);
    }
  }

  sharedGrassCanvas = canvas;
  return canvas;
}

function makeGrassTexture(worldWidth: number, worldHeight: number): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(getGrassCanvas());
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // Nearest = sem suavização entre pixels, mantendo o visual quadriculado do Minecraft.
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.repeat.set(worldWidth / GRASS_TILE_WORLD_SIZE, worldHeight / GRASS_TILE_WORLD_SIZE);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * A bright castle-balcony backdrop: gradient daytime sky, distant blocky
 * mountains, a crenellated parapet, atmospheric fog, and ambient motes.
 * Entirely procedural — no external assets.
 */
export function Environment() {
  const quality = useSettingsStore((s) => s.quality);
  const motesCount = QUALITY_PRESETS[quality].ambientMotes;

  const groundTexture = useMemo(() => makeGrassTexture(60, 60), []);

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
        <meshStandardMaterial map={groundTexture} roughness={0.95} metalness={0.05} />
      </mesh>
      <Mountains />
      <CastleWalls />
      <pointLight position={[0, 3, 6]} color="#ffb454" intensity={0.2} distance={12} />
      <pointLight position={[0, 3, -6]} color="#8e2de2" intensity={0.2} distance={12} />
      {motesCount > 0 && <AmbientMotes count={motesCount} />}
    </>
  );
}
