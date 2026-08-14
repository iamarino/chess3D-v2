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

// Abaixo desta largura de canvas (px) tratamos como tela de celular: o fov
// vertical fixo do desktop deixa muito pouco campo de visão horizontal numa
// tela em retrato (fov horizontal = f(fov vertical, aspect) — estreita junto
// com o aspect), cortando as laterais do tabuleiro. Ler `size.width` do R3F
// em vez de `window.innerWidth` porque é o que já reage a resize/rotação do
// canvas sem listener próprio.
const MOBILE_BREAKPOINT = 820;
const DESKTOP_FOV = 40;
const MOBILE_FOV = 58;
const DESKTOP_MAX_DISTANCE = 14;
const MOBILE_MAX_DISTANCE = 24;
// Afasta a câmera "home" no celular, na mesma direção/ângulo do enquadramento
// desktop — combinado com o fov maior acima, sobra campo de visão horizontal
// suficiente para o tabuleiro inteiro (incluindo pilastras) caber na tela.
const MOBILE_HOME_DISTANCE_SCALE = 1.3;

export function CameraDirector({ controlsRef, home }: CameraDirectorProps) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const isMobile = useThree((s) => s.size.width) <= MOBILE_BREAKPOINT;
  const gameManager = useGameStore((s) => s.manager);
  const cinematicCamera = useSettingsStore((s) => s.cinematicCamera);
  const myColor = useNetworkStore((s) => s.myColor);
  const cameraManagerRef = useRef<CameraManager | null>(null);

  // Playing as villain: mirror the "home" framing so each player always
  // sees their own back rank at the bottom, like sitting across a real board.
  // On a small screen, also pull the framing back so the whole board fits
  // (see the MOBILE_* constants above).
  const effectiveHome = useMemo<CameraHome>(() => {
    const mirrored =
      myColor === 'villain'
        ? new THREE.Vector3(home.position.x, home.position.y, -home.position.z)
        : home.position.clone();
    const position = isMobile ? mirrored.multiplyScalar(MOBILE_HOME_DISTANCE_SCALE) : mirrored;
    return { position, target: home.target.clone() };
  }, [home, myColor, isMobile]);

  // Builds the CameraManager and snaps to the current home. Kept separate
  // from the event-subscription effect below so toggling unrelated settings
  // (like cinematicCamera) never yanks the camera back to home mid-game.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    // O prop `camera` do <Canvas> só configura a câmera na criação inicial —
    // fov e distância máxima do orbit control precisam ser corrigidos aqui,
    // à mão, sempre que o breakpoint mobile mudar.
    camera.fov = isMobile ? MOBILE_FOV : DESKTOP_FOV;
    camera.updateProjectionMatrix();
    controls.maxDistance = isMobile ? MOBILE_MAX_DISTANCE : DESKTOP_MAX_DISTANCE;

    const cameraManager = new CameraManager(camera, controls, effectiveHome);
    camera.position.copy(effectiveHome.position);
    controls.target.copy(effectiveHome.target);
    controls.update();
    cameraManagerRef.current = cameraManager;

    return () => {
      cameraManager.dispose();
      cameraManagerRef.current = null;
    };
  }, [camera, controlsRef, effectiveHome, isMobile]);

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
