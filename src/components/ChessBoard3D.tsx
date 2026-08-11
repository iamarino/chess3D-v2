'use client';

import { Scene } from '@/three/Scene';

export function ChessBoard3D() {
  return (
    <div className="absolute inset-0">
      <Scene />
    </div>
  );
}
