'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { QUALITY_PRESETS, useSettingsStore } from '@/store/useSettingsStore';
import { AmbientMotes } from './effects/AmbientMotes';
import { CastleWalls } from './CastleWalls';
import { Mountains } from './Mountains';
import { Stars } from './Stars';
import { WallTorches } from './WallTorches';

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

const SCENARIO_SKY = {
  'castle-day': { top: '#4a90d9', bottom: '#cfe9f7', fog: '#cfe9f7', fogDensity: 0.015 },
  'castle-night': { top: '#050814', bottom: '#241a3d', fog: '#0e0a1f', fogDensity: 0.02 },
} as const;

const SCENARIO_MOUNTAINS = {
  'castle-day': { nearColor: '#5f6478', farColor: '#aebfd4', snowy: true },
  'castle-night': { nearColor: '#181425', farColor: '#3a2f57', snowy: false },
} as const;

const SCENARIO_WALLS = {
  'castle-day': { brickColors: ['#b3552f', '#a44a28', '#c05e37', '#9c4322'], mortarColor: '#c7bda8' },
  'castle-night': { brickColors: ['#332a4d', '#2b2440', '#3d3459', '#251e38'], mortarColor: '#4a4166' },
} as const;

/**
 * Dois cenários procedurais (sem trocar tema de peça/tabuleiro, ver
 * `useSettingsStore.scenario`): balcão de castelo ao meio-dia (padrão) e
 * cerco noturno — céu, montanhas e muralha trocam de paleta, ganham lua e
 * estrelas; a luz principal (sol/lua) fica em `Scene.tsx`, que lê o mesmo
 * `scenario`. Entirely procedural — no external assets.
 */
export function Environment() {
  const quality = useSettingsStore((s) => s.quality);
  const scenario = useSettingsStore((s) => s.scenario);
  const isNight = scenario === 'castle-night';
  const motesCount = QUALITY_PRESETS[quality].ambientMotes;
  const sky = SCENARIO_SKY[scenario];
  const mountains = SCENARIO_MOUNTAINS[scenario];
  const walls = SCENARIO_WALLS[scenario];

  const groundTexture = useMemo(() => makeGrassTexture(60, 60), []);

  const skyMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          topColor: { value: new THREE.Color(sky.top) },
          bottomColor: { value: new THREE.Color(sky.bottom) },
          offset: { value: 8 },
          exponent: { value: 0.6 },
        },
        vertexShader: SKY_VERTEX_SHADER,
        fragmentShader: SKY_FRAGMENT_SHADER,
        side: THREE.BackSide,
      }),
    // Recriado quando o cenário muda — o `useMemo` fica preso na paleta
    // capturada na primeira montagem se só os uniforms mudassem por dentro.
    [sky.top, sky.bottom],
  );

  return (
    <>
      <fogExp2 attach="fog" args={[sky.fog, sky.fogDensity]} />
      <mesh material={skyMaterial} renderOrder={-1}>
        <sphereGeometry args={[60, 32, 15]} />
      </mesh>
      <mesh position={[0, -0.58, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[30, 48]} />
        <meshStandardMaterial map={groundTexture} roughness={0.95} metalness={0.05} />
      </mesh>
      {isNight && (
        <>
          <Stars />
          {/* Lua — esfera emissiva simples, sem luz própria (a luz "de lua" vem
              do directionalLight frio em Scene.tsx, mantendo uma única fonte
              de sombra). */}
          <mesh position={[-14, 22, -30]}>
            <sphereGeometry args={[2.4, 24, 24]} />
            <meshBasicMaterial color="#f2f0e6" />
          </mesh>
          <WallTorches />
        </>
      )}
      {/* `key` força remontar (chaves distintas por componente — repetir a
          mesma entre irmãos, mesmo de tipos diferentes, dispara o aviso de
          "two children with the same key" do React): as duas leem a paleta
          só uma vez, no `useState`/`useMemo` inicial, então trocar de
          cenário em tempo real não bastaria mudar as props. */}
      <Mountains key={`mountains-${scenario}`} nearColor={mountains.nearColor} farColor={mountains.farColor} snowy={mountains.snowy} />
      <CastleWalls key={`walls-${scenario}`} brickColors={[...walls.brickColors]} mortarColor={walls.mortarColor} />
      <pointLight position={[0, 3, 6]} color="#ffb454" intensity={isNight ? 0.35 : 0.2} distance={12} />
      <pointLight position={[0, 3, -6]} color="#8e2de2" intensity={isNight ? 0.4 : 0.2} distance={12} />
      {motesCount > 0 && <AmbientMotes count={motesCount} />}
    </>
  );
}
