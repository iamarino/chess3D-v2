'use client';

import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
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
import { GlowPulse } from './effects/GlowPulse';
import { Environment } from './Environment';
import { GhostPiece } from './GhostPiece';
import { Piece } from './Piece';
import { DemandFrameLoop } from './pieceMotion/DemandFrameLoop';
import { preloadAllPieceModels } from './ModelLoader';

const theme = heroesVillainsTheme;

preloadAllPieceModels();

// Luz principal por cenário (sol ao meio-dia / luar) — mantida junto da
// câmara/sombra em Scene.tsx porque é a única luz com `castShadow`; o resto
// da paleta do cenário (céu, muralha, montanhas) fica em `Environment.tsx`.
const SCENARIO_LIGHT = {
  'castle-day': { background: theme.environment.backgroundColor, ambient: 0.85, sunColor: '#fff6e6', sunIntensity: 2 },
  'castle-night': { background: '#0e0a1f', ambient: 0.32, sunColor: '#a9c0ff', sunIntensity: 0.55 },
  'volcanic-rift': { background: '#2b0d08', ambient: 0.55, sunColor: '#ff7a3d', sunIntensity: 1.3 },
  'football-pitch': { background: '#bfe0f7', ambient: 0.95, sunColor: '#ffffff', sunIntensity: 2.1 },
} as const;

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

function Ghosts() {
  const ghosts = useGameStore((s) => s.capturedGhosts);
  const pendingGhost = useGameStore((s) => s.pendingGhost);
  const removeGhost = useGameStore((s) => s.removeGhost);
  return (
    <>
      {/* Vítima de um golpe que ainda não conectou: continua de pé na casa até
          o chute acertar (ver `standing` em GhostPiece). É outro slot da árvore
          que o fantasma que cai, então ela remonta na troca — de propósito: a
          queda tem que começar do zero no instante do impacto. */}
      {pendingGhost && (
        <GhostPiece key={pendingGhost.ghostId} piece={pendingGhost.piece} standing onDone={() => {}} />
      )}
      {ghosts.map(({ ghostId, piece }) => (
        <GhostPiece key={ghostId} piece={piece} onDone={() => removeGhost(ghostId)} />
      ))}
    </>
  );
}

// Só monta dentro do mesmo Suspense das peças, então o efeito só dispara na
// comitada em que elas de fato entraram na cena — ao contrário do
// gerenciador de carregamento do three (`useProgress`), que fecha assim que
// os GLBs terminam de baixar, antes do Suspense comitar os componentes.
function PiecesReadySignal({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

function SceneControls({ controlsRef }: { controlsRef: React.RefObject<OrbitControlsImpl | null> }) {
  const invalidate = useThree((s) => s.invalidate);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      minDistance={5}
      maxDistance={14}
      minPolarAngle={Math.PI / 6}
      maxPolarAngle={Math.PI / 2.15}
      onChange={() => invalidate()}
    />
  );
}

export function Scene({ onPiecesReady }: { onPiecesReady: () => void }) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const quality = useSettingsStore((s) => s.quality);
  const scenario = useSettingsStore((s) => s.scenario);
  const showCalibrationRuler = useSettingsStore((s) => s.showCalibrationRuler);
  const preset = QUALITY_PRESETS[quality];
  const light = SCENARIO_LIGHT[scenario];

  return (
    <Canvas frameloop="demand" shadows={preset.shadows} dpr={preset.dpr} camera={{ position: [0, 8, 7], fov: 40 }}>
      <color attach="background" args={[light.background]} />
      <Environment />
      <ambientLight intensity={light.ambient} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={light.sunIntensity}
        color={light.sunColor}
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
          <Ghosts />
          <DemandFrameLoop />
          <PiecesReadySignal onReady={onPiecesReady} />
        </Suspense>
        <CheckAura />
        <EffectsLayer />
        <GlowPulse />
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
      <SceneControls controlsRef={controlsRef} />
      <CameraDirector controlsRef={controlsRef} home={HOME_CAMERA} />
    </Canvas>
  );
}
