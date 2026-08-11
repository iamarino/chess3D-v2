'use client';

import { Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useGameStore } from '@/store/useGameStore';
import { QUALITY_PRESETS, useSettingsStore } from '@/store/useSettingsStore';
import { heroesVillainsTheme } from '@/themes/heroes-villains/theme';
import { Board } from './Board';
import { BoardBase } from './BoardBase';
import { CalibrationRuler, FileWalkRuler } from './CalibrationRuler';
import { CameraDirector } from './CameraDirector';
import { CheckAura } from './effects/CheckAura';
import { EffectsLayer } from './effects/EffectsLayer';
import { Environment } from './Environment';
import { Piece } from './Piece';
import { preloadAllPieceModels } from './ModelLoader';

const theme = heroesVillainsTheme;

preloadAllPieceModels();

const HOME_CAMERA = {
  position: new THREE.Vector3(0, 8, 7),
  target: new THREE.Vector3(0, 0, 0),
};

function Pieces() {
  const pieces = useGameStore((s) => s.state.pieces);
  return (
    <>
      {pieces.map((piece) => (
        <Piece key={piece.id} piece={piece} />
      ))}
    </>
  );
}

export function Scene() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const quality = useSettingsStore((s) => s.quality);
  const showCalibrationRuler = useSettingsStore((s) => s.showCalibrationRuler);
  const preset = QUALITY_PRESETS[quality];

  return (
    <Canvas shadows={preset.shadows} dpr={preset.dpr} camera={{ position: [0, 8, 7], fov: 40 }}>
      <color attach="background" args={[theme.environment.backgroundColor]} />
      <Environment />
      <ambientLight intensity={0.85} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={2}
        color="#fff6e6"
        castShadow={preset.shadows}
        shadow-mapSize={[preset.shadowMapSize, preset.shadowMapSize]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      <group>
        <BoardBase />
        <Board />
        <Suspense fallback={null}>
          <Pieces />
        </Suspense>
        <CheckAura />
        <EffectsLayer />
        {showCalibrationRuler && (
          <>
            <CalibrationRuler />
            <FileWalkRuler />
          </>
        )}
      </group>
      {preset.contactShadows && (
        <ContactShadows position={[0, -0.005, 0]} opacity={0.35} scale={12} blur={2.2} far={5} />
      )}
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={5}
        maxDistance={14}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.15}
      />
      <CameraDirector controlsRef={controlsRef} home={HOME_CAMERA} />
    </Canvas>
  );
}
