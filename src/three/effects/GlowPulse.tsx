'use client';

import { useFrame } from '@react-three/fiber';
import { GLOW_INTENSITY, glowMaterials } from '../ModelLoader';

const PULSE_SPEED = 2.6;
const PULSE_MIN = 0.85;

/**
 * Faz as gemas/cristais acesos por `ModelLoader.applyGlow` pulsarem como
 * batimento, em vez de brilho estático — um único `useFrame` anima a
 * intensidade de todo `glowMaterials` de uma vez (os materiais são
 * compartilhados entre instâncias da mesma peça, então isso já cobre os oito
 * peões vilões, a torre vilã, a torre herói etc. de uma só vez — vermelho e
 * azul pulsam juntos, cada material já guarda sua própria cor em
 * `material.emissive`).
 */
export function GlowPulse() {
  useFrame(({ clock }) => {
    if (glowMaterials.size === 0) return;
    const wave = 0.5 + 0.5 * Math.sin(clock.elapsedTime * PULSE_SPEED);
    const intensity = PULSE_MIN + (GLOW_INTENSITY - PULSE_MIN) * wave;
    glowMaterials.forEach((material) => {
      material.emissiveIntensity = intensity;
    });
  });
  return null;
}
