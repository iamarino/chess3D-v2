'use client';

import { useMemo } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { squareToPosition } from './boardUtils';

/**
 * TEMPORARY dev tool — a fine grid + labeled axes over the hero pawn's home
 * square, plus a full-file ruler, for reading off exact offsets while
 * tuning "Ajuste de posição" and "Ponto de parada da caminhada" in the
 * settings menu. Safe to delete once the pieces are calibrated; it renders
 * nothing that affects actual game logic or board state.
 */
const CALIBRATION_SQUARE = 'd2';
const TICK_STEP = 0.1;
const RULER_HALF_EXTENT = 0.6; // slightly past the square's own edge (±0.5)
const LABEL_STEP = 0.2; // label every other tick to stay readable

const FLAT_ROTATION: [number, number, number] = [-Math.PI / 2, 0, 0];

// Lime green with a black outline reads on both light and dark squares —
// flat color alone doesn't (light green washes out on white squares, for
// instance), so the outline is load-bearing, not decorative.
const LABEL_COLOR = '#7CFF00';
const LABEL_OUTLINE = '#000000';
const LABEL_OUTLINE_WIDTH = 0.004;

function buildGridGeometry(): THREE.BufferGeometry {
  const points: number[] = [];
  const steps = Math.round((RULER_HALF_EXTENT * 2) / TICK_STEP);
  for (let i = 0; i <= steps; i++) {
    const v = -RULER_HALF_EXTENT + i * TICK_STEP;
    // line parallel to X, at this Z
    points.push(-RULER_HALF_EXTENT, 0, v, RULER_HALF_EXTENT, 0, v);
    // line parallel to Z, at this X
    points.push(v, 0, -RULER_HALF_EXTENT, v, 0, RULER_HALF_EXTENT);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}

function AxisTicks({ axis }: { axis: 'x' | 'z' }) {
  const ticks: number[] = [];
  for (let v = -RULER_HALF_EXTENT; v <= RULER_HALF_EXTENT + 1e-6; v += LABEL_STEP) {
    ticks.push(Math.round(v * 100) / 100);
  }
  return (
    <>
      {ticks.map((v) => (
        <Text
          key={`${axis}-${v}`}
          position={axis === 'x' ? [v, 0.02, 0.09] : [0.09, 0.02, v]}
          rotation={FLAT_ROTATION}
          fontSize={0.055}
          color={LABEL_COLOR}
          outlineWidth={LABEL_OUTLINE_WIDTH}
          outlineColor={LABEL_OUTLINE}
          anchorX="center"
          anchorY="middle"
        >
          {v.toFixed(1)}
        </Text>
      ))}
    </>
  );
}

export function CalibrationRuler() {
  const gridGeometry = useMemo(() => buildGridGeometry(), []);
  const [x, , z] = squareToPosition(CALIBRATION_SQUARE);

  return (
    <group position={[x, 0.015, z]}>
      {/* fine 0.1-unit grid */}
      <lineSegments geometry={gridGeometry}>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.35} />
      </lineSegments>

      {/* red X axis / blue Z axis through the square's exact center */}
      <mesh rotation={FLAT_ROTATION} position={[0, 0.001, 0]}>
        <planeGeometry args={[RULER_HALF_EXTENT * 2, 0.006]} />
        <meshBasicMaterial color="#ff4444" transparent opacity={0.8} />
      </mesh>
      <mesh rotation={FLAT_ROTATION} position={[0, 0.001, 0]}>
        <planeGeometry args={[0.006, RULER_HALF_EXTENT * 2]} />
        <meshBasicMaterial color="#4488ff" transparent opacity={0.8} />
      </mesh>

      {/* bright crosshair marking exact center (0, 0) */}
      <mesh rotation={FLAT_ROTATION} position={[0, 0.002, 0]}>
        <ringGeometry args={[0.02, 0.03, 24]} />
        <meshBasicMaterial color={LABEL_COLOR} />
      </mesh>

      <AxisTicks axis="x" />
      <AxisTicks axis="z" />
    </group>
  );
}

// --- Full-file walk ruler -------------------------------------------------
// Spans the whole board along one file — for calibrating a "how far did it
// walk" stop point (the settings' "Ponto de parada da caminhada") across a
// multi-square slide, not just centering within one square. Placed on the
// hero kingside rook's file (h), since a rook's the piece that actually
// covers this kind of distance.
//
// Labels are one continuous number the whole length of the file (0 at h1's
// center, 7 at h8's), not a per-square value that resets at every square —
// that's what lets you read a stop point straight off the ruler and match
// it against the "Ponto de parada da caminhada" setting to see if the same
// number holds up as a pattern across different moves.
const WALK_RULER_FILE = 'h';
const WALK_RULER_RANKS = 8;
const WALK_TICK_STEP = 0.1;
const WALK_LABEL_STEP = 0.2;
const SQUARE_SPAN = 1;

interface WalkTick {
  z: number;
  rank: number;
  continuous: number; // 0 at h1's center, growing toward h8
  isCenter: boolean;
}

function buildWalkTicks(): WalkTick[] {
  const [, , rank1Z] = squareToPosition(`${WALK_RULER_FILE}1`);
  const zStart = rank1Z + 0.5;
  const totalTicks = Math.round((WALK_RULER_RANKS * SQUARE_SPAN) / WALK_TICK_STEP);
  const ticks: WalkTick[] = [];
  for (let i = 0; i <= totalTicks; i++) {
    const z = Math.round((zStart - i * WALK_TICK_STEP) * 100) / 100;
    const continuous = Math.round((rank1Z - z) * 100) / 100;
    const rankFloat = 4.5 - z; // 1..8 at square centers
    const rank = Math.max(1, Math.min(WALK_RULER_RANKS, Math.round(rankFloat)));
    const centerZ = 3.5 - (rank - 1);
    ticks.push({ z, rank, continuous, isCenter: Math.abs(z - centerZ) < 1e-6 });
  }
  return ticks;
}

function buildWalkRulerGeometry(ticks: WalkTick[]): THREE.BufferGeometry {
  const points: number[] = [];
  for (const tick of ticks) {
    const half = tick.isCenter ? 0.09 : 0.04;
    points.push(-half, 0, tick.z, half, 0, tick.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}

export function FileWalkRuler() {
  const ticks = useMemo(() => buildWalkTicks(), []);
  const geometry = useMemo(() => buildWalkRulerGeometry(ticks), [ticks]);
  const [x] = squareToPosition(`${WALK_RULER_FILE}1`);
  const spineLength = WALK_RULER_RANKS * SQUARE_SPAN;

  return (
    <group position={[x, 0.015, 0]}>
      {/* the travel line itself, full board length */}
      <mesh rotation={FLAT_ROTATION} position={[0, 0.001, 0]}>
        <planeGeometry args={[0.01, spineLength]} />
        <meshBasicMaterial color="#4488ff" transparent opacity={0.85} />
      </mesh>

      {/* cross-ticks: long+bright at each square center, short otherwise */}
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.55} />
      </lineSegments>

      {/* continuous distance-from-h1 number, every 0.2, all the way down the file */}
      {ticks
        .filter((tick) => Math.round(tick.continuous * 10) % Math.round(WALK_LABEL_STEP * 10) === 0)
        .map((tick) => (
          <Text
            key={`n-${tick.z}`}
            position={[0.14, 0.02, tick.z]}
            rotation={FLAT_ROTATION}
            fontSize={tick.isCenter ? 0.065 : 0.05}
            color={LABEL_COLOR}
            outlineWidth={LABEL_OUTLINE_WIDTH}
            outlineColor={LABEL_OUTLINE}
            anchorX="left"
            anchorY="middle"
          >
            {tick.continuous.toFixed(1)}
          </Text>
        ))}

      {/* square name at each center, on the other side of the line so it never collides with the number */}
      {ticks
        .filter((tick) => tick.isCenter)
        .map((tick) => (
          <Text
            key={`s-${tick.z}`}
            position={[-0.14, 0.02, tick.z]}
            rotation={FLAT_ROTATION}
            fontSize={0.06}
            color={LABEL_COLOR}
            outlineWidth={LABEL_OUTLINE_WIDTH}
            outlineColor={LABEL_OUTLINE}
            anchorX="right"
            anchorY="middle"
          >
            {WALK_RULER_FILE}
            {tick.rank}
          </Text>
        ))}
    </group>
  );
}
