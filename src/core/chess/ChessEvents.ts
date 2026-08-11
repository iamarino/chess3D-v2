import type { ChessPiece, Move, MoveResult, PieceColor, Square } from './types';

export interface GameEventMap {
  'piece-selected': { piece: ChessPiece; legalMoves: Move[] };
  'piece-deselected': { square: Square };
  'piece-moved': { move: Move; result: MoveResult; isRemote: boolean };
  'piece-captured': { attacker: ChessPiece | null; defender: ChessPiece; from: Square; to: Square };
  'promotion-pending': { from: Square; to: Square; color: PieceColor };
  check: { color: PieceColor };
  checkmate: { winner: PieceColor };
  stalemate: Record<string, never>;
  draw: Record<string, never>;
  'game-over': { reason: 'checkmate' | 'stalemate' | 'draw'; winner: PieceColor | null };
  'turn-changed': { turn: PieceColor };
  'state-reset': Record<string, never>;
}

export type GameEventName = keyof GameEventMap;
