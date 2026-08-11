'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { audioManager } from '@/three/AudioManager';

/** Bridges GameManager events to synthesized SFX. No Three.js dependency — lives outside the Canvas. */
export function AudioBridge() {
  const manager = useGameStore((s) => s.manager);
  const muted = useSettingsStore((s) => s.muted);
  const masterVolume = useSettingsStore((s) => s.masterVolume);
  const effectsVolume = useSettingsStore((s) => s.effectsVolume);

  // Mirrors settings (including values rehydrated from localStorage after
  // mount) onto the AudioManager singleton, which owns no React state of its own.
  useEffect(() => {
    audioManager.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    audioManager.setMasterVolume(masterVolume);
  }, [masterVolume]);

  useEffect(() => {
    audioManager.setEffectsVolume(effectsVolume);
  }, [effectsVolume]);

  useEffect(() => {
    const offSelected = manager.events.on('piece-selected', () => audioManager.play('select'));

    const offMoved = manager.events.on('piece-moved', ({ result }) => {
      if (!result.capturedPiece) audioManager.play('move');
    });

    const offCaptured = manager.events.on('piece-captured', () => audioManager.play('capture'));
    const offCheck = manager.events.on('check', () => audioManager.play('check'));
    const offCheckmate = manager.events.on('checkmate', () => audioManager.play('checkmate'));

    return () => {
      offSelected();
      offMoved();
      offCaptured();
      offCheck();
      offCheckmate();
    };
  }, [manager]);

  return null;
}
