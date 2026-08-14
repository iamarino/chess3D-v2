'use client';

import { useEffect, useRef, useState } from 'react';
import type { PieceColor } from '@/core/chess/types';
import { useGameStore } from '@/store/useGameStore';
import { useNetworkStore } from '@/store/useNetworkStore';

// Tempo entre o xeque-mate e o banner aparecer — dá tempo da última jogada
// (caminhada/golpe) terminar de tocar antes da comemoração começar.
const CELEBRATION_START_DELAY_MS = 1600;
// Quanto tempo o banner (e a dança das peças) ficam na tela antes de sumir.
const CELEBRATION_DURATION_MS = 4200;

const TEAM_LABEL: Record<PieceColor, string> = {
  hero: 'Heróis',
  villain: 'Vilões',
};

/**
 * Reage ao xeque-mate do `GameManager`: depois de um pequeno atraso (para a
 * última jogada terminar de animar), mostra um banner de vitória/derrota e
 * liga `celebrationWinner` no `useGameStore` (que faz as peças com
 * `danceClip` do time vencedor dançarem — ver `Piece.tsx`). Passado o tempo
 * de comemoração, desliga tudo e, só no modo offline, reinicia a partida.
 */
export function CheckmateCelebration() {
  const manager = useGameStore((s) => s.manager);
  const setCelebrationWinner = useGameStore((s) => s.setCelebrationWinner);
  const networkStatus = useNetworkStore((s) => s.status);
  const myColor = useNetworkStore((s) => s.myColor);
  const [banner, setBanner] = useState<PieceColor | null>(null);

  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef(networkStatus);
  useEffect(() => {
    statusRef.current = networkStatus;
  }, [networkStatus]);

  useEffect(() => {
    const clearTimers = () => {
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
      startTimerRef.current = null;
      endTimerRef.current = null;
    };

    const offCheckmate = manager.events.on('checkmate', ({ winner }) => {
      clearTimers();
      startTimerRef.current = setTimeout(() => {
        setBanner(winner);
        setCelebrationWinner(winner);
        endTimerRef.current = setTimeout(() => {
          setBanner(null);
          setCelebrationWinner(null);
          if (statusRef.current === 'offline') manager.reset();
        }, CELEBRATION_DURATION_MS);
      }, CELEBRATION_START_DELAY_MS);
    });

    const offReset = manager.events.on('state-reset', () => {
      clearTimers();
      setBanner(null);
      setCelebrationWinner(null);
    });

    return () => {
      clearTimers();
      offCheckmate();
      offReset();
    };
  }, [manager, setCelebrationWinner]);

  const isOnline = networkStatus === 'matched';
  const isWinner = isOnline && myColor === banner;
  const title = isOnline ? (isWinner ? 'Parabéns, você venceu!!!' : 'Você perdeu!!!') : 'Xeque-mate!';
  const subtitle = banner ? `${TEAM_LABEL[banner]} venceram!!!` : '';

  return (
    <div
      className={
        'pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/50 text-center transition-opacity duration-700 ' +
        (banner ? 'opacity-100' : 'opacity-0')
      }
    >
      <div
        className={
          'transition-all duration-700 ' + (banner ? 'scale-100 opacity-100' : 'scale-90 opacity-0')
        }
      >
        <p
          className={
            'text-5xl font-extrabold tracking-wide drop-shadow-lg sm:text-6xl ' +
            (isWinner || !isOnline
              ? banner === 'hero'
                ? 'text-amber-400'
                : banner === 'villain'
                  ? 'text-purple-400'
                  : 'text-zinc-100'
              : 'text-zinc-300')
          }
        >
          {title}
        </p>
        {subtitle && <p className="mt-3 text-lg font-semibold uppercase tracking-widest text-zinc-200">{subtitle}</p>}
      </div>
    </div>
  );
}
