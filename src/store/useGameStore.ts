import { create } from 'zustand';
import { GameManager } from '@/core/game/GameManager';
import type { GameState, Move, PieceColor, PieceType, Square } from '@/core/chess/types';

interface LastMove {
  from: Square;
  to: Square;
}

interface PendingPromotion {
  from: Square;
  to: Square;
  color: PieceColor;
}

interface GameStore {
  manager: GameManager;
  state: GameState;
  selectedSquare: Square | null;
  legalMoves: Move[];
  lastMove: LastMove | null;
  pendingPromotion: PendingPromotion | null;
  select: (square: Square) => void;
  promote: (type: PieceType) => void;
  undo: () => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => {
  const manager = new GameManager();

  manager.events.on('piece-selected', ({ legalMoves }) => {
    set({ selectedSquare: manager.selectedSquare, legalMoves });
  });

  manager.events.on('piece-deselected', () => {
    set({ selectedSquare: null, legalMoves: [] });
  });

  manager.events.on('piece-moved', ({ move }) => {
    set({
      state: manager.getState(),
      selectedSquare: null,
      legalMoves: [],
      lastMove: { from: move.from, to: move.to },
      pendingPromotion: null,
    });
  });

  manager.events.on('promotion-pending', ({ from, to, color }) => {
    set({ selectedSquare: null, legalMoves: [], pendingPromotion: { from, to, color } });
  });

  manager.events.on('state-reset', () => {
    set({
      state: manager.getState(),
      selectedSquare: null,
      legalMoves: [],
      lastMove: null,
      pendingPromotion: null,
    });
  });

  return {
    manager,
    state: manager.getState(),
    selectedSquare: null,
    legalMoves: [],
    lastMove: null,
    pendingPromotion: null,
    select: (square) => manager.selectSquare(square),
    promote: (type) => manager.promotePawn(type),
    undo: () => manager.undo(),
    reset: () => manager.reset(),
  };
});
