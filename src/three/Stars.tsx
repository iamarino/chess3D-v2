'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

const STAR_COUNT = 500;
const STAR_RADIUS = 55; // um pouco dentro do céu esférico (raio 60) do Environment

/** Campo estático de estrelas — pontos brancos/azulados espalhados no hemisfério do céu noturno. */
export function Stars({ count = STAR_COUNT }: { count?: number }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      // Amostra só o hemisfério superior (y > 0) — não há estrela visível
      // abaixo do horizonte de qualquer ângulo de câmera usado no jogo.
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random()); // enviesa pro topo, mais estrelas no zênite
      const x = STAR_RADIUS * Math.sin(phi) * Math.cos(theta);
      const y = STAR_RADIUS * Math.cos(phi);
      const z = STAR_RADIUS * Math.sin(phi) * Math.sin(theta);
      positions.set([x, y, z], i * 3);

      const tint = 0.7 + Math.random() * 0.3;
      color.setRGB(tint, tint, Math.min(1, tint + 0.08));
      colors.set([color.r, color.g, color.b], i * 3);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geom;
  }, [count]);

  return (
    <points geometry={geometry} renderOrder={-1}>
      <pointsMaterial size={0.35} vertexColors sizeAttenuation depthWrite={false} transparent opacity={0.9} />
    </points>
  );
}
