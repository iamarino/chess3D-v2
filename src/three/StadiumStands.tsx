'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PLINTH_HALF } from './BoardBase';
import { SoccerGoal } from './SoccerGoal';

// "Torcida" — pontinhos coloridos aleatórios sobre um fundo cinza de concreto,
// mesma receita pixelada da grama/muralha: sem rostos/figuras, só a impressão
// de multidão vista de longe.
const CROWD_BG = '#5a5f68';
const CROWD_DOT_COLORS = ['#e8433f', '#f2c230', '#3d7fd6', '#e8e8e8', '#2fa35a', '#e88a30'];
const CROWD_PX = 8;
const CROWD_GRID = 16;
const CROWD_DOT_CHANCE = 0.4;

let sharedCrowdCanvas: HTMLCanvasElement | null = null;

function getCrowdCanvas(): HTMLCanvasElement {
  if (sharedCrowdCanvas) return sharedCrowdCanvas;

  const size = CROWD_PX * CROWD_GRID;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = CROWD_BG;
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < CROWD_GRID; y++) {
    for (let x = 0; x < CROWD_GRID; x++) {
      if (Math.random() > CROWD_DOT_CHANCE) continue;
      ctx.fillStyle = CROWD_DOT_COLORS[Math.floor(Math.random() * CROWD_DOT_COLORS.length)];
      ctx.fillRect(x * CROWD_PX, y * CROWD_PX, CROWD_PX, CROWD_PX);
    }
  }

  sharedCrowdCanvas = canvas;
  return canvas;
}

function makeCrowdTexture(worldWidth: number, worldHeight: number): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(getCrowdCanvas());
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.repeat.set(worldWidth / 1.4, worldHeight / 1.4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface StandProps {
  position: [number, number, number];
  rotationY: number;
  length: number;
}

/** One tiered concrete stand facing the pitch, three rising rows with a crowd-speckled face. */
function Stand({ position, rotationY, length }: StandProps) {
  const crowdTexture = useMemo(() => makeCrowdTexture(length, 1), []);
  const tiers = 3;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {Array.from({ length: tiers }, (_, i) => {
        const height = 1.1 + i * 0.9;
        const depth = 1.6;
        const z = -i * depth * 0.55;
        const y = height / 2;
        return (
          <mesh key={i} position={[0, y, z]} castShadow receiveShadow>
            <boxGeometry args={[length, height, depth]} />
            <meshStandardMaterial map={i === 0 ? crowdTexture : undefined} color={i === 0 ? undefined : '#71767e'} roughness={0.9} flatShading />
          </mesh>
        );
      })}
    </group>
  );
}

interface FloodlightProps {
  position: [number, number, number];
}

/** Tall pole topped with a bank of bright fixtures — the pitch's main light source besides the sun. */
function Floodlight({ position }: FloodlightProps) {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (!lightRef.current) return;
    // Leve cintilação, bem mais sutil que uma tocha — refletor elétrico, não fogo.
    const flicker = Math.sin(state.clock.elapsedTime * 19) * 0.03;
    lightRef.current.intensity = 1.4 + flicker;
  });

  return (
    <group position={position}>
      <mesh castShadow position={[0, 3, 0]}>
        <cylinderGeometry args={[0.09, 0.13, 6, 8]} />
        <meshStandardMaterial color="#3a3d42" roughness={0.6} metalness={0.5} />
      </mesh>
      <mesh position={[0, 6, 0]} castShadow>
        <boxGeometry args={[1.3, 0.14, 0.5]} />
        <meshStandardMaterial color="#26282c" roughness={0.5} metalness={0.6} />
      </mesh>
      {[-0.45, 0, 0.45].map((x) => (
        <mesh key={x} position={[x, 5.9, 0.12]}>
          <boxGeometry args={[0.32, 0.22, 0.05]} />
          <meshBasicMaterial color="#fffbe8" />
        </mesh>
      ))}
      <pointLight ref={lightRef} position={[0, 5.85, 0.6]} color="#fdf6df" intensity={1.4} distance={14} />
    </group>
  );
}

// As arquibancadas dos lados (touchline) ficam coladas perto do tabuleiro,
// mas as de trás de cada time (linha de fundo) precisam de mais distância —
// é ali que entram a trave, a rede e a pequena área (`SoccerGoal`), que não
// cabem no espaço apertado que bastava só pra arquibancada.
const STAND_SIDE_DIST = 9;
const STAND_GOAL_END_DIST = 13;
const STAND_LENGTH = 15;
const FLOODLIGHT_DIST = 10.5;
const GOAL_DIST = 7.6;

// Nível real da grama (mesmo Y do círculo de chão em `Environment.tsx`) —
// sem isso, arquibancada/trave/linhas ficam com base em y=0 e flutuam acima
// do gramado visível, que fica mais baixo.
const GROUND_Y = -0.58;

// Contorno do campo: mesma receita de linha branca fina da pequena área em
// `SoccerGoal.tsx`. As linhas de gol ficam na mesma profundidade `GOAL_DIST`
// da trave (passando por baixo do travessão) e terminam bem antes da
// arquibancada lateral (`STAND_SIDE_DIST`); as linhas laterais fecham o
// retângulo ligando as duas linhas de gol.
const PITCH_LINE_WIDTH = 0.08;
const PITCH_LINE_Y = GROUND_Y + 0.015;
const PITCH_HALF_WIDTH = 6.5;
const PITCH_LINE_MATERIAL = <meshStandardMaterial color="#f5f5f0" roughness={0.7} />;

/** Retângulo branco do campo: duas linhas de gol + duas linhas laterais. */
function PitchBoundary() {
  return (
    <>
      <mesh position={[0, PITCH_LINE_Y, GOAL_DIST]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[PITCH_HALF_WIDTH * 2, PITCH_LINE_WIDTH]} />
        {PITCH_LINE_MATERIAL}
      </mesh>
      <mesh position={[0, PITCH_LINE_Y, -GOAL_DIST]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[PITCH_HALF_WIDTH * 2, PITCH_LINE_WIDTH]} />
        {PITCH_LINE_MATERIAL}
      </mesh>
      <mesh position={[PITCH_HALF_WIDTH, PITCH_LINE_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[PITCH_LINE_WIDTH, GOAL_DIST * 2]} />
        {PITCH_LINE_MATERIAL}
      </mesh>
      <mesh position={[-PITCH_HALF_WIDTH, PITCH_LINE_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[PITCH_LINE_WIDTH, GOAL_DIST * 2]} />
        {PITCH_LINE_MATERIAL}
      </mesh>
      {/* linha do meio de campo, ligando as duas linhas laterais — interrompida
          nas bordas do plinto do tabuleiro (`PLINTH_HALF`) pra passar por
          baixo dele em vez de ser desenhada por cima. */}
      {[1, -1].map((side) => {
        const length = PITCH_HALF_WIDTH - PLINTH_HALF;
        return (
          <mesh
            key={side}
            position={[side * (PLINTH_HALF + length / 2), PITCH_LINE_Y, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[length, PITCH_LINE_WIDTH]} />
            {PITCH_LINE_MATERIAL}
          </mesh>
        );
      })}
    </>
  );
}

/**
 * Arquibancadas + torres de refletor + traves de gol em volta do tabuleiro —
 * substitui as montanhas/muralha dos cenários de castelo no "Campo de
 * Futebol" (`Environment.tsx`), sem nenhuma peça/rocha medieval à vista.
 */
export function StadiumStands() {
  return (
    <>
      <Stand position={[0, GROUND_Y, STAND_GOAL_END_DIST]} rotationY={0} length={STAND_LENGTH} />
      <Stand position={[0, GROUND_Y, -STAND_GOAL_END_DIST]} rotationY={Math.PI} length={STAND_LENGTH} />
      <Stand position={[STAND_SIDE_DIST, GROUND_Y, 0]} rotationY={-Math.PI / 2} length={STAND_LENGTH} />
      <Stand position={[-STAND_SIDE_DIST, GROUND_Y, 0]} rotationY={Math.PI / 2} length={STAND_LENGTH} />
      <SoccerGoal position={[0, GROUND_Y, GOAL_DIST]} rotationY={0} />
      <SoccerGoal position={[0, GROUND_Y, -GOAL_DIST]} rotationY={Math.PI} />
      <PitchBoundary />
      <Floodlight position={[FLOODLIGHT_DIST, GROUND_Y, FLOODLIGHT_DIST]} />
      <Floodlight position={[-FLOODLIGHT_DIST, GROUND_Y, FLOODLIGHT_DIST]} />
      <Floodlight position={[FLOODLIGHT_DIST, GROUND_Y, -FLOODLIGHT_DIST]} />
      <Floodlight position={[-FLOODLIGHT_DIST, GROUND_Y, -FLOODLIGHT_DIST]} />
    </>
  );
}
