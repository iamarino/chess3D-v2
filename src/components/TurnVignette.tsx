'use client';

import { useGameStore } from '@/store/useGameStore';

/**
 * Borda pulsante nas bordas da tela indicando de quem é a vez — azul para
 * heróis, vermelho para vilões — no estilo do indicador de captura de tela
 * do Chrome.
 */
export function TurnVignette() {
  const turn = useGameStore((s) => s.state.turn);
  const checkmate = useGameStore((s) => s.state.checkmate);
  const stalemate = useGameStore((s) => s.state.stalemate);
  const draw = useGameStore((s) => s.state.draw);

  if (checkmate || stalemate || draw) return null;

  return (
    <div
      aria-hidden
      className={
        'turn-vignette pointer-events-none fixed inset-0 z-40 ' +
        (turn === 'hero' ? 'turn-vignette--hero' : 'turn-vignette--villain')
      }
    />
  );
}
