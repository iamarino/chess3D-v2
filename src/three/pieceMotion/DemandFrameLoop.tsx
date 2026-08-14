'use client';

import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from '@/store/useGameStore';
import {
  hasExternalFrameDemand,
  requestFrame,
  setFrameInvalidate,
} from '../frameInvalidate';
import { pieceMotionManager } from './PieceMotionManager';

/**
 * Com `frameloop="demand"`, só repinta quando algo ainda está se movendo —
 * peças, fantasma, partículas, xeque pulsante ou demanda externa (intro, GSAP).
 */
export function DemandFrameLoop() {
  const invalidate = useThree((s) => s.invalidate);
  const check = useGameStore((s) => s.state.check && !s.state.checkmate);
  const selectedSquare = useGameStore((s) => s.selectedSquare);
  const legalMovesLen = useGameStore((s) => s.legalMoves.length);
  const lastMove = useGameStore((s) => s.lastMove);
  const turn = useGameStore((s) => s.state.turn);

  useEffect(() => {
    setFrameInvalidate(invalidate);
    invalidate();
    return () => setFrameInvalidate(null);
  }, [invalidate]);

  // Uma repintura basta quando a camada React do tabuleiro muda (seleção, jogadas legais).
  useEffect(() => {
    invalidate();
  }, [selectedSquare, legalMovesLen, lastMove, turn, invalidate]);

  useFrame((_, delta) => {
    pieceMotionManager.tick(delta);

    const needsMore =
      pieceMotionManager.needsAnimationFrames() || hasExternalFrameDemand() || check;

    if (needsMore) {
      requestFrame();
    }
  });

  return null;
}
