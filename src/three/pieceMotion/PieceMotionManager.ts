import * as THREE from 'three';
import { beginPieceTravel, runtimeNeedsAnimationFrames, tickPieceAnimation, tickPieceMotion } from './tick';
import type { PieceAnimationRuntime, PieceMotionRuntime } from './types';

/** Registro central de peças — um único useFrame percorre todas as instâncias. */
class PieceMotionManager {
  private entries = new Map<string, PieceMotionRuntime>();

  register(runtime: PieceMotionRuntime): void {
    this.entries.set(runtime.id, runtime);
  }

  unregister(id: string): void {
    this.entries.delete(id);
  }

  get(id: string): PieceMotionRuntime | undefined {
    return this.entries.get(id);
  }

  setAnimation(id: string, animation: PieceAnimationRuntime): void {
    const entry = this.entries.get(id);
    if (entry) entry.animation = animation;
  }

  clearAnimation(id: string): void {
    const entry = this.entries.get(id);
    if (entry) entry.animation = null;
  }

  beginTravel(id: string, from: THREE.Vector3, target: THREE.Vector3): void {
    const entry = this.entries.get(id);
    if (entry) beginPieceTravel(entry, from, target);
  }

  beginTravelRuntime(runtime: PieceMotionRuntime, from: THREE.Vector3, target: THREE.Vector3): void {
    beginPieceTravel(runtime, from, target);
  }

  tick(delta: number): void {
    for (const runtime of this.entries.values()) {
      tickPieceMotion(runtime, delta, beginPieceTravel);
      tickPieceAnimation(runtime, delta);
    }
  }

  needsAnimationFrames(): boolean {
    for (const runtime of this.entries.values()) {
      if (runtimeNeedsAnimationFrames(runtime)) return true;
    }
    return false;
  }
}

export const pieceMotionManager = new PieceMotionManager();
