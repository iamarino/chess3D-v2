/** Fração da duração gasta acelerando (e outro tanto desacelerando), ao andar. */
export const WALK_RAMP = 0.18;

/** A partir de quantas casas a peça troca walkClip por runClip. */
export const RUN_DISTANCE_THRESHOLD = 2;

/** Transição entre a pose parada e a caminhada/corrida. */
export const BLEND_LAMBDA = 16;

/** Velocidade com que a peça se vira para a direção do movimento. */
export const TURN_LAMBDA = 11;

/** Erro de ângulo (rad) para considerar a peça alinhada antes do golpe. */
export const STRIKE_ALIGNED_EPS = 0.04;

/** Duração do deslize das peças sem clipe de caminhada. */
export const GLIDE_DURATION = 0.42;

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/** Interpola ângulos pelo caminho mais curto. */
export function dampAngle(current: number, target: number, lambda: number, delta: number): number {
  let diff = (target - current) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * (1 - Math.exp(-lambda * delta));
}
