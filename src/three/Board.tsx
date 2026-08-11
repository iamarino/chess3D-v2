'use client';

import { useMemo, useState } from 'react';
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
  const scheme = getBoardScheme(boardSchemeId);
  const [hoveredSquare, setHoveredSquare] = useState<string | null>(null);

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

  return (
    <group>
      {squares.map(({ square, isLight }) => {
        const [x, , z] = squareToPosition(square);
        const isSelected = square === selectedSquare;
        const isLegal = legalTargets.has(square);
        const isCaptureTarget = isLegal && occupiedSquares.has(square);
        const isLastMove = lastMove !== null && (lastMove.from === square || lastMove.to === square);
        const isHovered = square === hoveredSquare;

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
              <meshStandardMaterial color={color} roughness={0.75} metalness={0.05} />
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
