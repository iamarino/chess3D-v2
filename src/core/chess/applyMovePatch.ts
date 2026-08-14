import type { GameState, MoveResult } from './types';

/**
 * Aplica o patch de um lance sobre o estado React existente, preservando
 * referências das peças que não mudaram — evita re-render/remount em massa.
 */
export function applyMovePatch(state: GameState, result: MoveResult): GameState {
  const patch = result.patch;
  if (!patch) return state;

  const removed = new Set(patch.removedPieceIds);
  const updatesById = new Map(patch.pieceUpdates.map((update) => [update.id, update]));

  const pieces = state.pieces
    .filter((piece) => !removed.has(piece.id))
    .map((piece) => {
      const update = updatesById.get(piece.id);
      if (!update) return piece;
      if (update.square === piece.square && (update.type === undefined || update.type === piece.type)) {
        return piece;
      }
      return {
        ...piece,
        square: update.square,
        ...(update.type !== undefined ? { type: update.type } : {}),
      };
    });

  return {
    ...state,
    pieces,
    turn: patch.turn,
    check: result.check,
    checkmate: result.checkmate,
    stalemate: result.stalemate,
    draw: result.draw,
    gameOver: patch.gameOver,
    history: patch.history,
    fen: patch.fen,
  };
}
