'use client';

import Image from 'next/image';
import { useGameStore } from '@/store/useGameStore';
import { useNetworkStore } from '@/store/useNetworkStore';

export function GameHUD() {
  const turn = useGameStore((s) => s.state.turn);
  const check = useGameStore((s) => s.state.check);
  const checkmate = useGameStore((s) => s.state.checkmate);
  const stalemate = useGameStore((s) => s.state.stalemate);
  const draw = useGameStore((s) => s.state.draw);
  const networkStatus = useNetworkStore((s) => s.status);
  const roomId = useNetworkStore((s) => s.roomId);
  const myColor = useNetworkStore((s) => s.myColor);

  const isOnline = networkStatus === 'matched';
  const gameOverLabel = checkmate ? 'XEQUE-MATE' : stalemate || draw ? 'EMPATE' : null;
  const turnLabel = isOnline ? (myColor === turn ? 'Sua vez' : 'Vez do adversário') : null;

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between px-20 py-6 text-zinc-100">
      <div className="flex items-start justify-between text-sm font-semibold uppercase tracking-widest">
        <span
          className={
            turn === 'hero'
              ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.7)]'
              : 'text-zinc-500'
          }
        >
          Heróis
        </span>
        <div className="flex flex-col items-center gap-1">
          {isOnline && (
            <span className="pointer-events-auto rounded-full bg-white/5 px-3 py-1 text-[10px] normal-case tracking-normal text-zinc-300 backdrop-blur">
              Sala {roomId} · {turnLabel}
            </span>
          )}
        </div>
        <span
          className={
            turn === 'villain'
              ? 'text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.7)]'
              : 'text-zinc-500'
          }
        >
          Vilões
        </span>
      </div>

      {(check || gameOverLabel) && (
        <div className="self-center text-center">
          <p className="text-2xl font-bold tracking-wide drop-shadow">
            {gameOverLabel ?? 'XEQUE'}
          </p>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-6 right-6 hidden flex-col items-center gap-2 sm:flex">
        <div
          className={
            'relative h-24 w-24 shrink-0 rounded-full ring-4 ring-[#3f7dd6]/70 shadow-[0_0_24px_rgba(63,125,214,0.65)] transition-all duration-500 ' +
            (turn === 'hero' ? 'scale-100 opacity-100' : 'scale-50 opacity-0')
          }
        >
          <Image
            src="/images/hero-turn-portrait.png"
            alt="Vez dos Heróis"
            fill
            sizes="96px"
            className="rounded-full object-cover"
          />
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-6 left-6 hidden flex-col items-center gap-2 sm:flex">
        <div
          className={
            /* Tom medido nos pixels de armadura do cavalo vilão (H 6.1°, S 0.388, L 0.271) — ver ModelLoader.ts */
            'relative h-24 w-24 shrink-0 rounded-full ring-4 ring-[#60302a]/70 shadow-[0_0_24px_rgba(96,48,42,0.65)] transition-all duration-500 ' +
            (turn === 'villain' ? 'scale-100 opacity-100' : 'scale-50 opacity-0')
          }
        >
          <Image
            src="/images/villain-turn-portrait.png"
            alt="Vez dos Vilões"
            fill
            sizes="96px"
            className="rounded-full object-cover"
          />
        </div>
      </div>
    </div>
  );
}
