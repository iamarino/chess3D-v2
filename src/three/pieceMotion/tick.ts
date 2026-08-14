import * as THREE from 'three';
import { useGameStore } from '@/store/useGameStore';
import { requestFrame } from '../frameInvalidate';
import type { PieceModelConfig } from '../ModelLoader';
import { planWalk, rampedProgress, type WalkMotion } from '../walkMotion';
import {
  BLEND_LAMBDA,
  GLIDE_DURATION,
  RUN_DISTANCE_THRESHOLD,
  STRIKE_ALIGNED_EPS,
  TURN_LAMBDA,
  WALK_RAMP,
  dampAngle,
  easeInOutQuad,
} from './math';
import type { PieceAnimationRuntime, PieceMotionRuntime } from './types';

const WEIGHT_EPS = 0.02;
const SCALE_EPS = 0.002;

function actionWeightSettling(action: THREE.AnimationAction | null | undefined, target: number): boolean {
  if (!action) return false;
  return Math.abs(action.weight - target) > WEIGHT_EPS;
}

function animationWeightsSettling(anim: PieceAnimationRuntime, runtime: PieceMotionRuntime): boolean {
  const walking = runtime.phase !== null;
  const attacking = runtime.action === 'attack';
  const dancing = runtime.action === 'dance';
  const locomotion = runtime.locomotion;

  if (
    actionWeightSettling(anim.getWalkAction(), walking && locomotion === 'walk' ? 1 : 0) ||
    actionWeightSettling(anim.getRunAction(), walking && locomotion === 'run' ? 1 : 0) ||
    actionWeightSettling(anim.getAttackAction(), attacking ? 1 : 0) ||
    actionWeightSettling(anim.getDanceAction(), dancing ? 1 : 0)
  ) {
    return true;
  }

  const introAction = anim.getIntroAction();
  if (introAction) {
    const introTarget = walking || attacking || dancing ? 0 : 1;
    if (actionWeightSettling(introAction, introTarget)) return true;
  }

  return anim.walkStarted || anim.runStarted || anim.attackStarted || anim.danceStarted;
}

/** True enquanto a peça ainda precisa de quadros (movimento, golpe, dança, blend ou escala de seleção). */
export function runtimeNeedsAnimationFrames(runtime: PieceMotionRuntime): boolean {
  if (
    runtime.walk ||
    runtime.glide ||
    runtime.captureTarget ||
    runtime.strikePhase ||
    runtime.action === 'attack' ||
    runtime.action === 'dance'
  ) {
    return true;
  }

  const group = runtime.group;
  if (group) {
    const isSelected = useGameStore.getState().selectedSquare === runtime.square;
    const targetScale = isSelected ? 1.08 : 1;
    if (Math.abs(group.scale.x - targetScale) > SCALE_EPS) return true;
  }

  const anim = runtime.animation;
  if (anim && animationWeightsSettling(anim, runtime)) return true;

  return false;
}


function driveLocomotion(
  action: THREE.AnimationAction | null | undefined,
  motion: WalkMotion | null,
  active: boolean,
  phase: number | null,
  delta: number,
  anim: PieceAnimationRuntime,
  startedKey: 'walkStarted' | 'runStarted',
): void {
  if (!action || !motion) return;
  if (active) {
    if (!anim[startedKey]) {
      action.reset().play();
      anim[startedKey] = true;
    }
    action.paused = true;
    action.time = (phase ?? 0) % motion.duration;
  } else if (anim[startedKey] && action.weight < 0.01) {
    action.stop();
    anim[startedKey] = false;
  }
  action.weight = THREE.MathUtils.damp(action.weight, active ? 1 : 0, BLEND_LAMBDA, delta);
}

/** Atualiza pesos/fases das actions de um modelo — chamado pelo tick central. */
export function tickPieceAnimation(runtime: PieceMotionRuntime, delta: number): void {
  const anim = runtime.animation;
  if (!anim) return;

  const walking = runtime.phase !== null;
  const attacking = runtime.action === 'attack';
  const dancing = runtime.action === 'dance';
  const locomotion = runtime.locomotion;

  driveLocomotion(
    anim.getWalkAction(),
    anim.walkMotion,
    walking && locomotion === 'walk',
    runtime.phase,
    delta,
    anim,
    'walkStarted',
  );
  driveLocomotion(
    anim.getRunAction(),
    anim.runMotion,
    walking && locomotion === 'run',
    runtime.phase,
    delta,
    anim,
    'runStarted',
  );

  const attackAction = anim.getAttackAction();
  if (anim.attackClipName && attackAction) {
    if (attacking && !anim.attackStarted) {
      attackAction.reset().play();
      anim.attackStarted = true;
    } else if (!attacking) {
      anim.attackStarted = false;
    }
    if (attacking && anim.attackStarted && attackAction.time > 0 && !attackAction.isRunning()) {
      runtime.action = 'idle';
    }
    attackAction.weight = THREE.MathUtils.damp(attackAction.weight, attacking ? 1 : 0, BLEND_LAMBDA, delta);
  }

  const danceAction = anim.getDanceAction();
  if (anim.danceClipName && danceAction) {
    if (dancing && !anim.danceStarted) {
      danceAction.reset().play();
      anim.danceStarted = true;
    } else if (!dancing) {
      anim.danceStarted = false;
    }
    danceAction.weight = THREE.MathUtils.damp(danceAction.weight, dancing ? 1 : 0, BLEND_LAMBDA, delta);
    if (!dancing && danceAction.weight < WEIGHT_EPS) danceAction.stop();
  }

  const introAction = anim.getIntroAction();
  if (anim.introClipName && introAction) {
    const idleTarget = walking || attacking || dancing ? 0 : 1;
    introAction.weight = THREE.MathUtils.damp(introAction.weight, idleTarget, BLEND_LAMBDA, delta);
  }

  anim.mixer.update(delta);
}

/** Atualiza posição, rotação e escala do grupo da peça — chamado pelo tick central. */
export function tickPieceMotion(
  runtime: PieceMotionRuntime,
  delta: number,
  beginTravel: (rt: PieceMotionRuntime, from: THREE.Vector3, target: THREE.Vector3) => void,
): void {
  const group = runtime.group;
  if (!group) return;

  if (runtime.captureTarget) {
    if (runtime.strikePhase === 'striking') {
      if (runtime.action === 'idle') {
        useGameStore.getState().releasePendingGhost();
        runtime.strikePhase = null;
      }
    } else if (runtime.strikePhase !== 'turning') {
      const defenderId = runtime.captureDefenderId;
      const stillFalling =
        defenderId !== null &&
        useGameStore.getState().capturedGhosts.some((ghost) => ghost.piece.id === defenderId);
      if (!stillFalling) {
        beginTravel(runtime, group.position.clone(), runtime.captureTarget);
        runtime.captureTarget = null;
        runtime.captureDefenderId = null;
      }
    }
  }

  const walk = runtime.walk;
  if (walk) {
    walk.elapsed += delta;
    const u = Math.min(1, walk.elapsed / walk.duration);
    const phase = walk.plan.startPhase + walk.plan.totalPhase * rampedProgress(u, walk.ramp);
    runtime.phase = phase;

    const travelled = (walk.motion.displacementAt(phase) - walk.plan.startDisplacement) * walk.plan.warp;
    group.position.copy(walk.from).addScaledVector(walk.direction, travelled);

    if (u >= 1) {
      group.position.copy(walk.target);
      runtime.walk = null;
      runtime.phase = null;
      runtime.locomotion = null;

      const pending = runtime.pendingAttack;
      if (pending) {
        runtime.pendingAttack = null;
        runtime.captureYaw = pending.yaw;
        runtime.captureTarget = pending.target;
        runtime.captureDefenderId = pending.defenderId;
        runtime.strikePhase = 'turning';
      }
    }
  } else {
    const glide = runtime.glide;
    if (glide) {
      glide.elapsed += delta;
      const t = Math.min(1, glide.elapsed / GLIDE_DURATION);
      group.position.lerpVectors(glide.from, glide.target, easeInOutQuad(t));
      if (t >= 1) {
        group.position.copy(glide.target);
        runtime.glide = null;
      }
    }
  }

  const targetYaw = walk ? walk.yaw : runtime.captureTarget ? runtime.captureYaw : 0;
  group.rotation.y = dampAngle(group.rotation.y, targetYaw, TURN_LAMBDA, delta);

  if (runtime.strikePhase === 'turning') {
    let error = (runtime.captureYaw - group.rotation.y) % (Math.PI * 2);
    if (error > Math.PI) error -= Math.PI * 2;
    if (error < -Math.PI) error += Math.PI * 2;
    if (Math.abs(error) < STRIKE_ALIGNED_EPS) {
      group.rotation.y = runtime.captureYaw;
      runtime.strikePhase = 'striking';
      runtime.action = 'attack';
    }
  }

  const isSelected = useGameStore.getState().selectedSquare === runtime.square;
  const targetScale = isSelected ? 1.08 : 1;
  group.scale.setScalar(THREE.MathUtils.damp(group.scale.x, targetScale, 10, delta));
}

/** Inicia caminhada por root motion ou deslize até `target`. */
export function beginPieceTravel(runtime: PieceMotionRuntime, from: THREE.Vector3, target: THREE.Vector3): void {
  const group = runtime.group;
  if (!group) return;

  const direction = target.clone().sub(from);
  const distance = direction.length();

  if (distance < 1e-4) {
    group.position.copy(target);
    runtime.walk = null;
    runtime.glide = null;
    runtime.phase = null;
    runtime.locomotion = null;
    return;
  }

  const { config, walkMotion, runMotion, pieceWalkAnimation, pieceWalkTempo } = runtime;
  const yaw = Math.atan2(direction.x, direction.z) - config.rotation[1];
  direction.normalize();

  const distanceSquares = Math.round(distance);
  const useRun = distanceSquares > RUN_DISTANCE_THRESHOLD && runMotion !== null;
  const motion = useRun ? runMotion : walkMotion;

  if (!motion || !pieceWalkAnimation) {
    runtime.walk = null;
    runtime.phase = null;
    runtime.locomotion = null;
    runtime.glide = { from, target, elapsed: 0 };
    requestFrame();
    return;
  }

  const plan = planWalk(motion, distance);
  const ramp = useRun ? 1 / distanceSquares : WALK_RAMP;

  runtime.glide = null;
  runtime.locomotion = useRun ? 'run' : 'walk';
  runtime.walk = {
    from,
    target,
    direction,
    plan,
    motion,
    ramp,
    duration: Math.max(0.15, plan.totalPhase / Math.max(0.1, pieceWalkTempo)),
    elapsed: 0,
    yaw,
  };
  runtime.phase = plan.startPhase;
  requestFrame();
}

export function createPieceMotionRuntime(
  id: string,
  square: string,
  config: PieceModelConfig,
  walkMotion: WalkMotion | null,
  runMotion: WalkMotion | null,
  pieceWalkAnimation: boolean,
  pieceWalkTempo: number,
): PieceMotionRuntime {
  return {
    id,
    square,
    group: null,
    config,
    walkMotion,
    runMotion,
    pieceWalkAnimation,
    pieceWalkTempo,
    phase: null,
    action: 'idle',
    locomotion: null,
    walk: null,
    glide: null,
    captureTarget: null,
    captureYaw: 0,
    strikePhase: null,
    captureDefenderId: null,
    pendingAttack: null,
    animation: null,
  };
}
