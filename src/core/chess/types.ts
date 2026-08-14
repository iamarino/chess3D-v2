export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';

export type PieceColor = 'hero' | 'villain';

export type Square = string;

export interface ChessPiece {
  id: string;
  type: PieceType;
  color: PieceColor;
  square: Square;
}

export interface Move {
  from: Square;
  to: Square;
  promotion?: PieceType;
}

/** Atualização mínima de uma peça após um lance — só id, casa e tipo (promoção). */
export interface PieceUpdate {
  id: string;
  square: Square;
  type?: PieceType;
}

/** Delta do tabuleiro após um lance válido, sem varrer todas as casas. */
export interface MoveStatePatch {
  removedPieceIds: string[];
  pieceUpdates: PieceUpdate[];
  turn: PieceColor;
  gameOver: boolean;
  history: string[];
  fen: string;
}

export interface MoveResult {
  valid: boolean;
  move: Move | null;
  capturedPiece: ChessPiece | null;
  check: boolean;
  checkmate: boolean;
  stalemate: boolean;
  draw: boolean;
  promotion: boolean;
  san: string | null;
  /** Preenchido só quando `valid` — patch incremental para o store React. */
  patch: MoveStatePatch | null;
}

export interface GameState {
  pieces: ChessPiece[];
  turn: PieceColor;
  check: boolean;
  checkmate: boolean;
  stalemate: boolean;
  draw: boolean;
  gameOver: boolean;
  history: string[];
  fen: string;
}
