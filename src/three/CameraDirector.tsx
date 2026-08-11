'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useGameStore } from '@/store/useGameStore';
import { useNetworkStore } from '@/store/useNetworkStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { CameraManager, type CameraHome } from './CameraManager';
import { squareToPosition } from './boardUtils';

interface CameraDirectorProps {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  home: CameraHome;
}

function vectorAt(square: string): THREE.Vector3 {
  return new THREE.Vector3(...squareToPosition(square));
}

export function CameraDirector({ controlsRef, home }: CameraDirectorProps) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gameManager = useGameStore((s) => s.manager);
  const cinematicCamera = useSettingsStore((s) => s.cinematicCamera);
  const myColor = useNetworkStore((s) => s.myColor);
  const cameraManagerRef = useRef<CameraManager | null>(null);

  // Playing as villain: mirror the "home" framing so each player always
  // sees their own back rank at the bottom, like sitting across a real board.
  const effectiveHome = useMemo<CameraHome>(() => {
    if (myColor !== 'villain') return home;
    return {
      position: new THREE.Vector3(home.position.x, home.position.y, -home.position.z),
      target: home.target.clone(),
    };
  }, [home, myColor]);

  // Builds the CameraManager and snaps to the current home. Kept separate
  // from the event-subscription effect below so toggling unrelated settings
  // (like cinematicCamera) never yanks the camera back to home mid-game.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const cameraManager = new CameraManager(camera, controls, effectiveHome);
    camera.position.copy(effectiveHome.position);
    controls.target.copy(effectiveHome.target);
    controls.update();
    cameraManagerRef.current = cameraManager;

    return () => {
      cameraManager.dispose();
      cameraManagerRef.current = null;
    };
  }, [camera, controlsRef, effectiveHome]);

  useEffect(() => {
    const offCaptured = gameManager.events.on('piece-captured', ({ to }) => {
      if (cinematicCamera) cameraManagerRef.current?.focusOnCapture(vectorAt(to));
    });

    const offCheck = gameManager.events.on('check', ({ color }) => {
      if (!cinematicCamera) return;
      const king = gameManager.getState().pieces.find((p) => p.type === 'king' && p.color === color);
      if (king) cameraManagerRef.current?.focusOnCheck(vectorAt(king.square));
    });

    const offCheckmate = gameManager.events.on('checkmate', ({ winner }) => {
      if (!cinematicCamera) return;
      const state = gameManager.getState();
      const loserColor = winner === 'hero' ? 'villain' : 'hero';
      const defeatedKing = state.pieces.find((p) => p.type === 'king' && p.color === loserColor);
      const winnerKing = state.pieces.find((p) => p.type === 'king' && p.color === winner);
      if (defeatedKing && winnerKing) {
        cameraManagerRef.current?.playCheckmateSequence(vectorAt(defeatedKing.square), vectorAt(winnerKing.square));
      }
    });

    const offReset = gameManager.events.on('state-reset', () => {
      cameraManagerRef.current?.returnHome(0.6);
    });

    return () => {
      offCaptured();
      offCheck();
      offCheckmate();
      offReset();
    };
  }, [gameManager, cinematicCamera]);

  return null;
}
