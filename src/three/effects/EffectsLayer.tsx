'use client';

import { useCallback, useEffect, useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { QUALITY_PRESETS, useSettingsStore } from '@/store/useSettingsStore';
import { heroesVillainsTheme } from '@/themes/heroes-villains/theme';
import { squareToPosition } from '../boardUtils';
import { ParticleBurst } from './ParticleBurst';

const theme = heroesVillainsTheme;

interface BurstConfig {
  id: number;
  position: [number, number, number];
  color: string;
  count: number;
  spread: number;
  duration: number;
}

let burstSeq = 0;

/** Subscribes to game events and spawns/reaps particle bursts for captures and checkmate. */
export function EffectsLayer() {
  const manager = useGameStore((s) => s.manager);
  const quality = useSettingsStore((s) => s.quality);
  const particleMultiplier = QUALITY_PRESETS[quality].particleMultiplier;
  const [bursts, setBursts] = useState<BurstConfig[]>([]);

  const addBurst = useCallback(
    (config: Omit<BurstConfig, 'id'>) => {
      burstSeq += 1;
      const count = Math.max(4, Math.round(config.count * particleMultiplier));
      setBursts((prev) => [...prev, { ...config, count, id: burstSeq }]);
    },
    [particleMultiplier],
  );

  const removeBurst = useCallback((id: number) => {
    setBursts((prev) => prev.filter((b) => b.id !== id));
  }, []);

  useEffect(() => {
    const offCaptured = manager.events.on('piece-captured', ({ defender, to }) => {
      addBurst({
        position: squareToPosition(to),
        color: theme.pieces[defender.color].accentColor,
        count: 22,
        spread: 1.8,
        duration: 0.9,
      });
    });

    const offCheckmate = manager.events.on('checkmate', ({ winner }) => {
      const state = manager.getState();
      const loserColor = winner === 'hero' ? 'villain' : 'hero';
      const defeatedKing = state.pieces.find((p) => p.type === 'king' && p.color === loserColor);
      const winnerKing = state.pieces.find((p) => p.type === 'king' && p.color === winner);

      if (defeatedKing) {
        addBurst({
          position: squareToPosition(defeatedKing.square),
          color: theme.pieces[loserColor].accentColor,
          count: 48,
          spread: 2.6,
          duration: 1.6,
        });
      }
      if (winnerKing) {
        addBurst({
          position: squareToPosition(winnerKing.square),
          color: theme.pieces[winner].accentColor,
          count: 40,
          spread: 2.2,
          duration: 1.8,
        });
      }
    });

    return () => {
      offCaptured();
      offCheckmate();
    };
  }, [manager, addBurst]);

  return (
    <>
      {bursts.map((burst) => (
        <ParticleBurst
          key={burst.id}
          position={burst.position}
          color={burst.color}
          count={burst.count}
          spread={burst.spread}
          duration={burst.duration}
          onDone={() => removeBurst(burst.id)}
        />
      ))}
    </>
  );
}
