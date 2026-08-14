import * as THREE from 'three';
import { requestFrame } from '../frameInvalidate';
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

  /**
   * Liga/desliga a dança de comemoração de uma peça. Só entra em `dance` se a
   * peça estiver ociosa (nunca interrompe um golpe ou uma caminhada em curso —
   * na prática não deveria haver nenhuma jogada em andamento depois do
   * xeque-mate, mas o guard evita cravar a ação por cima de um estado real).
   */
  setDancing(id: string, dancing: boolean): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    if (dancing) {
      if (entry.action === 'idle' && !entry.walk && !entry.captureTarget && !entry.strikePhase) {
        entry.action = 'dance';
        requestFrame();
      }
    } else if (entry.action === 'dance') {
      entry.action = 'idle';
      requestFrame();
    }
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
