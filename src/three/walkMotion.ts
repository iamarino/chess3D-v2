import * as THREE from 'three';

/**
 * Locomoção por root motion.
 *
 * O clipe de caminhada do peão herói é autorado com root motion de verdade: o
 * osso raiz avança 1.187 unidades por ciclo e, durante o apoio, o pé fica
 * imóvel no mundo (medido: ~0.08 un/s no apoio contra ~1.3 un/s no balanço).
 * Ou seja, a passada da animação já descreve exatamente quanto chão o
 * personagem cobre.
 *
 * Antes o avanço do clipe era aplicado ao osso E a peça era interpolada por
 * fora, somando dois movimentos e obrigando a "calibrar" um ponto de parada
 * com correção no fim — de onde vinha o deslize. Aqui invertemos: o avanço é
 * removido do osso (clipe vira in-place) e passa a ser a ÚNICA fonte da
 * posição da peça no tabuleiro. Como posição e pose derivam da mesma fase,
 * o pé não escorrega em nenhum instante, seja qual for o ritmo escolhido.
 */
export interface WalkMotion {
  /** Clipe sem o avanço do osso raiz — pode tocar parado no lugar. */
  clip: THREE.AnimationClip;
  duration: number;
  /** Distância (em unidades de mundo) coberta por um ciclo completo. */
  loopDistance: number;
  /** Instantes do clipe (s) em que um pé encosta no chão. */
  footfalls: number[];
  /** Distância média de mundo coberta por passo. */
  stride: number;
  /** Distância de mundo percorrida do início do clipe até `phase`. */
  displacementAt(phase: number): number;
}

export interface WalkPlan {
  /** Fase inicial: um footfall, para a caminhada começar com o pé plantado. */
  startPhase: number;
  /** Quanto de fase (segundos de clipe) a caminhada avança no total. */
  totalPhase: number;
  startDisplacement: number;
  /**
   * Correção fina de passada. O número de passos é inteiro, então a distância
   * autoral raramente casa com a casa destino no milímetro; este fator estica
   * ou comprime o avanço para fechar exatamente no centro da casa. Fica em
   * ~0.98 para 1 casa e ~0.99 para 2 — imperceptível.
   */
  warp: number;
  steps: number;
}

/** Acha a track de posição com maior amplitude — é o osso que carrega o root motion. */
function findRootMotionTrack(clip: THREE.AnimationClip): THREE.KeyframeTrack | null {
  let best: THREE.KeyframeTrack | null = null;
  let bestSpan = 0;

  for (const track of clip.tracks) {
    if (!track.name.endsWith('.position')) continue;
    const values = track.values;
    const count = Math.floor(values.length / 3);
    if (count < 2) continue;

    let span = 0;
    for (let axis = 0; axis < 3; axis++) {
      let min = Infinity;
      let max = -Infinity;
      for (let k = 0; k < count; k++) {
        const value = values[k * 3 + axis];
        if (value < min) min = value;
        if (value > max) max = value;
      }
      span = Math.max(span, max - min);
    }

    if (span > bestSpan) {
      bestSpan = span;
      best = track;
    }
  }

  return best;
}

/**
 * Extrai o root motion de `source` e devolve o clipe já in-place junto da
 * curva de avanço. Devolve null se o clipe não tiver deslocamento — nesse
 * caso não há como dirigir a posição pela animação.
 */
export function createWalkMotion(
  source: THREE.AnimationClip,
  modelScale: number,
  footfalls: number[],
): WalkMotion | null {
  const track = findRootMotionTrack(source);
  if (!track) return null;

  const values = track.values;
  const count = Math.floor(values.length / 3);

  // Eixo de avanço = o que mais se desloca entre o primeiro e o último quadro.
  // No peão herói o osso Hip anda em -Y local, que a rotação da Armature
  // (Z-up -> Y-up) transforma no +Z da cena.
  let axis = 0;
  let bestDelta = 0;
  for (let a = 0; a < 3; a++) {
    const delta = Math.abs(values[(count - 1) * 3 + a] - values[a]);
    if (delta > bestDelta) {
      bestDelta = delta;
      axis = a;
    }
  }

  const total = values[(count - 1) * 3 + axis] - values[axis];
  if (Math.abs(total) < 1e-4) return null;

  // Normaliza o sinal: `displacement` cresce conforme o personagem avança,
  // independente de o osso andar no sentido positivo ou negativo do eixo.
  const sign = Math.sign(total);
  const times = Array.from(track.times);
  const displacement: number[] = [];
  for (let k = 0; k < count; k++) {
    displacement.push((values[k * 3 + axis] - values[axis]) * sign * modelScale);
  }
  const loopDistance = Math.abs(total) * modelScale;

  // Clipe in-place: congela o eixo de avanço no valor inicial. O que foi
  // retirado daqui é reaplicado no grupo da peça, com a mesma curva, então o
  // movimento total continua idêntico ao autorado.
  const clip = source.clone();
  const inPlace = clip.tracks.find((t) => t.name === track.name);
  if (inPlace) {
    const base = inPlace.values[axis];
    const inPlaceCount = Math.floor(inPlace.values.length / 3);
    for (let k = 0; k < inPlaceCount; k++) inPlace.values[k * 3 + axis] = base;
  }

  function sample(time: number): number {
    if (time <= times[0]) return displacement[0];
    if (time >= times[count - 1]) return displacement[count - 1];
    let i = 1;
    while (i < count && times[i] < time) i++;
    const span = times[i] - times[i - 1];
    const f = span > 0 ? (time - times[i - 1]) / span : 0;
    return displacement[i - 1] + (displacement[i] - displacement[i - 1]) * f;
  }

  const duration = source.duration;

  const sorted = footfalls.filter((t) => t >= 0 && t < duration).sort((a, b) => a - b);

  return {
    clip,
    duration,
    loopDistance,
    footfalls: sorted,
    stride: sorted.length > 0 ? loopDistance / sorted.length : loopDistance,
    // Além de um ciclo a fase continua avançando: soma os ciclos inteiros já
    // percorridos com o resto interpolado na curva.
    displacementAt(phase: number): number {
      const loops = Math.floor(phase / duration);
      return loops * loopDistance + sample(phase - loops * duration);
    },
  };
}

/**
 * Monta a caminhada para cobrir `distance`: escolhe um número inteiro de
 * passos e termina a fase exatamente num footfall. Terminar com o pé
 * encostando é o que faz a parada coincidir com a desaceleração — o pé de
 * apoio já está imóvel no chão quando a peça para, então não há deslize nem
 * salto de correção.
 */
export function planWalk(motion: WalkMotion, distance: number, maxSteps = 16): WalkPlan {
  const { footfalls, duration, stride, displacementAt } = motion;

  if (footfalls.length === 0) {
    const startDisplacement = displacementAt(0);
    const totalPhase = (distance / motion.loopDistance) * duration;
    return { startPhase: 0, totalPhase, startDisplacement, warp: 1, steps: 0 };
  }

  const startPhase = footfalls[0];
  const startDisplacement = displacementAt(startPhase);
  const steps = Math.min(maxSteps, Math.max(1, Math.round(distance / stride)));

  const loops = Math.floor(steps / footfalls.length);
  const endPhase = footfalls[steps % footfalls.length] + loops * duration;
  const travelled = displacementAt(endPhase) - startDisplacement;

  return {
    startPhase,
    totalPhase: endPhase - startPhase,
    startDisplacement,
    warp: travelled > 1e-5 ? distance / travelled : 1,
    steps,
  };
}

/**
 * Progresso da fase ao longo do movimento, com rampas de aceleração e
 * desaceleração de `ramp` (fração da duração) em cada ponta.
 *
 * A cadência das pernas e o avanço no tabuleiro saem os dois desta mesma
 * curva, então acelerar ou desacelerar nunca dessincroniza o pé do chão:
 * quando a peça desacelera, os passos desaceleram junto, na mesma proporção.
 * Rampas em smoothstep (sem quebra de aceleração) e miolo em velocidade
 * constante — o perfil de partida/parada que se espera de uma caminhada.
 */
export function rampedProgress(u: number, ramp: number): number {
  const r = Math.min(0.49, Math.max(0.01, ramp));
  const total = 1 - r;
  // Integral do smoothstep(x) = x^3 - x^4/2, que vale 0.5 em x = 1.
  const easeArea = (x: number) => x * x * x - 0.5 * x * x * x * x;

  let area: number;
  if (u < r) {
    area = r * easeArea(u / r);
  } else if (u <= 1 - r) {
    area = 0.5 * r + (u - r);
  } else {
    area = total - r * easeArea((1 - u) / r);
  }
  return area / total;
}
