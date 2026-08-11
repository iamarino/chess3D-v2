'use client';

const WALL_DIST = 8;
const WALL_LENGTH = WALL_DIST * 2;
const WALL_HEIGHT = 1.1;
const WALL_THICKNESS = 0.5;
const MERLON_SIZE = 0.5;
const MERLON_SPACING = 1;
const STONE_COLOR = '#8a8378';

interface WallSegmentProps {
  position: [number, number, number];
  rotationY: number;
}

/** One crenellated stretch of parapet: a base wall strip topped with evenly spaced merlon blocks. */
function WallSegment({ position, rotationY }: WallSegmentProps) {
  const merlonCount = Math.floor(WALL_LENGTH / MERLON_SPACING);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, WALL_HEIGHT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[WALL_LENGTH, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color={STONE_COLOR} roughness={0.92} flatShading />
      </mesh>
      {Array.from({ length: merlonCount }, (_, i) => {
        const x = -WALL_LENGTH / 2 + (i + 0.5) * (WALL_LENGTH / merlonCount);
        return (
          <mesh key={i} position={[x, WALL_HEIGHT + MERLON_SIZE / 2, 0]} castShadow>
            <boxGeometry args={[MERLON_SIZE, MERLON_SIZE, WALL_THICKNESS]} />
            <meshStandardMaterial color={STONE_COLOR} roughness={0.92} flatShading />
          </mesh>
        );
      })}
    </group>
  );
}

/** Low crenellated parapet ring around the board — a castle balcony looking out over the mountains. */
export function CastleWalls() {
  return (
    <>
      <WallSegment position={[0, 0, WALL_DIST]} rotationY={0} />
      <WallSegment position={[0, 0, -WALL_DIST]} rotationY={0} />
      <WallSegment position={[WALL_DIST, 0, 0]} rotationY={Math.PI / 2} />
      <WallSegment position={[-WALL_DIST, 0, 0]} rotationY={Math.PI / 2} />
    </>
  );
}
