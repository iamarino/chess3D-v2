'use client';

import { useCallback, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { Scene } from '@/three/Scene';

function LoadingOverlay({ visible }: { visible: boolean }) {
  // `useProgress` só serve para o número da porcentagem — quem manda no
  // `visible` é o próprio Scene avisando que as peças já montaram, porque o
  // gerenciador de carregamento do three termina antes do Suspense comitar
  // as peças na cena (a régua ficava sumindo com o tabuleiro ainda vazio).
  const { progress } = useProgress();

  if (!visible) return null;

  const percent = Math.min(100, Math.round(progress));

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/85">
      <div className="h-1 w-48 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-amber-500 transition-[width] duration-200 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs tracking-widest text-zinc-100">Carregando peças… {percent}%</span>
    </div>
  );
}

export function ChessBoard3D() {
  const [piecesReady, setPiecesReady] = useState(false);
  const handlePiecesReady = useCallback(() => setPiecesReady(true), []);

  return (
    <div className="absolute inset-0">
      <Scene onPiecesReady={handlePiecesReady} />
      <LoadingOverlay visible={!piecesReady} />
    </div>
  );
}
