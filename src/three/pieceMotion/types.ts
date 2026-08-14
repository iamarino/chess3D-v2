import * as THREE from 'three';
import type { PieceModelConfig } from '../ModelLoader';
import type { WalkMotion, WalkPlan } from '../walkMotion';

export interface WalkState {
  from: THREE.Vector3;
  target: THREE.Vector3;
  direction: THREE.Vector3;
  plan: WalkPlan;
  motion: WalkMotion;
  ramp: number;
  duration: number;
  elapsed: number;
  yaw: number;
}

export interface GlideState {
  from: THREE.Vector3;
  target: THREE.Vector3;
  elapsed: number;
}

export interface PendingAttackState {
  target: THREE.Vector3;
  defenderId: string;
  yaw: number;
}

/** Handles de animação registrados por `PieceModel` — atualizados quando o mixer fica pronto. */
export interface PieceAnimationRuntime {
  mixer: THREE.AnimationMixer;
  walkClipName: string | null;
  runClipName: string | null;
  attackClipName: string | null;
  introClipName: string | null;
  walkMotion: WalkMotion | null;
  runMotion: WalkMotion | null;
  getWalkAction: () => THREE.AnimationAction | null | undefined;
  getRunAction: () => THREE.AnimationAction | null | undefined;
  getAttackAction: () => THREE.AnimationAction | null | undefined;
  getIntroAction: () => THREE.AnimationAction | null | undefined;
  walkStarted: boolean;
  runStarted: boolean;
  attackStarted: boolean;
}

/** Estado de movimento/animacao de uma peça — compartilhado entre `Piece`, `PieceModel` e o manager. */
export interface PieceMotionRuntime {
  id: string;
  square: string;
  group: THREE.Group | null;
  config: PieceModelConfig;
  walkMotion: WalkMotion | null;
  runMotion: WalkMotion | null;
  pieceWalkAnimation: boolean;
  pieceWalkTempo: number;
  phase: number | null;
  action: 'idle' | 'attack';
  locomotion: 'walk' | 'run' | null;
  walk: WalkState | null;
  glide: GlideState | null;
  captureTarget: THREE.Vector3 | null;
  captureYaw: number;
  strikePhase: 'turning' | 'striking' | null;
  captureDefenderId: string | null;
  pendingAttack: PendingAttackState | null;
  animation: PieceAnimationRuntime | null;
}
