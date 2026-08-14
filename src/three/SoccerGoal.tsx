'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

// Rede: linhas brancas diagonais cruzadas sobre fundo transparente — o
// próprio canvas guarda o alfa (só as linhas têm cor, o resto fica limpo/
// transparente), então a mesma textura serve de `map` com `transparent`
// ligado, sem precisar de um alphaMap separado.
const NET_CANVAS_SIZE = 64;
const NET_LINE_SPACING = 8;
const NET_LINE_COLOR = '#f2f2f2';

let sharedNetCanvas: HTMLCanvasElement | null = null;

function getNetCanvas(): HTMLCanvasElement {
  if (sharedNetCanvas) return sharedNetCanvas;

  const size = NET_CANVAS_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = NET_LINE_COLOR;
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.85;

  for (let i = -size; i <= size * 2; i += NET_LINE_SPACING) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i - size, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
  }

  sharedNetCanvas = canvas;
  return canvas;
}

function makeNetTexture(repeatX: number, repeatY: number): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(getNetCanvas());
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const GOAL_HALF_WIDTH = 1.6;
const GOAL_HEIGHT = 1.2;
const POST_THICKNESS = 0.09;
const NET_DEPTH = 0.55;
const BOX_HALF_WIDTH = 2.6;
const BOX_DEPTH = 1.8;
const LINE_WIDTH = 0.08;
const LINE_Y = 0.015;

const POST_MATERIAL = <meshStandardMaterial color="#f5f5f0" roughness={0.4} metalness={0.15} />;
const LINE_MATERIAL = <meshStandardMaterial color="#f5f5f0" roughness={0.7} />;

interface SoccerGoalProps {
  /** Centro da linha de gol, no chão. */
  position: [number, number, number];
  /** 0 = boca do gol olhando para -z (usar quando o gol fica do lado +z); Math.PI = olhando para +z. */
  rotationY: number;
}

/**
 * Trave de futebol (dois postes + travessão + rede) e as linhas brancas da
 * pequena área, atrás de cada time no "Campo de Futebol" (`Environment.tsx`
 * via `StadiumStands`). Construído em espaço local com a boca do gol virada
 * para -z; `rotationY` gira o conjunto pra apontar pro centro do tabuleiro.
 */
export function SoccerGoal({ position, rotationY }: SoccerGoalProps) {
  // Três painéis (fundo, teto, duas laterais) — cada um casado em tamanho e
  // posição com a barra da armação que o sustenta, formando a "caixa" atrás
  // do gol em vez de um painel único flutuando sem apoio.
  const netTextureBack = useMemo(() => makeNetTexture(GOAL_HALF_WIDTH * 2, GOAL_HEIGHT), []);
  const netTextureTop = useMemo(() => makeNetTexture(GOAL_HALF_WIDTH * 2, NET_DEPTH), []);
  const netTextureSide = useMemo(() => makeNetTexture(NET_DEPTH, GOAL_HEIGHT), []);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* postes */}
      <mesh position={[-GOAL_HALF_WIDTH, GOAL_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={[POST_THICKNESS, GOAL_HEIGHT, POST_THICKNESS]} />
        {POST_MATERIAL}
      </mesh>
      <mesh position={[GOAL_HALF_WIDTH, GOAL_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={[POST_THICKNESS, GOAL_HEIGHT, POST_THICKNESS]} />
        {POST_MATERIAL}
      </mesh>
      {/* travessão */}
      <mesh position={[0, GOAL_HEIGHT, 0]} castShadow>
        <boxGeometry args={[GOAL_HALF_WIDTH * 2 + POST_THICKNESS, POST_THICKNESS, POST_THICKNESS]} />
        {POST_MATERIAL}
      </mesh>
      {/* armação traseira em 90° (postes de trás + travessão de trás + duas
          barras de teto ligando a boca do gol até a armação de trás) — forma
          a caixa retangular que a rede cobre nos três painéis abaixo. */}
      <mesh position={[-GOAL_HALF_WIDTH, GOAL_HEIGHT / 2, NET_DEPTH]} castShadow>
        <boxGeometry args={[POST_THICKNESS, GOAL_HEIGHT, POST_THICKNESS]} />
        {POST_MATERIAL}
      </mesh>
      <mesh position={[GOAL_HALF_WIDTH, GOAL_HEIGHT / 2, NET_DEPTH]} castShadow>
        <boxGeometry args={[POST_THICKNESS, GOAL_HEIGHT, POST_THICKNESS]} />
        {POST_MATERIAL}
      </mesh>
      <mesh position={[0, GOAL_HEIGHT, NET_DEPTH]} castShadow>
        <boxGeometry args={[GOAL_HALF_WIDTH * 2 + POST_THICKNESS, POST_THICKNESS, POST_THICKNESS]} />
        {POST_MATERIAL}
      </mesh>
      <mesh position={[-GOAL_HALF_WIDTH, GOAL_HEIGHT, NET_DEPTH / 2]} castShadow>
        <boxGeometry args={[POST_THICKNESS, POST_THICKNESS, NET_DEPTH]} />
        {POST_MATERIAL}
      </mesh>
      <mesh position={[GOAL_HALF_WIDTH, GOAL_HEIGHT, NET_DEPTH / 2]} castShadow>
        <boxGeometry args={[POST_THICKNESS, POST_THICKNESS, NET_DEPTH]} />
        {POST_MATERIAL}
      </mesh>
      {/* rede — fundo (encostado nos postes/travessão de trás) */}
      <mesh position={[0, GOAL_HEIGHT / 2, NET_DEPTH]}>
        <planeGeometry args={[GOAL_HALF_WIDTH * 2, GOAL_HEIGHT]} />
        <meshBasicMaterial map={netTextureBack} transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* rede — teto (entre o travessão da frente e o de trás) */}
      <mesh position={[0, GOAL_HEIGHT, NET_DEPTH / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GOAL_HALF_WIDTH * 2, NET_DEPTH]} />
        <meshBasicMaterial map={netTextureTop} transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* rede — laterais (entre o poste da frente e o de trás, de cada lado) */}
      <mesh position={[-GOAL_HALF_WIDTH, GOAL_HEIGHT / 2, NET_DEPTH / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[NET_DEPTH, GOAL_HEIGHT]} />
        <meshBasicMaterial map={netTextureSide} transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[GOAL_HALF_WIDTH, GOAL_HEIGHT / 2, NET_DEPTH / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[NET_DEPTH, GOAL_HEIGHT]} />
        <meshBasicMaterial map={netTextureSide} transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* linhas brancas da pequena área — três lados (o quarto é a própria linha de gol) */}
      <mesh position={[-BOX_HALF_WIDTH, LINE_Y, -BOX_DEPTH / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[LINE_WIDTH, BOX_DEPTH]} />
        {LINE_MATERIAL}
      </mesh>
      <mesh position={[BOX_HALF_WIDTH, LINE_Y, -BOX_DEPTH / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[LINE_WIDTH, BOX_DEPTH]} />
        {LINE_MATERIAL}
      </mesh>
      <mesh position={[0, LINE_Y, -BOX_DEPTH]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[BOX_HALF_WIDTH * 2, LINE_WIDTH]} />
        {LINE_MATERIAL}
      </mesh>
    </group>
  );
}

