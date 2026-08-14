'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

// Exportadas — `WallTorches` monta tochas encostadas nesta mesma muralha e
// precisa da distância/altura pra ficar colada nela, não flutuando.
export const WALL_DIST = 8;
const WALL_LENGTH = WALL_DIST * 2;
export const WALL_HEIGHT = 1.1;
const WALL_THICKNESS = 0.5;
const MERLON_SIZE = 0.5;
const MERLON_SPACING = 1;

// Padrão de tijolo estilo Roblox: fileiras alternadas (running bond), juntas
// de argamassa visíveis e cores planas e saturadas — sem PBR realista.
const DEFAULT_BRICK_COLORS = ['#b3552f', '#a44a28', '#c05e37', '#9c4322'];
const DEFAULT_MORTAR_COLOR = '#c7bda8';
const BRICKS_PER_TILE = 4;
const BRICK_PX = 64;
const ROW_PX = 32;
const TILE_WORLD_WIDTH = 2; // 4 tijolos de 0.5 unidade cada
const TILE_WORLD_HEIGHT = 1; // 4 fileiras de 0.25 unidade cada

// Cacheado por paleta (não só um canvas global) pra suportar mais de um
// cenário com muros de cor diferente sem regenerar a cada frame.
const brickCanvasCache = new Map<string, HTMLCanvasElement>();

function getBrickCanvas(brickColors: string[], mortarColor: string): HTMLCanvasElement {
  const key = `${brickColors.join(',')}|${mortarColor}`;
  const cached = brickCanvasCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = BRICK_PX * BRICKS_PER_TILE;
  canvas.height = ROW_PX * BRICKS_PER_TILE;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = mortarColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const mortar = 4;
  for (let row = 0; row < BRICKS_PER_TILE; row++) {
    const offset = row % 2 === 0 ? 0 : -BRICK_PX / 2;
    const y = row * ROW_PX;
    for (let x = offset; x < canvas.width; x += BRICK_PX) {
      const color = brickColors[Math.floor(Math.random() * brickColors.length)];
      const bx = x + mortar / 2;
      const by = y + mortar / 2;
      const bw = BRICK_PX - mortar;
      const bh = ROW_PX - mortar;
      ctx.fillStyle = color;
      ctx.fillRect(bx, by, bw, bh);
      // aresta clara em cima e escura embaixo, pro visual "plástico" blocado
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(bx, by, bw, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(bx, by + bh - 2, bw, 2);
    }
  }

  brickCanvasCache.set(key, canvas);
  return canvas;
}

function makeBrickTexture(worldWidth: number, worldHeight: number, brickColors: string[], mortarColor: string): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(getBrickCanvas(brickColors, mortarColor));
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(worldWidth / TILE_WORLD_WIDTH, worldHeight / TILE_WORLD_HEIGHT);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface WallSegmentProps {
  position: [number, number, number];
  rotationY: number;
  brickColors: string[];
  mortarColor: string;
}

/** One crenellated stretch of parapet: a base wall strip topped with evenly spaced merlon blocks. */
function WallSegment({ position, rotationY, brickColors, mortarColor }: WallSegmentProps) {
  const merlonCount = Math.floor(WALL_LENGTH / MERLON_SPACING);
  const wallTexture = useMemo(() => makeBrickTexture(WALL_LENGTH, WALL_HEIGHT, brickColors, mortarColor), [brickColors, mortarColor]);
  const merlonTexture = useMemo(() => makeBrickTexture(MERLON_SIZE, MERLON_SIZE, brickColors, mortarColor), [brickColors, mortarColor]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, WALL_HEIGHT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[WALL_LENGTH, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial map={wallTexture} roughness={0.85} />
      </mesh>
      {Array.from({ length: merlonCount }, (_, i) => {
        const x = -WALL_LENGTH / 2 + (i + 0.5) * (WALL_LENGTH / merlonCount);
        return (
          <mesh key={i} position={[x, WALL_HEIGHT + MERLON_SIZE / 2, 0]} castShadow>
            <boxGeometry args={[MERLON_SIZE, MERLON_SIZE, WALL_THICKNESS]} />
            <meshStandardMaterial map={merlonTexture} roughness={0.85} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Low crenellated parapet ring around the board — a castle balcony looking out over the mountains. */
export function CastleWalls({
  brickColors = DEFAULT_BRICK_COLORS,
  mortarColor = DEFAULT_MORTAR_COLOR,
}: {
  brickColors?: string[];
  mortarColor?: string;
}) {
  return (
    <>
      <WallSegment position={[0, 0, WALL_DIST]} rotationY={0} brickColors={brickColors} mortarColor={mortarColor} />
      <WallSegment position={[0, 0, -WALL_DIST]} rotationY={0} brickColors={brickColors} mortarColor={mortarColor} />
      <WallSegment position={[WALL_DIST, 0, 0]} rotationY={Math.PI / 2} brickColors={brickColors} mortarColor={mortarColor} />
      <WallSegment position={[-WALL_DIST, 0, 0]} rotationY={Math.PI / 2} brickColors={brickColors} mortarColor={mortarColor} />
    </>
  );
}
