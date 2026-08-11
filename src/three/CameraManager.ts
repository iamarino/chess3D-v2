import gsap from 'gsap';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

export interface CameraHome {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

const CAPTURE_DURATION = 1.5;
const CHECK_DURATION = 1.1;
const CHECKMATE_APPROACH_DURATION = 1.4;
const CHECKMATE_HOLD_DURATION = 1.1;
const CHECKMATE_REVEAL_DURATION = 1.8;

/**
 * Drives the R3F camera + OrbitControls target through cinematic beats
 * (capture, check, checkmate) using GSAP timelines, then hands control
 * back to the player. Nothing here knows about chess rules — it only
 * reacts to positions it's given.
 */
export class CameraManager {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControlsImpl;
  private home: CameraHome;
  private timeline: gsap.core.Timeline | null = null;
  private baseConstraints: {
    minDistance: number;
    maxDistance: number;
    minPolarAngle: number;
    maxPolarAngle: number;
  };

  constructor(camera: THREE.PerspectiveCamera, controls: OrbitControlsImpl, home: CameraHome) {
    this.camera = camera;
    this.controls = controls;
    this.home = home;
    this.baseConstraints = {
      minDistance: controls.minDistance,
      maxDistance: controls.maxDistance,
      minPolarAngle: controls.minPolarAngle,
      maxPolarAngle: controls.maxPolarAngle,
    };
  }

  private killTimeline(): void {
    this.timeline?.kill();
    this.timeline = null;
  }

  /**
   * OrbitControls.update() re-clamps camera distance/polar angle from its
   * own min/max props on every call, regardless of `enabled` — so a
   * cinematic close-up would get silently pushed back out to minDistance.
   * Widen the constraints for the duration of the cinematic and restore
   * them once control is handed back to the player.
   */
  private applyConstraints(c: {
    minDistance: number;
    maxDistance: number;
    minPolarAngle: number;
    maxPolarAngle: number;
  }): void {
    this.controls.minDistance = c.minDistance;
    this.controls.maxDistance = c.maxDistance;
    this.controls.minPolarAngle = c.minPolarAngle;
    this.controls.maxPolarAngle = c.maxPolarAngle;
  }

  private lockControls(): void {
    this.controls.enabled = false;
    this.applyConstraints({ minDistance: 0.1, maxDistance: 1000, minPolarAngle: 0, maxPolarAngle: Math.PI });
  }

  private unlockControls(): void {
    this.applyConstraints(this.baseConstraints);
    this.controls.enabled = true;
    this.controls.update();
  }

  private syncControls(): void {
    this.controls.update();
  }

  focusOnCapture(targetPosition: THREE.Vector3, duration = CAPTURE_DURATION): void {
    this.killTimeline();
    this.lockControls();

    const dir = new THREE.Vector3(targetPosition.x, 0, targetPosition.z).normalize();
    const camPoint = targetPosition
      .clone()
      .add(dir.clone().multiplyScalar(2.0))
      .add(new THREE.Vector3(0, 1.7, 1.3));
    const lookPoint = targetPosition.clone().add(new THREE.Vector3(0, 0.4, 0));
    const approach = duration * 0.35;
    const hold = duration * 0.3;
    const returnDur = duration * 0.35;

    this.timeline = gsap.timeline({ onComplete: () => this.unlockControls() });
    this.timeline
      .to(this.camera.position, { ...camPoint, duration: approach, ease: 'power2.inOut' }, 0)
      .to(
        this.controls.target,
        { ...lookPoint, duration: approach, ease: 'power2.inOut', onUpdate: () => this.syncControls() },
        0,
      )
      .to({}, { duration: hold })
      .to(this.camera.position, { ...this.home.position, duration: returnDur, ease: 'power2.inOut' })
      .to(
        this.controls.target,
        { ...this.home.target, duration: returnDur, ease: 'power2.inOut', onUpdate: () => this.syncControls() },
        '<',
      );
  }

  focusOnCheck(kingPosition: THREE.Vector3, duration = CHECK_DURATION): void {
    this.killTimeline();
    this.lockControls();

    const dir = new THREE.Vector3(kingPosition.x, 0, kingPosition.z).normalize();
    const camPoint = kingPosition
      .clone()
      .add(dir.clone().multiplyScalar(2.6))
      .add(new THREE.Vector3(0, 2.2, 1.2));
    const lookPoint = kingPosition.clone().add(new THREE.Vector3(0, 0.6, 0));
    const approach = duration * 0.4;
    const hold = duration * 0.25;
    const returnDur = duration * 0.35;

    this.timeline = gsap.timeline({ onComplete: () => this.unlockControls() });
    this.timeline
      .to(this.camera.position, { ...camPoint, duration: approach, ease: 'power2.out' }, 0)
      .to(
        this.controls.target,
        { ...lookPoint, duration: approach, ease: 'power2.out', onUpdate: () => this.syncControls() },
        0,
      )
      .to({}, { duration: hold })
      .to(this.camera.position, { ...this.home.position, duration: returnDur, ease: 'power2.inOut' })
      .to(
        this.controls.target,
        { ...this.home.target, duration: returnDur, ease: 'power2.inOut', onUpdate: () => this.syncControls() },
        '<',
      );
  }

  playCheckmateSequence(defeatedKingPosition: THREE.Vector3, winnerSquareHint: THREE.Vector3): void {
    this.killTimeline();
    this.lockControls();

    const closeUpPoint = defeatedKingPosition.clone().add(new THREE.Vector3(1.2, 1.1, 1.6));
    const closeUpLook = defeatedKingPosition.clone().add(new THREE.Vector3(0, 0.7, 0));

    const revealPoint = new THREE.Vector3(0, 9.5, 8.5);
    const revealLook = new THREE.Vector3(0, 0, 0);

    const winnerDir = new THREE.Vector3(winnerSquareHint.x, 0, winnerSquareHint.z).normalize();
    const victoryPoint = winnerSquareHint
      .clone()
      .add(winnerDir.clone().multiplyScalar(3.5))
      .add(new THREE.Vector3(0, 3, 0));
    const victoryLook = winnerSquareHint.clone().add(new THREE.Vector3(0, 0.5, 0));

    this.timeline = gsap.timeline({ onComplete: () => this.unlockControls() });
    this.timeline
      // 1. fast dramatic push into the defeated king
      .to(this.camera.position, { ...closeUpPoint, duration: CHECKMATE_APPROACH_DURATION, ease: 'power3.inOut' }, 0)
      .to(
        this.controls.target,
        { ...closeUpLook, duration: CHECKMATE_APPROACH_DURATION, ease: 'power3.inOut', onUpdate: () => this.syncControls() },
        0,
      )
      // 2. hold on the defeat
      .to({}, { duration: CHECKMATE_HOLD_DURATION })
      // 3. pull back to a high wide reveal of the board
      .to(this.camera.position, { ...revealPoint, duration: CHECKMATE_REVEAL_DURATION, ease: 'power2.inOut' })
      .to(
        this.controls.target,
        { ...revealLook, duration: CHECKMATE_REVEAL_DURATION, ease: 'power2.inOut', onUpdate: () => this.syncControls() },
        '<',
      )
      // 4. settle toward the winner's side for the victory beat
      .to(this.camera.position, { ...victoryPoint, duration: CHECKMATE_HOLD_DURATION * 1.2, ease: 'power2.out' })
      .to(
        this.controls.target,
        {
          ...victoryLook,
          duration: CHECKMATE_HOLD_DURATION * 1.2,
          ease: 'power2.out',
          onUpdate: () => this.syncControls(),
        },
        '<',
      );
  }

  returnHome(duration = 1): void {
    this.killTimeline();
    this.lockControls();
    this.timeline = gsap.timeline({ onComplete: () => this.unlockControls() });
    this.timeline
      .to(this.camera.position, { ...this.home.position, duration, ease: 'power2.inOut' }, 0)
      .to(
        this.controls.target,
        { ...this.home.target, duration, ease: 'power2.inOut', onUpdate: () => this.syncControls() },
        0,
      );
  }

  dispose(): void {
    this.killTimeline();
    this.unlockControls();
  }
}
