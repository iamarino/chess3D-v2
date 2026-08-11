import { ChessEngine } from '../chess/ChessEngine';
import type { GameEventMap } from '../chess/ChessEvents';
import type { ChessPiece, GameState, PieceColor, PieceType, Square } from '../chess/types';
import { EventManager } from './EventManager';

interface PendingPromotion {
  from: Square;
  to: Square;
}

/**
 * Orchestrates the chess engine and emits high-level game events.
 * This is the only object the visual layer talks to — it never touches
 * chess.js or Three.js directly, keeping rules and presentation decoupled.
 */
export class GameManager {
  readonly engine = new ChessEngine();
  readonly events = new EventManager<GameEventMap>();
  selectedSquare: Square | null = null;
  pendingPromotion: PendingPromotion | null = null;
  /** Non-null while playing online: restricts local input to this color's turn. */
  localPlayerColor: PieceColor | null = null;

  getState(): GameState {
    return this.engine.getState();
  }

  setLocalPlayerColor(color: PieceColor | null): void {
    this.localPlayerColor = color;
  }

  selectSquare(square: Square): void {
    if (this.pendingPromotion) return;

    const state = this.engine.getState();
    if (this.localPlayerColor && state.turn !== this.localPlayerColor) return;

    const pieceAtSquare = state.pieces.find((p) => p.square === square) ?? null;

    if (this.selectedSquare === square) {
      this.deselect();
      return;
    }

    if (pieceAtSquare && pieceAtSquare.color === state.turn) {
      this.selectedSquare = square;
      const legalMoves = this.engine.getLegalMoves(square);
      this.events.emit('piece-selected', { piece: pieceAtSquare, legalMoves });
      return;
    }

    if (this.selectedSquare) {
      this.tryMove(this.selectedSquare, square);
    }
  }

  private deselect(): void {
    const square = this.selectedSquare;
    this.selectedSquare = null;
    if (square) this.events.emit('piece-deselected', { square });
  }

  private tryMove(from: Square, to: Square): void {
    const legalMoves = this.engine.getLegalMoves(from);
    const candidates = legalMoves.filter((m) => m.to === to);
    this.selectedSquare = null;

    if (candidates.length === 0) {
      this.events.emit('piece-deselected', { square: from });
      return;
    }

    const requiresPromotion = candidates.some((m) => m.promotion);
    if (requiresPromotion) {
      const state = this.engine.getState();
      const piece = state.pieces.find((p) => p.square === from) ?? null;
      this.pendingPromotion = { from, to };
      this.events.emit('promotion-pending', { from, to, color: piece?.color ?? state.turn });
      return;
    }

    this.executeMove(from, to);
  }

  promotePawn(type: PieceType): void {
    if (!this.pendingPromotion) return;
    const { from, to } = this.pendingPromotion;
    this.pendingPromotion = null;
    this.executeMove(from, to, type);
  }

  /** Applies a move that already happened on the remote peer — bypasses turn/color gating. */
  applyRemoteMove(from: Square, to: Square, promotion?: PieceType): void {
    this.executeMove(from, to, promotion, true);
  }

  private executeMove(from: Square, to: Square, promotion?: PieceType, isRemote = false): void {
    const stateBefore = this.engine.getState();
    const attacker: ChessPiece | null = stateBefore.pieces.find((p) => p.square === from) ?? null;

    const result = this.engine.move(from, to, promotion);
    if (!result.valid || !result.move) return;

    this.events.emit('piece-moved', { move: result.move, result, isRemote });

    if (result.capturedPiece) {
      this.events.emit('piece-captured', {
        attacker,
        defender: result.capturedPiece,
        from,
        to,
      });
    }

    const state = this.engine.getState();
    this.events.emit('turn-changed', { turn: state.turn });

    if (result.checkmate && attacker) {
      const winner: PieceColor = attacker.color;
      this.events.emit('checkmate', { winner });
      this.events.emit('game-over', { reason: 'checkmate', winner });
    } else if (result.stalemate) {
      this.events.emit('stalemate', {});
      this.events.emit('game-over', { reason: 'stalemate', winner: null });
    } else if (result.draw) {
      this.events.emit('draw', {});
      this.events.emit('game-over', { reason: 'draw', winner: null });
    } else if (result.check) {
      this.events.emit('check', { color: state.turn });
    }
  }

  undo(): void {
    this.engine.undo();
    this.selectedSquare = null;
    this.pendingPromotion = null;
    this.events.emit('state-reset', {});
  }

  reset(): void {
    this.engine.reset();
    this.selectedSquare = null;
    this.pendingPromotion = null;
    this.events.emit('state-reset', {});
  }
}
