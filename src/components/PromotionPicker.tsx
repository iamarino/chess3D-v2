'use client';

import { useGameStore } from '@/store/useGameStore';
import type { PieceType } from '@/core/chess/types';

const CHOICES: { type: PieceType; label: string }[] = [
  { type: 'queen', label: 'Rainha' },
  { type: 'rook', label: 'Torre' },
  { type: 'bishop', label: 'Bispo' },
  { type: 'knight', label: 'Cavalo' },
];

export function PromotionPicker() {
  const pendingPromotion = useGameStore((s) => s.pendingPromotion);
  const promote = useGameStore((s) => s.promote);

  if (!pendingPromotion) return null;

  const isHero = pendingPromotion.color === 'hero';

  return (
    <div className="pointer-events-auto absolute inset-0 z-10 flex items-center justify-center bg-black/60">
      <div className="rounded-2xl border border-white/10 bg-zinc-900/95 p-6 text-center shadow-xl">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-300">
          Escolha a promoção
        </p>
        <div className="flex gap-3">
          {CHOICES.map(({ type, label }) => (
            <button
              key={type}
              type="button"
              onClick={() => promote(type)}
              className={`flex h-16 w-16 flex-col items-center justify-center rounded-xl text-xs font-medium transition-colors ${
                isHero
                  ? 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
                  : 'bg-purple-500/20 text-purple-200 hover:bg-purple-500/30'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
