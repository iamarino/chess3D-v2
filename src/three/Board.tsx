'use client';

import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '@/store/useGameStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { getBoardScheme } from '@/themes/boardSchemes';
import { FILES, RANKS, squareToPosition } from './boardUtils';

interface SquareInfo {
  square: string;
  isLight: boolean;
}

export function Board() {
  const select = useGameStore((s) => s.select);
  const selectedSquare = useGameStore((s) => s.selectedSquare);
  const legalMoves = useGameStore((s) => s.legalMoves);
  const lastMove = useGameStore((s) => s.lastMove);
  const pieces = useGameStore((s) => s.state.pieces);
  const boardSchemeId = useSettingsStore((s) => s.boardScheme);
  const showLegalMoves = useSettingsStore((s) => s.showLegalMoves);
  const discoFloor = useSettingsStore((s) => s.discoFloor);
  const scheme = getBoardScheme(boardSchemeId);
  const [hoveredSquare, setHoveredSquare] = useState<string | null>(null);
  // Casas piscando por frame não podem passar por state do React (64 setState
  // por frame): os materiais ficam num ref, mutados direto no useFrame.
  const discoMaterials = useRef(new Map<string, THREE.MeshStandardMaterial>());

  const squares = useMemo<SquareInfo[]>(() => {
    const list: SquareInfo[] = [];
    FILES.forEach((file, fi) => {
      RANKS.forEach((rank, ri) => {
        list.push({ square: `${file}${rank}`, isLight: (fi + ri) % 2 === 0 });
      });
    });
    return list;
  }, []);

  const occupiedSquares = useMemo(() => new Set(pieces.map((p) => p.square)), [pieces]);
  const legalTargets = useMemo(() => new Set(legalMoves.map((m) => m.to)), [legalMoves]);

  useFrame((state) => {
    if (!discoFloor) return;
    const t = state.clock.elapsedTime;
    squares.forEach(({ square }, index) => {
      // Casas selecionada/última jogada/hover mantêm sua cor de destaque
      // parada — sem isso a sinalização de jogo se perde na luz piscando.
      const isHighlighted =
        square === selectedSquare ||
        square === hoveredSquare ||
        (lastMove !== null && (lastMove.from === square || lastMove.to === square));
      if (isHighlighted) return;
      const material = discoMaterials.current.get(square);
      if (!material) return;
      const hue = (t * 0.12 + index * 0.06) % 1;
      material.color.setHSL(hue, 0.8, 0.5);
      material.emissive.setHSL(hue, 0.9, 0.4);
    });
  });

  return (
    <group>
      {squares.map(({ square, isLight }) => {
        const [x, , z] = squareToPosition(square);
        const isSelected = square === selectedSquare;
        const isLegal = legalTargets.has(square);
        const isCaptureTarget = isLegal && occupiedSquares.has(square);
        const isLastMove = lastMove !== null && (lastMove.from === square || lastMove.to === square);
        const isHovered = square === hoveredSquare;
        const isHighlighted = isSelected || isLastMove || isHovered;

        let color = isLight ? scheme.lightSquareColor : scheme.darkSquareColor;
        if (isSelected) color = '#f2c94c';
        else if (isLastMove) color = isLight ? '#c9dfb0' : '#4a6b3a';
        else if (isHovered) color = isLight ? '#fff2c9' : '#7a5638';

        return (
          <group key={square}>
            <mesh
              position={[x, -0.03, z]}
              receiveShadow
              onClick={(event) => {
                event.stopPropagation();
                select(square);
              }}
              onPointerOver={(event) => {
                event.stopPropagation();
                setHoveredSquare(square);
              }}
              onPointerOut={() =>
                setHoveredSquare((current) => (current === square ? null : current))
              }
            >
              <boxGeometry args={[0.98, 0.06, 0.98]} />
              <meshStandardMaterial
                ref={(material) => {
                  if (material) discoMaterials.current.set(square, material);
                  else discoMaterials.current.delete(square);
                }}
                color={color}
                roughness={0.75}
                metalness={0.05}
                emissive={discoFloor && !isHighlighted ? color : '#000000'}
                emissiveIntensity={discoFloor && !isHighlighted ? 0.6 : 0}
              />
            </mesh>
            {showLegalMoves && isLegal && !isCaptureTarget && (
              <mesh position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.28, 0.36, 32]} />
                <meshStandardMaterial color="#2ecc71" transparent opacity={0.85} depthWrite={false} />
              </mesh>
            )}
            {showLegalMoves && isCaptureTarget && (
              <mesh position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.34, 0.46, 4]} />
                <meshStandardMaterial color="#ff5545" transparent opacity={0.9} depthWrite={false} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
