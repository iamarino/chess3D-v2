'use client';

import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { ChessPiece } from '@/core/chess/types';
import { useGameStore } from '@/store/useGameStore';
import { DEFAULT_PIECE_MODEL_OFFSET, useSettingsStore } from '@/store/useSettingsStore';
import { heroesVillainsTheme } from '@/themes/heroes-villains/theme';
import { cloneSkinnedScene, getModelConfig, type PieceModelConfig } from './ModelLoader';
import { squareToPosition } from './boardUtils';
import { pieceMotionManager } from './pieceMotion/PieceMotionManager';
import { createPieceMotionRuntime } from './pieceMotion/tick';
import type { PieceAnimationRuntime, PieceMotionRuntime } from './pieceMotion/types';
import { acquireFrameDemand, releaseFrameDemand, requestFrame } from './frameInvalidate';
import { createWalkMotion, type WalkMotion } from './walkMotion';

const theme = heroesVillainsTheme;

const motionCache = new Map<string, WalkMotion | null>();

function loadMotion(
  path: string,
  animations: THREE.AnimationClip[],
  clipName: string | undefined,
  footfalls: number[] | undefined,
  scale: number,
): WalkMotion | null {
  if (!clipName || !footfalls) return null;
  const cacheKey = `${path}::${clipName}`;
  const cached = motionCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const source = animations.find((clip) => clip.name === clipName) ?? null;
  const motion = source ? createWalkMotion(source, scale, footfalls) : null;
  motionCache.set(cacheKey, motion);
  return motion;
}

function useLocomotionMotions(config: PieceModelConfig): { walk: WalkMotion | null; run: WalkMotion | null } {
  const { animations } = useGLTF(config.path);
  return useMemo(
    () => ({
      walk: loadMotion(config.path, animations, config.walkClip, config.walkFootfalls, config.scale),
      run: loadMotion(config.path, animations, config.runClip, config.runFootfalls, config.scale),
    }),
    [animations, config],
  );
}

const PieceModel = memo(function PieceModel({
  pieceId,
  color,
  type,
  walkMotion,
  runMotion,
}: {
  pieceId: string;
  color: ChessPiece['color'];
  type: ChessPiece['type'];
  walkMotion: WalkMotion | null;
  runMotion: WalkMotion | null;
}) {
  const config = getModelConfig(color, type);
  const { scene, animations } = useGLTF(config.path);
  const animationRoot = useRef<THREE.Group>(null);
  const modelOffset = useSettingsStore((s) => s.pieceModelOffsets[`${color}-${type}`] ?? DEFAULT_PIECE_MODEL_OFFSET);

  const cloned = useMemo(
    () => cloneSkinnedScene(scene, color, config.glow !== false),
    [scene, color, config.glow],
  );

  const INTRO_CLONE_SUFFIX = '__intro-clone';
  const clips = useMemo(() => {
    let result = animations;
    if (walkMotion && config.walkClip) {
      result = result.map((clip) => (clip.name === config.walkClip ? walkMotion.clip : clip));
    }
    if (runMotion && config.runClip) {
      result = result.map((clip) => (clip.name === config.runClip ? runMotion.clip : clip));
    }
    if (config.introClip && config.introClip === config.attackClip) {
      const shared = result.find((clip) => clip.name === config.introClip);
      if (shared) {
        const introClone = shared.clone();
        introClone.name = `${config.introClip}${INTRO_CLONE_SUFFIX}`;
        result = [...result, introClone];
      }
    }
    return result;
  }, [animations, walkMotion, runMotion, config.walkClip, config.runClip, config.introClip, config.attackClip]);

  const { actions, names, mixer } = useAnimations(clips, animationRoot);

  const introSourceName =
    config.introClip && config.introClip === config.attackClip
      ? `${config.introClip}${INTRO_CLONE_SUFFIX}`
      : config.introClip;
  const introClipName = config.noIntro
    ? null
    : names.length > 0
      ? introSourceName && names.includes(introSourceName)
        ? introSourceName
        : names[0]
      : null;
  const walkClipName = config.walkClip && names.includes(config.walkClip) ? config.walkClip : null;
  const runClipName = config.runClip && names.includes(config.runClip) ? config.runClip : null;
  const attackClipName = config.attackClip && names.includes(config.attackClip) ? config.attackClip : null;

  useEffect(() => {
    if (!introClipName) return;
    const action = actions[introClipName];
    if (!action) return;
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.reset().play();

    const token = `intro-${pieceId}`;
    acquireFrameDemand(token);
    const onFinished = (event: { action: THREE.AnimationAction }) => {
      if (event.action === action) releaseFrameDemand(token);
    };
    mixer.addEventListener('finished', onFinished);

    // Congela a pose no tempo real de `introFreezeAt` (velocidade normal do
    // clipe, só corta a exibição) — sem isso clipes de pose longos (ex.: as
    // rainhas, 12,833s) ainda estariam tocando muito depois do resto do time
    // já ter assentado no tabuleiro. `paused` só trava o avanço do tempo do
    // clipe: o cross-fade de peso para as próximas ações (andar/atacar) em
    // `tickPieceAnimation` continua funcionando normalmente a partir da pose
    // congelada.
    let freezeTimer: ReturnType<typeof setTimeout> | undefined;
    if (config.introFreezeAt) {
      freezeTimer = setTimeout(() => {
        action.paused = true;
        releaseFrameDemand(token);
      }, config.introFreezeAt * 1000);
    }

    return () => {
      if (freezeTimer) clearTimeout(freezeTimer);
      releaseFrameDemand(token);
      mixer.removeEventListener('finished', onFinished);
      action.stop();
    };
  }, [actions, introClipName, mixer, pieceId, config.introFreezeAt]);

  useEffect(() => {
    if (!attackClipName) return;
    const action = actions[attackClipName];
    if (!action) return;
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
  }, [actions, attackClipName]);

  // Registra handles de animação no manager central (sem useFrame por peça).
  useEffect(() => {
    const runtime = pieceMotionManager.get(pieceId);
    if (!runtime) return;

    const animRuntime: PieceAnimationRuntime = {
      mixer,
      walkClipName,
      runClipName,
      attackClipName,
      introClipName,
      walkMotion,
      runMotion,
      getWalkAction: () => (walkClipName ? actions[walkClipName] : undefined),
      getRunAction: () => (runClipName ? actions[runClipName] : undefined),
      getAttackAction: () => (attackClipName ? actions[attackClipName] : undefined),
      getIntroAction: () => (introClipName ? actions[introClipName] : undefined),
      walkStarted: false,
      runStarted: false,
      attackStarted: false,
    };

    const onFinished = (event: { action: THREE.AnimationAction }) => {
      const attackAction = attackClipName ? actions[attackClipName] : undefined;
      if (attackAction && event.action === attackAction && runtime.action === 'attack') {
        runtime.action = 'idle';
      }
    };
    mixer.addEventListener('finished', onFinished);
    pieceMotionManager.setAnimation(pieceId, animRuntime);

    return () => {
      mixer.removeEventListener('finished', onFinished);
      pieceMotionManager.clearAnimation(pieceId);
    };
  }, [pieceId, actions, mixer, walkClipName, runClipName, attackClipName, introClipName, walkMotion, runMotion]);

  return (
    <group ref={animationRoot}>
      <primitive
        object={cloned}
        position={[modelOffset.x, modelOffset.y, modelOffset.z]}
        rotation={config.rotation}
        scale={config.scale}
      />
    </group>
  );
});

const PieceSelectionLight = memo(function PieceSelectionLight({
  square,
  accentColor,
}: {
  square: string;
  accentColor: string;
}) {
  const isSelected = useGameStore((s) => s.selectedSquare === square);
  if (!isSelected) return null;
  return <pointLight position={[0, 1.6, 0]} intensity={0.8} color={accentColor} distance={2.8} />;
});

interface PieceProps {
  piece: ChessPiece;
}

function piecePropsEqual(prev: PieceProps, next: PieceProps): boolean {
  const a = prev.piece;
  const b = next.piece;
  return a.id === b.id && a.square === b.square && a.type === b.type && a.color === b.color;
}

function PieceInner({ piece }: PieceProps) {
  const select = useGameStore((s) => s.select);
  const config = getModelConfig(piece.color, piece.type);
  const { walk: walkMotion, run: runMotion } = useLocomotionMotions(config);
  const pieceWalkAnimation = useSettingsStore((s) => s.pieceWalkAnimation);
  const pieceWalkTempo = useSettingsStore((s) => s.pieceWalkTempo);

  const runtimeRef = useRef<PieceMotionRuntime | null>(null);
  const lastSquareRef = useRef<string | null>(null);

  if (!runtimeRef.current) {
    runtimeRef.current = createPieceMotionRuntime(
      piece.id,
      piece.square,
      config,
      walkMotion,
      runMotion,
      pieceWalkAnimation,
      pieceWalkTempo,
    );
  }

  const runtime = runtimeRef.current;

  useLayoutEffect(() => {
    pieceMotionManager.register(runtime);
    return () => pieceMotionManager.unregister(piece.id);
  }, [runtime, piece.id]);

  useEffect(() => {
    runtime.config = config;
    runtime.walkMotion = walkMotion;
    runtime.runMotion = runMotion;
    runtime.pieceWalkAnimation = pieceWalkAnimation;
    runtime.pieceWalkTempo = pieceWalkTempo;
    runtime.square = piece.square;
  }, [runtime, config, walkMotion, runMotion, pieceWalkAnimation, pieceWalkTempo, piece.square]);

  useLayoutEffect(() => {
    runtime.group?.position.set(...squareToPosition(piece.square));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const previousSquare = lastSquareRef.current;
    lastSquareRef.current = piece.square;
    const group = runtime.group;
    if (!group || previousSquare === null || previousSquare === piece.square) return;

    const target = new THREE.Vector3(...squareToPosition(piece.square));
    const { lastMove, lastCapture } = useGameStore.getState();
    const isPlayedMove = lastMove?.to === piece.square && lastMove?.from === previousSquare;

    const previousPosition = new THREE.Vector3(...squareToPosition(previousSquare));
    const correcao = group.position.distanceTo(previousPosition) > 0.5;
    if (correcao) {
      group.position.copy(previousPosition);
      runtime.walk = null;
      runtime.glide = null;
      runtime.phase = null;
      runtime.locomotion = null;
    }
    const from = group.position.clone();

    if (!isPlayedMove || from.distanceTo(target) < 1e-4) {
      group.position.copy(target);
      runtime.walk = null;
      runtime.glide = null;
      runtime.phase = null;
      runtime.locomotion = null;
      runtime.captureTarget = null;
      runtime.captureDefenderId = null;
      runtime.pendingAttack = null;
      runtime.strikePhase = null;
      return;
    }

    if (lastCapture?.attackerId === piece.id && config.attackClip) {
      const direction = target.clone().sub(from);
      const distanceSquares = Math.max(
        Math.abs(piece.square.charCodeAt(0) - previousSquare.charCodeAt(0)),
        Math.abs(Number(piece.square[1]) - Number(previousSquare[1])),
      );
      const strikeYaw =
        Math.atan2(direction.x, direction.z) - config.rotation[1] - (config.attackYaw ?? 0);

      if (distanceSquares > 1) {
        const approach = target.clone().addScaledVector(direction.clone().normalize(), -1);
        runtime.strikePhase = null;
        runtime.captureTarget = null;
        runtime.captureDefenderId = null;
        runtime.pendingAttack = { target, defenderId: lastCapture.defenderId, yaw: strikeYaw };
        pieceMotionManager.beginTravelRuntime(runtime, from, approach);
        return;
      }

      runtime.captureYaw = strikeYaw;
      runtime.captureTarget = target;
      runtime.captureDefenderId = lastCapture.defenderId;
      runtime.pendingAttack = null;
      runtime.strikePhase = 'turning';
      runtime.walk = null;
      runtime.glide = null;
      runtime.phase = null;
      runtime.locomotion = null;
      requestFrame();
      return;
    }

    runtime.captureTarget = null;
    runtime.captureDefenderId = null;
    runtime.pendingAttack = null;
    runtime.strikePhase = null;
    pieceMotionManager.beginTravelRuntime(runtime, from, target);
    requestFrame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piece.square, piece.id, walkMotion, runMotion, pieceWalkAnimation, pieceWalkTempo, config.rotation, config.attackClip]);

  const visual = theme.pieces[piece.color];

  return (
    <group
      ref={(node) => {
        runtime.group = node;
      }}
      onClick={(event) => {
        event.stopPropagation();
        select(piece.square);
      }}
    >
      <PieceModel
        pieceId={piece.id}
        color={piece.color}
        type={piece.type}
        walkMotion={walkMotion}
        runMotion={runMotion}
      />
      <PieceSelectionLight square={piece.square} accentColor={visual.accentColor} />
    </group>
  );
}

export const Piece = memo(PieceInner, piecePropsEqual);
