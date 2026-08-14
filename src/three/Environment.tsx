'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { QUALITY_PRESETS, useSettingsStore } from '@/store/useSettingsStore';
import type { Scenario } from '@/store/useSettingsStore';
import { AmbientMotes } from './effects/AmbientMotes';
import { Embers } from './effects/Embers';
import { CastleWalls } from './CastleWalls';
import { Mountains, type PeakStyle } from './Mountains';
import { StadiumStands } from './StadiumStands';
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

// Rocha vulcânica estilo Minecraft, mesma receita da grama — cinza-carvão
// quase preto com uma fração dos pixels virando racha incandescente. Duas
// texturas geradas juntas (mesmas posições de racha) porque o brilho da
// racha precisa de um emissiveMap separado do map de cor — sem isso teria
// que ser tudo emissivo (clareia a rocha) ou nada (racha não brilha no escuro).
const OBSIDIAN_ROCK_COLORS = ['#1c191e', '#242026', '#17151a', '#2a242c'];
const OBSIDIAN_CRACK_COLOR = '#ff5a1f';
const OBSIDIAN_CRACK_CHANCE = 0.05;
const OBSIDIAN_PX = 8;
const OBSIDIAN_GRID = 16;
const OBSIDIAN_TILE_WORLD_SIZE = 1;

let sharedObsidianCanvases: { color: HTMLCanvasElement; emissive: HTMLCanvasElement } | null = null;

function getObsidianCanvases(): { color: HTMLCanvasElement; emissive: HTMLCanvasElement } {
  if (sharedObsidianCanvases) return sharedObsidianCanvases;

  const size = OBSIDIAN_PX * OBSIDIAN_GRID;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const colorCtx = colorCanvas.getContext('2d')!;

  const emissiveCanvas = document.createElement('canvas');
  emissiveCanvas.width = size;
  emissiveCanvas.height = size;
  const emissiveCtx = emissiveCanvas.getContext('2d')!;
  emissiveCtx.fillStyle = '#000000';
  emissiveCtx.fillRect(0, 0, size, size);

  for (let y = 0; y < OBSIDIAN_GRID; y++) {
    for (let x = 0; x < OBSIDIAN_GRID; x++) {
      const isCrack = Math.random() < OBSIDIAN_CRACK_CHANCE;
      colorCtx.fillStyle = isCrack
        ? OBSIDIAN_CRACK_COLOR
        : OBSIDIAN_ROCK_COLORS[Math.floor(Math.random() * OBSIDIAN_ROCK_COLORS.length)];
      colorCtx.fillRect(x * OBSIDIAN_PX, y * OBSIDIAN_PX, OBSIDIAN_PX, OBSIDIAN_PX);
      if (isCrack) {
        emissiveCtx.fillStyle = OBSIDIAN_CRACK_COLOR;
        emissiveCtx.fillRect(x * OBSIDIAN_PX, y * OBSIDIAN_PX, OBSIDIAN_PX, OBSIDIAN_PX);
      }
    }
  }

  sharedObsidianCanvases = { color: colorCanvas, emissive: emissiveCanvas };
  return sharedObsidianCanvases;
}

function makeObsidianTextures(
  worldWidth: number,
  worldHeight: number,
): { map: THREE.CanvasTexture; emissiveMap: THREE.CanvasTexture } {
  const { color, emissive } = getObsidianCanvases();
  const map = new THREE.CanvasTexture(color);
  const emissiveMap = new THREE.CanvasTexture(emissive);
  [map, emissiveMap].forEach((texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.repeat.set(worldWidth / OBSIDIAN_TILE_WORLD_SIZE, worldHeight / OBSIDIAN_TILE_WORLD_SIZE);
    texture.colorSpace = THREE.SRGBColorSpace;
  });
  return { map, emissiveMap };
}

// Grama listrada de campo de futebol: mesma malha pixelada da grama comum,
// mas em faixas alternadas de verde claro/escuro (o corte do cortador de
// grama profissional) em vez de ruído uniforme — cada faixa tem `STRIPE_ROWS`
// linhas da grade pra sobrar textura/variação dentro da própria faixa.
const TURF_LIGHT_COLORS = ['#63c052', '#5db84c', '#69c658'];
const TURF_DARK_COLORS = ['#3c8a34', '#377f2f', '#40922f'];
const TURF_PX = 8;
const TURF_GRID = 16;
const TURF_STRIPE_ROWS = 2;
const TURF_TILE_WORLD_SIZE = 1;

let sharedTurfCanvas: HTMLCanvasElement | null = null;

function getTurfCanvas(): HTMLCanvasElement {
  if (sharedTurfCanvas) return sharedTurfCanvas;

  const size = TURF_PX * TURF_GRID;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  for (let y = 0; y < TURF_GRID; y++) {
    const band = Math.floor(y / TURF_STRIPE_ROWS);
    const palette = band % 2 === 0 ? TURF_LIGHT_COLORS : TURF_DARK_COLORS;
    for (let x = 0; x < TURF_GRID; x++) {
      ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)];
      ctx.fillRect(x * TURF_PX, y * TURF_PX, TURF_PX, TURF_PX);
    }
  }

  sharedTurfCanvas = canvas;
  return canvas;
}

function makeTurfTexture(worldWidth: number, worldHeight: number): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(getTurfCanvas());
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.repeat.set(worldWidth / TURF_TILE_WORLD_SIZE, worldHeight / TURF_TILE_WORLD_SIZE);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const SCENARIO_SKY: Record<Scenario, { top: string; bottom: string; fog: string; fogDensity: number }> = {
  'castle-day': { top: '#4a90d9', bottom: '#cfe9f7', fog: '#cfe9f7', fogDensity: 0.015 },
  'castle-night': { top: '#050814', bottom: '#241a3d', fog: '#0e0a1f', fogDensity: 0.02 },
  'volcanic-rift': { top: '#180705', bottom: '#c94620', fog: '#2b0d08', fogDensity: 0.026 },
  'football-pitch': { top: '#4098e8', bottom: '#bfe0f7', fog: '#cfe9f7', fogDensity: 0.012 },
};

// `football-pitch` fica de fora — troca as montanhas por arquibancadas
// (`StadiumStands`), não faz sentido ter picos rochosos em volta de um campo.
const SCENARIO_MOUNTAINS: Partial<Record<Scenario, { nearColor: string; farColor: string; peakStyle: PeakStyle }>> = {
  'castle-day': { nearColor: '#5f6478', farColor: '#aebfd4', peakStyle: 'snow' },
  'castle-night': { nearColor: '#181425', farColor: '#3a2f57', peakStyle: 'none' },
  'volcanic-rift': { nearColor: '#241512', farColor: '#5c2b20', peakStyle: 'lava' },
};

// Só os dois cenários de castelo têm muralha — a fenda vulcânica é um campo
// aberto cercado só pelos picos ao longe, e o campo de futebol tem
// arquibancadas no lugar (ver `Environment`).
const SCENARIO_WALLS: Partial<Record<Scenario, { brickColors: string[]; mortarColor: string }>> = {
  'castle-day': { brickColors: ['#b3552f', '#a44a28', '#c05e37', '#9c4322'], mortarColor: '#c7bda8' },
  'castle-night': { brickColors: ['#332a4d', '#2b2440', '#3d3459', '#251e38'], mortarColor: '#4a4166' },
};

/**
 * Quatro cenários procedurais (sem trocar tema de peça/tabuleiro, ver
 * `useSettingsStore.scenario`): balcão de castelo ao meio-dia (padrão),
 * cerco noturno, fenda vulcânica e campo de futebol — céu, chão e o que quer
 * que cerque o tabuleiro (muralha, picos ou arquibancada) trocam de
 * paleta/textura/estrutura; a luz principal fica em `Scene.tsx`, que lê o
 * mesmo `scenario`. Entirely procedural — no external assets.
 */
export function Environment() {
  const quality = useSettingsStore((s) => s.quality);
  const scenario = useSettingsStore((s) => s.scenario);
  const isNight = scenario === 'castle-night';
  const isVolcanic = scenario === 'volcanic-rift';
  const isFootball = scenario === 'football-pitch';
  const motesCount = QUALITY_PRESETS[quality].ambientMotes;
  const sky = SCENARIO_SKY[scenario];
  const mountains = SCENARIO_MOUNTAINS[scenario];
  const walls = SCENARIO_WALLS[scenario];

  const groundTexture = useMemo(() => makeGrassTexture(60, 60), []);
  const obsidianTextures = useMemo(() => makeObsidianTextures(60, 60), []);
  const turfTexture = useMemo(() => makeTurfTexture(60, 60), []);

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
        {isVolcanic ? (
          <meshStandardMaterial
            map={obsidianTextures.map}
            emissiveMap={obsidianTextures.emissiveMap}
            emissive="#ffffff"
            emissiveIntensity={1.6}
            roughness={0.9}
            metalness={0.1}
          />
        ) : isFootball ? (
          <meshStandardMaterial map={turfTexture} roughness={0.9} metalness={0} />
        ) : (
          <meshStandardMaterial map={groundTexture} roughness={0.95} metalness={0.05} />
        )}
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
      {isVolcanic && <Embers count={Math.round(60 * (motesCount > 0 ? 1 : 0.5))} />}
      {/* `key` força remontar (chaves distintas por componente — repetir a
          mesma entre irmãos, mesmo de tipos diferentes, dispara o aviso de
          "two children with the same key" do React): leem a paleta só uma
          vez, no `useState`/`useMemo` inicial, então trocar de cenário em
          tempo real não bastaria mudar as props. */}
      {mountains && (
        <Mountains
          key={`mountains-${scenario}`}
          nearColor={mountains.nearColor}
          farColor={mountains.farColor}
          peakStyle={mountains.peakStyle}
        />
      )}
      {walls && <CastleWalls key={`walls-${scenario}`} brickColors={[...walls.brickColors]} mortarColor={walls.mortarColor} />}
      {isFootball && <StadiumStands />}
      <pointLight position={[0, 3, 6]} color="#ffb454" intensity={isNight || isVolcanic ? 0.35 : 0.2} distance={12} />
      <pointLight position={[0, 3, -6]} color="#8e2de2" intensity={isNight || isVolcanic ? 0.4 : 0.2} distance={12} />
      {motesCount > 0 && <AmbientMotes count={motesCount} />}
    </>
  );
}
