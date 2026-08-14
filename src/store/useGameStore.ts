import { create } from 'zustand';
import { applyMovePatch } from '@/core/chess/applyMovePatch';
import { GameManager } from '@/core/game/GameManager';
import type { ChessPiece, GameState, Move, PieceColor, PieceType, Square } from '@/core/chess/types';
import { getModelConfig } from '@/three/ModelLoader';

interface LastMove {
  from: Square;
  to: Square;
}

interface PendingPromotion {
  from: Square;
  to: Square;
  color: PieceColor;
}

/** Quem capturou quem no lance mais recente — dispara o ataque de quem capturou. */
interface LastCapture {
  attackerId: string | null;
  defenderId: string;
}

/**
 * Peça que acabou de ser capturada, mantida viva na cena só para tocar a
 * animação de queda antes de sumir de vez — `manager.getState()` já não a
 * inclui mais em `pieces`, então sem isso ela desapareceria no mesmo quadro
 * em que é capturada.
 */
export interface CapturedGhost {
  ghostId: string;
  piece: ChessPiece;
}

interface GameStore {
  manager: GameManager;
  state: GameState;
  selectedSquare: Square | null;
  legalMoves: Move[];
  lastMove: LastMove | null;
  lastCapture: LastCapture | null;
  capturedGhosts: CapturedGhost[];
  /**
   * Fantasma da peça capturada por um atacante com golpe (chute) — segue
   * fora de `capturedGhosts` (então `GhostPiece` ainda não monta e não cai)
   * até `Piece` liberar via `releasePendingGhost`, no instante em que o golpe
   * termina. Sem isso a queda começaria no mesmo quadro da captura, antes do
   * chute ter acontecido.
   */
  pendingGhost: CapturedGhost | null;
  pendingPromotion: PendingPromotion | null;
  select: (square: Square) => void;
  promote: (type: PieceType) => void;
  undo: () => void;
  reset: () => void;
  removeGhost: (ghostId: string) => void;
  releasePendingGhost: () => void;
}

export const useGameStore = create<GameStore>((set) => {
  const manager = new GameManager();

  manager.events.on('piece-selected', ({ legalMoves }) => {
    set({ selectedSquare: manager.selectedSquare, legalMoves });
  });

  manager.events.on('piece-deselected', () => {
    set({ selectedSquare: null, legalMoves: [] });
  });

  manager.events.on('piece-moved', ({ move, result }) => {
    set((s) => ({
      state: applyMovePatch(s.state, result),
      selectedSquare: null,
      legalMoves: [],
      lastMove: { from: move.from, to: move.to },
      // Só fica populado se o 'piece-captured' do mesmo lance (emitido logo
      // em seguida, ainda neste tick) sobrescrever — todo lance começa
      // assumindo que não foi captura.
      lastCapture: null,
      pendingPromotion: null,
    }));
  });

  manager.events.on('piece-captured', ({ attacker, defender }) => {
    const hasFallAnimation = !!getModelConfig(defender.color, defender.type).hitClip;
    // Quando quem capturou tem golpe, a queda espera o chute terminar — ver
    // `pendingGhost`. Sem golpe, cai no mesmo quadro da captura, como antes.
    const attackerHasKick = !!attacker && !!getModelConfig(attacker.color, attacker.type).attackClip;
    // Fantasma para peças com animação de queda — e também para as sem queda
    // quando quem captura tem golpe. Sem esse segundo caso o defensor sumiria
    // no quadro do lance, ou seja antes do chute, e o golpe acertaria uma casa
    // já vazia (era o que acontecia com o peão herói, que não tem `hitClip`).
    // Sem `hitClip` o fantasma é só a peça de pé: `GhostPiece` não acha clipe
    // de queda e se remove no ato — mas só depois de `releasePendingGhost`, ou
    // seja no instante em que o chute conecta.
    const ghost: CapturedGhost | null =
      hasFallAnimation || attackerHasKick
        ? { ghostId: `${defender.id}-${Date.now()}`, piece: defender }
        : null;

    set((s) => ({
      lastCapture: { attackerId: attacker?.id ?? null, defenderId: defender.id },
      ...(attackerHasKick
        ? { pendingGhost: ghost }
        : { capturedGhosts: ghost ? [...s.capturedGhosts, ghost] : s.capturedGhosts }),
    }));
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
      lastCapture: null,
      capturedGhosts: [],
      pendingGhost: null,
      pendingPromotion: null,
    });
  });

  return {
    manager,
    state: manager.getState(),
    selectedSquare: null,
    legalMoves: [],
    lastMove: null,
    lastCapture: null,
    capturedGhosts: [],
    pendingGhost: null,
    pendingPromotion: null,
    select: (square) => manager.selectSquare(square),
    promote: (type) => manager.promotePawn(type),
    undo: () => manager.undo(),
    reset: () => manager.reset(),
    removeGhost: (ghostId) => set((s) => ({ capturedGhosts: s.capturedGhosts.filter((g) => g.ghostId !== ghostId) })),
    releasePendingGhost: () =>
      set((s) => (s.pendingGhost ? { capturedGhosts: [...s.capturedGhosts, s.pendingGhost], pendingGhost: null } : {})),
  };
});
