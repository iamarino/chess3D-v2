import { Chess } from 'chess.js';
import type { Color, PieceSymbol, Square as ChessJsSquare } from 'chess.js';
import type { ChessPiece, GameState, Move, MoveResult, PieceColor, PieceType, Square } from './types';

const PIECE_TYPE_MAP: Record<PieceSymbol, PieceType> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

const PIECE_TYPE_REVERSE: Record<PieceType, PieceSymbol> = {
  pawn: 'p',
  knight: 'n',
  bishop: 'b',
  rook: 'r',
  queen: 'q',
  king: 'k',
};

function colorToPieceColor(color: Color): PieceColor {
  return color === 'w' ? 'hero' : 'villain';
}

function opposite(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

/**
 * Wraps chess.js to provide a clean, theme-agnostic API and to maintain
 * stable piece ids across moves (chess.js only exposes board-by-square).
 * Stable ids let the visual layer animate a piece instead of remounting it.
 */
export class ChessEngine {
  private chess = new Chess();
  private squareToId = new Map<string, string>();
  private idCounter = 0;
  private idHistory: [string, string][][] = [];

  constructor() {
    this.assignInitialIds();
  }

  private assignInitialIds(): void {
    this.squareToId.clear();
    this.chess.board().forEach((row) => {
      row.forEach((cell) => {
        if (cell) {
          this.squareToId.set(cell.square, this.nextId());
        }
      });
    });
  }

  private nextId(): string {
    this.idCounter += 1;
    return `piece-${this.idCounter}`;
  }

  getLegalMoves(square: Square): Move[] {
    const moves = this.chess.moves({ square: square as ChessJsSquare, verbose: true });
    return moves.map((m) => ({
      from: m.from,
      to: m.to,
      promotion: m.promotion ? PIECE_TYPE_MAP[m.promotion] : undefined,
    }));
  }

  move(from: Square, to: Square, promotion?: PieceType): MoveResult {
    let result;
    try {
      result = this.chess.move({
        from,
        to,
        promotion: promotion ? PIECE_TYPE_REVERSE[promotion] : undefined,
      });
    } catch {
      return {
        valid: false,
        move: null,
        capturedPiece: null,
        check: false,
        checkmate: false,
        stalemate: false,
        draw: false,
        promotion: false,
        san: null,
      };
    }

    this.idHistory.push(Array.from(this.squareToId.entries()));

    let capturedPiece: ChessPiece | null = null;
    if (result.isEnPassant()) {
      const capturedSquare = `${to[0]}${from[1]}`;
      const capturedId = this.squareToId.get(capturedSquare);
      if (capturedId && result.captured) {
        capturedPiece = {
          id: capturedId,
          type: PIECE_TYPE_MAP[result.captured],
          color: colorToPieceColor(opposite(result.color)),
          square: capturedSquare,
        };
      }
      this.squareToId.delete(capturedSquare);
    } else if (result.isCapture()) {
      const capturedId = this.squareToId.get(to);
      if (capturedId && result.captured) {
        capturedPiece = {
          id: capturedId,
          type: PIECE_TYPE_MAP[result.captured],
          color: colorToPieceColor(opposite(result.color)),
          square: to,
        };
      }
      this.squareToId.delete(to);
    }

    const movingId = this.squareToId.get(from);
    this.squareToId.delete(from);
    if (movingId) this.squareToId.set(to, movingId);

    if (result.isKingsideCastle() || result.isQueensideCastle()) {
      const rank = from[1];
      const rookFrom = result.isKingsideCastle() ? `h${rank}` : `a${rank}`;
      const rookTo = result.isKingsideCastle() ? `f${rank}` : `d${rank}`;
      const rookId = this.squareToId.get(rookFrom);
      this.squareToId.delete(rookFrom);
      if (rookId) this.squareToId.set(rookTo, rookId);
    }

    return {
      valid: true,
      move: { from, to, promotion },
      capturedPiece,
      check: this.chess.isCheck(),
      checkmate: this.chess.isCheckmate(),
      stalemate: this.chess.isStalemate(),
      draw: this.chess.isDraw(),
      promotion: result.isPromotion(),
      san: result.san,
    };
  }

  undo(): void {
    this.chess.undo();
    const previous = this.idHistory.pop();
    if (previous) {
      this.squareToId = new Map(previous);
    }
  }

  reset(): void {
    this.chess.reset();
    this.idHistory = [];
    this.idCounter = 0;
    this.assignInitialIds();
  }

  getState(): GameState {
    const pieces: ChessPiece[] = [];
    this.chess.board().forEach((row) => {
      row.forEach((cell) => {
        if (cell) {
          const id = this.squareToId.get(cell.square) ?? this.nextId();
          if (!this.squareToId.has(cell.square)) this.squareToId.set(cell.square, id);
          pieces.push({
            id,
            type: PIECE_TYPE_MAP[cell.type],
            color: colorToPieceColor(cell.color),
            square: cell.square,
          });
        }
      });
    });

    return {
      pieces,
      turn: colorToPieceColor(this.chess.turn()),
      check: this.chess.isCheck(),
      checkmate: this.chess.isCheckmate(),
      stalemate: this.chess.isStalemate(),
      draw: this.chess.isDraw(),
      gameOver: this.chess.isGameOver(),
      history: this.chess.history(),
      fen: this.chess.fen(),
    };
  }
}
