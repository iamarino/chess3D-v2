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
