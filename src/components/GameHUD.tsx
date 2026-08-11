'use client';

import { useGameStore } from '@/store/useGameStore';
import { useNetworkStore } from '@/store/useNetworkStore';
import { audioManager } from '@/three/AudioManager';

function MoveHistory() {
  const history = useGameStore((s) => s.state.history);

  if (history.length === 0) return null;

  const pairs: [string, string | undefined][] = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push([history[i], history[i + 1]]);
  }

  return (
    <div className="pointer-events-auto max-h-40 w-40 overflow-y-auto rounded-lg bg-white/5 p-2 text-xs backdrop-blur">
      {pairs.map(([heroMove, villainMove], i) => (
        <div key={i} className="flex justify-between gap-2 text-zinc-300">
          <span className="text-zinc-500">{i + 1}.</span>
          <span className="flex-1 text-amber-200">{heroMove}</span>
          <span className="flex-1 text-purple-200">{villainMove ?? ''}</span>
        </div>
      ))}
    </div>
  );
}

export function GameHUD() {
  const turn = useGameStore((s) => s.state.turn);
  const check = useGameStore((s) => s.state.check);
  const checkmate = useGameStore((s) => s.state.checkmate);
  const stalemate = useGameStore((s) => s.state.stalemate);
  const draw = useGameStore((s) => s.state.draw);
  const historyLength = useGameStore((s) => s.state.history.length);
  const undo = useGameStore((s) => s.undo);
  const reset = useGameStore((s) => s.reset);
  const networkStatus = useNetworkStore((s) => s.status);
  const roomId = useNetworkStore((s) => s.roomId);
  const myColor = useNetworkStore((s) => s.myColor);

  const isOnline = networkStatus === 'matched';
  const gameOverLabel = checkmate ? 'XEQUE-MATE' : stalemate || draw ? 'EMPATE' : null;
  const turnLabel = isOnline ? (myColor === turn ? 'Sua vez' : 'Vez do adversário') : null;
  const isGameOver = Boolean(checkmate || stalemate || draw);

  const withButtonSound = (action: () => void) => () => {
    audioManager.play('button');
    action();
  };

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
          {!isGameOver && (
            <span
              className={
                'rounded-full px-5 py-2 text-base font-bold normal-case tracking-normal backdrop-blur animate-pulse shadow-lg ' +
                (turn === 'hero'
                  ? 'bg-amber-400/25 text-amber-300 ring-2 ring-amber-400/60'
                  : 'bg-purple-400/25 text-purple-300 ring-2 ring-purple-400/60')
              }
            >
              Vez dos {turn === 'hero' ? 'Heróis' : 'Vilões'}
            </span>
          )}
          <MoveHistory />
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

      <div className="pointer-events-auto flex justify-end">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={withButtonSound(undo)}
            disabled={historyLength === 0 || isOnline}
            className="rounded-full bg-white/10 px-4 py-2 text-sm backdrop-blur transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Desfazer
          </button>
          <button
            type="button"
            onClick={withButtonSound(reset)}
            disabled={isOnline}
            className="rounded-full bg-white/10 px-4 py-2 text-sm backdrop-blur transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reiniciar
          </button>
        </div>
      </div>
    </div>
  );
}
