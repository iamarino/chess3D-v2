'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { ChessPiece } from '@/core/chess/types';
import { useGameStore } from '@/store/useGameStore';
import { DEFAULT_PIECE_MODEL_OFFSET, useSettingsStore } from '@/store/useSettingsStore';
import { heroesVillainsTheme } from '@/themes/heroes-villains/theme';
import { cloneSkinnedScene, getModelConfig, type PieceModelConfig } from './ModelLoader';
import { squareToPosition } from './boardUtils';
import { createWalkMotion, planWalk, rampedProgress, type WalkMotion, type WalkPlan } from './walkMotion';

const theme = heroesVillainsTheme;

/** Fração da duração gasta acelerando (e outro tanto desacelerando), ao andar. */
const WALK_RAMP = 0.18;
/**
 * A partir de quantas casas de deslocamento a peça troca `walkClip` por
 * `runClip` (quando o modelo tem um configurado — hoje só a torre vilã).
 * Sem `runClip`, qualquer distância usa `walkClip`, como sempre.
 */
const RUN_DISTANCE_THRESHOLD = 2;
/** Transição entre a pose parada e a caminhada/corrida. */
const BLEND_LAMBDA = 16;
/** Velocidade com que a peça se vira para a direção do movimento. */
const TURN_LAMBDA = 11;
/**
 * Erro de ângulo (radianos) abaixo do qual a peça já é considerada virada para
 * o adversário e o golpe pode começar — ver `strikePhaseRef` em `Piece`.
 */
const STRIKE_ALIGNED_EPS = 0.04;
/** Duração do deslize das peças sem clipe de caminhada (todas menos o peão herói). */
const GLIDE_DURATION = 0.42;

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/** Interpola ângulos pelo caminho mais curto, para a peça nunca girar "por fora". */
function dampAngle(current: number, target: number, lambda: number, delta: number): number {
  let diff = (target - current) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * (1 - Math.exp(-lambda * delta));
}

/**
 * Toca (ou desliga) a action de locomoção `action` conforme `active`, mesmo
 * mecanismo pro walkClip e pro runClip — só muda qual dos dois está ativo no
 * momento. Como em qualquer clipe de root motion, a fase é ditada por quem
 * chama (o trajeto em `Piece`), não pelo relógio do mixer: a action fica
 * `paused` e recebe `time` a cada quadro.
 */
function driveLocomotion(
  action: THREE.AnimationAction | null | undefined,
  motion: WalkMotion | null,
  active: boolean,
  phase: number | null,
  delta: number,
  startedRef: { current: boolean },
): void {
  if (!action || !motion) return;
  if (active) {
    if (!startedRef.current) {
      action.reset().play();
      startedRef.current = true;
    }
    action.paused = true;
    action.time = (phase ?? 0) % motion.duration;
  } else if (startedRef.current && action.weight < 0.01) {
    action.stop();
    startedRef.current = false;
  }
  action.weight = THREE.MathUtils.damp(action.weight, active ? 1 : 0, BLEND_LAMBDA, delta);
}

// Extrair o root motion custa uma varredura das keyframes, então é feito uma
// única vez por modelo+clipe — o resultado é imutável e compartilhado por
// todas as instâncias (os oito peões usam o mesmo clipe).
const motionCache = new Map<string, WalkMotion | null>();

function loadMotion(
  path: string,
  animations: THREE.AnimationClip[],
  clipName: string | undefined,
  footfalls: number[] | undefined,
  scale: number,
): WalkMotion | null {
  if (!clipName || !footfalls) return null;
  const cacheKey = `${path}::${clipName}`;
  const cached = motionCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const source = animations.find((clip) => clip.name === clipName) ?? null;
  const motion = source ? createWalkMotion(source, scale, footfalls) : null;
  motionCache.set(cacheKey, motion);
  return motion;
}

/** `walkClip` e `runClip` (quando existir) do modelo, cada um sua própria WalkMotion. */
function useLocomotionMotions(config: PieceModelConfig): { walk: WalkMotion | null; run: WalkMotion | null } {
  const { animations } = useGLTF(config.path);
  return useMemo(
    () => ({
      walk: loadMotion(config.path, animations, config.walkClip, config.walkFootfalls, config.scale),
      run: loadMotion(config.path, animations, config.runClip, config.runFootfalls, config.scale),
    }),
    [animations, config],
  );
}

/**
 * Fase atual do clipe de caminhada, ou null quando a peça está parada.
 * É o único canal entre a locomoção (que vive em `Piece`, junto da posição no
 * tabuleiro) e o mixer de animação (que vive aqui): as duas leem a mesma fase,
 * e é justamente isso que mantém pé e chão sincronizados.
 */
type PhaseRef = { current: number | null };

/**
 * 'attack' é um pedido de um-tiro: `Piece` escreve 'attack' assim que a
 * caminhada termina num lance de captura; `PieceModel` consome — toca o
 * clipe e devolve para 'idle' sozinho quando ele acaba (evento `finished` do
 * mixer). Ao contrário da fase da caminhada, aqui não há posição para
 * sincronizar: o golpe toca com o próprio root motion do clipe, em espaço
 * local, porque a peça já está parada no centro da casa quando ele começa.
 */
type ActionRef = { current: 'idle' | 'attack' };

/** Qual das duas locomoções (se houver runClip) está em uso no trajeto atual. */
type LocomotionRef = { current: 'walk' | 'run' | null };

function PieceModel({
  color,
  type,
  walkMotion,
  runMotion,
  locomotionRef,
  phaseRef,
  actionRef,
}: {
  color: ChessPiece['color'];
  type: ChessPiece['type'];
  walkMotion: WalkMotion | null;
  runMotion: WalkMotion | null;
  locomotionRef: LocomotionRef;
  phaseRef: PhaseRef;
  actionRef: ActionRef;
}) {
  const config = getModelConfig(color, type);
  const { scene, animations } = useGLTF(config.path);
  const animationRoot = useRef<THREE.Group>(null);
  // Correção de posição por modelo, ao vivo (ver PieceModelOffset) — lida das
  // configurações para o painel "Ajuste de posição" refletir na hora.
  const modelOffset = useSettingsStore((s) => s.pieceModelOffsets[`${color}-${type}`] ?? DEFAULT_PIECE_MODEL_OFFSET);

  const cloned = useMemo(
    () => cloneSkinnedScene(scene, color, config.glow !== false),
    [scene, color, config.glow],
  );

  // Troca o clipe de caminhada pela versão in-place: o avanço do osso raiz foi
  // extraído e agora é aplicado por `Piece` na posição do grupo.
  //
  // Quando introClip e attackClip apontam para o MESMO clipe (torre vilã:
  // ambos usam o golpe), duplica o clipe sob um nome à parte para a intro.
  // Sem isso, `actions[introClipName]` e `actions[attackClipName]` seriam o
  // mesmo objeto AnimationAction, e o bloco de peso da intro (mais abaixo, no
  // useFrame) rodaria depois do bloco de golpe e cancelaria o peso que o
  // golpe acabou de subir — o ataque nunca chegaria a peso 1.
  const INTRO_CLONE_SUFFIX = '__intro-clone';
  const clips = useMemo(() => {
    let result = animations;
    if (walkMotion && config.walkClip) {
      result = result.map((clip) => (clip.name === config.walkClip ? walkMotion.clip : clip));
    }
    if (runMotion && config.runClip) {
      result = result.map((clip) => (clip.name === config.runClip ? runMotion.clip : clip));
    }
    if (config.introClip && config.introClip === config.attackClip) {
      const shared = result.find((clip) => clip.name === config.introClip);
      if (shared) {
        const introClone = shared.clone();
        introClone.name = `${config.introClip}${INTRO_CLONE_SUFFIX}`;
        result = [...result, introClone];
      }
    }
    return result;
  }, [animations, walkMotion, runMotion, config.walkClip, config.runClip, config.introClip, config.attackClip]);

  // A maioria das peças é malha estática sem `animations` e este hook vira
  // no-op. Modelos gerados com a ferramenta de animação da Tripo (hoje os
  // peões) tocam o clipe de introdução uma vez ao aparecer e congelam na
  // última pose — é essa pose que serve de "parado" entre as jogadas.
  const { actions, names, mixer } = useAnimations(clips, animationRoot);

  // O getter `actions[name]` da drei só cria (e memoriza) a AnimationAction
  // depois que `animationRoot.current` existe, o que não vale ainda na
  // primeira renderização — resolver por useMemo congelaria tudo em undefined.
  // Buscar por nome dentro de efeitos/useFrame pega a action de verdade.
  const introSourceName =
    config.introClip && config.introClip === config.attackClip
      ? `${config.introClip}${INTRO_CLONE_SUFFIX}`
      : config.introClip;
  const introClipName = names.length > 0 ? (introSourceName && names.includes(introSourceName) ? introSourceName : names[0]) : null;
  const walkClipName = config.walkClip && names.includes(config.walkClip) ? config.walkClip : null;
  const runClipName = config.runClip && names.includes(config.runClip) ? config.runClip : null;
  const attackClipName = config.attackClip && names.includes(config.attackClip) ? config.attackClip : null;

  useEffect(() => {
    if (!introClipName) return;
    const action = actions[introClipName];
    if (!action) return;
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.reset().play();
    return () => {
      action.stop();
    };
  }, [actions, introClipName]);

  useEffect(() => {
    if (!attackClipName) return;
    const action = actions[attackClipName];
    if (!action) return;
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
  }, [actions, attackClipName]);

  // Devolve `actionRef` para 'idle' sozinho quando o golpe termina — `Piece`
  // só precisa saber pedir o golpe, não acompanhar quando ele acaba.
  useEffect(() => {
    if (!attackClipName) return;
    const action = actions[attackClipName];
    if (!action) return;
    const onFinished = (event: { action: THREE.AnimationAction }) => {
      if (event.action === action && actionRef.current === 'attack') actionRef.current = 'idle';
    };
    mixer.addEventListener('finished', onFinished);
    return () => mixer.removeEventListener('finished', onFinished);
  }, [actions, attackClipName, mixer, actionRef]);

  const walkStartedRef = useRef(false);
  const runStartedRef = useRef(false);
  const attackStartedRef = useRef(false);

  useFrame((_, delta) => {
    const walking = phaseRef.current !== null;
    const attacking = actionRef.current === 'attack';
    const locomotion = locomotionRef.current;

    driveLocomotion(
      walkClipName ? actions[walkClipName] : undefined,
      walkMotion,
      walking && locomotion === 'walk',
      phaseRef.current,
      delta,
      walkStartedRef,
    );
    driveLocomotion(
      runClipName ? actions[runClipName] : undefined,
      runMotion,
      walking && locomotion === 'run',
      phaseRef.current,
      delta,
      runStartedRef,
    );

    if (attackClipName) {
      const attackAction = actions[attackClipName];
      if (attackAction) {
        if (attacking && !attackStartedRef.current) {
          attackAction.reset().play();
          attackStartedRef.current = true;
        } else if (!attacking) {
          attackStartedRef.current = false;
        }
        // Rede de segurança para o fim do golpe. O caminho normal é o evento
        // 'finished' do mixer (efeito acima), mas se ele se perder — um
        // re-registro do listener no meio do clipe, por exemplo — `actionRef`
        // ficaria em 'attack' para sempre: a peça nunca andaria até a casa
        // conquistada e ficaria parada na casa de origem, atrasada em relação à
        // sua casa lógica. Com `clampWhenFinished` a action termina pausada no
        // último quadro, então "parou de rodar com o tempo já andado" é o mesmo
        // sinal, lido do estado em vez do evento. `time > 0` evita disparar no
        // próprio quadro do `play()`, quando o tempo ainda é 0.
        if (attacking && attackStartedRef.current && attackAction.time > 0 && !attackAction.isRunning()) {
          actionRef.current = 'idle';
        }
        attackAction.weight = THREE.MathUtils.damp(attackAction.weight, attacking ? 1 : 0, BLEND_LAMBDA, delta);
      }
    }

    // Crossfade por peso. Parado (nem andando, nem golpeando) volta sempre
    // para a mesma pose de descanso dos peões que ainda não jogaram — antes
    // ela congelava na pose de caminhada e cada peão acabava parado num
    // meio-passo diferente.
    if (introClipName) {
      const introAction = actions[introClipName];
      if (introAction) {
        const idleTarget = walking || attacking ? 0 : 1;
        introAction.weight = THREE.MathUtils.damp(introAction.weight, idleTarget, BLEND_LAMBDA, delta);
      }
    }
  });

  return (
    <group ref={animationRoot}>
      <primitive
        object={cloned}
        position={[modelOffset.x, modelOffset.y, modelOffset.z]}
        rotation={config.rotation}
        scale={config.scale}
      />
    </group>
  );
}

interface PieceProps {
  piece: ChessPiece;
}

interface WalkState {
  from: THREE.Vector3;
  target: THREE.Vector3;
  direction: THREE.Vector3;
  plan: WalkPlan;
  /** A WalkMotion usada neste trajeto — caminhada ou corrida, decidida em `beginTravel`. */
  motion: WalkMotion;
  /** Fração de rampa deste trajeto — fixa ao andar, proporcional à distância ao correr. */
  ramp: number;
  duration: number;
  elapsed: number;
  yaw: number;
}

interface GlideState {
  from: THREE.Vector3;
  target: THREE.Vector3;
  elapsed: number;
}

export function Piece({ piece }: PieceProps) {
  const groupRef = useRef<THREE.Group>(null);
  const select = useGameStore((s) => s.select);
  const selectedSquare = useGameStore((s) => s.selectedSquare);
  const isSelected = selectedSquare === piece.square;
  const config = getModelConfig(piece.color, piece.type);
  const { walk: walkMotion, run: runMotion } = useLocomotionMotions(config);
  const pieceWalkAnimation = useSettingsStore((s) => s.pieceWalkAnimation);
  // Multiplicador da cadência autoral. Como a posição vem da fase, mudar o
  // ritmo acelera a caminhada inteira sem nunca descolar o pé do chão — o que
  // não era verdade quando a duração era fixa e a distância variava.
  const pieceWalkTempo = useSettingsStore((s) => s.pieceWalkTempo);

  const walkRef = useRef<WalkState | null>(null);
  const glideRef = useRef<GlideState | null>(null);
  const phaseRef = useRef<number | null>(null);
  const actionRef = useRef<'idle' | 'attack'>('idle');
  const locomotionRef = useRef<'walk' | 'run' | null>(null);

  // Casa de destino de uma captura com golpe, enquanto a peça ainda não
  // começou a andar até lá — não nulo do instante em que o golpe começa até
  // a caminhada de fato começar (golpe terminado e, se o adversário tiver
  // queda, queda também terminada). Ver `useFrame` abaixo.
  const captureTargetRef = useRef<THREE.Vector3 | null>(null);
  // Yaw em que a peça fica plantada durante o golpe, calculado uma vez no
  // instante da captura. NÃO é a direção do adversário: é a direção que faz o
  // golpe cair sobre ele (`direção do alvo - config.attackYaw`). Para um golpe
  // frontal os dois coincidem; para um lateral, como o chute do peão vilão, a
  // peça fica de lado para o adversário — que é justamente a pose de quem vai
  // acertar um chute giratório.
  const captureYawRef = useRef(0);
  /**
   * Fase da captura com golpe, entre o lance e a caminhada até a casa:
   *
   *   'turning'  — parada, girando até `captureYawRef`; o golpe ainda não
   *                começou. A virada vem ANTES do clipe justamente para o pé
   *                sair já na direção certa: girar durante o golpe faria o
   *                chute começar fora de eixo (o peso do clipe sobe com
   *                BLEND_LAMBDA, mais rápido que o giro em TURN_LAMBDA).
   *   'striking' — clipe do golpe tocando.
   *   null       — sem golpe pendente; é a única fase em que a peça pode andar.
   *
   * É uma fase só, e não dois booleanos, porque `actionRef === 'idle'` é
   * ambíguo: significa tanto "o golpe ainda não começou" quanto "o golpe
   * acabou". Ler 'idle' como "acabou" durante a virada liberava a queda do
   * adversário e mandava a peça andar antes do chute — ela chegava na casa do
   * adversário e só então golpeava.
   */
  const strikePhaseRef = useRef<'turning' | 'striking' | null>(null);
  // Id da peça capturada, para saber (via `capturedGhosts` do store) quando
  // a queda dela terminou.
  const captureDefenderIdRef = useRef<string | null>(null);
  // Captura a mais de 1 casa de distância (torre): o golpe só começa quando a
  // peça chega adjacente ao alvo — antes disso ela anda/corre normalmente até
  // lá. Guarda o destino real e o defensor para o golpe disparar assim que
  // essa aproximação terminar (ver `useFrame`, no fim do bloco de caminhada).
  // Sem isso o golpe tocaria a distância, como se a peça "já soubesse" que
  // vai vencer antes de chegar perto do adversário.
  const pendingAttackRef = useRef<{ target: THREE.Vector3; defenderId: string; yaw: number } | null>(null);

  // Guarda a última casa em vez de um booleano de "montado": em dev o Strict
  // Mode reexecuta este efeito logo após montar, e uma flag já leria "montado"
  // nessa reexecução, tratando o replay como jogada e disparando a caminhada
  // de todas as peças no carregamento. Comparar casas é idempotente.
  const lastSquareRef = useRef<string | null>(null);

  // A posição pertence aos tweens do useFrame. Ela NÃO pode também ser prop
  // reativa no JSX: um `position={...}` ligado a `piece.square` seria
  // reaplicado na mesma renderização em que a jogada muda a casa — antes do
  // efeito rodar — teleportando a peça para o destino e zerando a distância
  // que a caminhada deveria percorrer.
  useLayoutEffect(() => {
    groupRef.current?.position.set(...squareToPosition(piece.square));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Começa o trajeto (caminhada por root motion ou deslize) de `from` até
  // `target`. Usado tanto pela jogada normal (efeito abaixo) quanto pela
  // continuação de uma captura com golpe, uma vez que o golpe — e a queda do
  // adversário, se houver — já terminaram (`useFrame` abaixo).
  function beginTravel(from: THREE.Vector3, target: THREE.Vector3) {
    const group = groupRef.current;
    if (!group) return;

    const direction = target.clone().sub(from);
    const distance = direction.length();

    if (distance < 1e-4) {
      group.position.copy(target);
      walkRef.current = null;
      glideRef.current = null;
      phaseRef.current = null;
      locomotionRef.current = null;
      return;
    }

    // A frente do modelo é o +Z da cena girado pela rotação de correção do
    // config; o grupo gira o quanto falta para essa frente apontar para o
    // destino. Para o peão herói andando reto isso dá 0, que é exatamente como
    // ele já ficava — a virada só aparece nas capturas na diagonal.
    const yaw = Math.atan2(direction.x, direction.z) - config.rotation[1];
    direction.normalize();

    // Casas são unidades de mundo (SQUARE_SIZE = 1) e a torre só anda em reta,
    // então `distance` já é o número de casas do lance. Acima do limiar troca
    // `walkClip` por `runClip` (se o modelo tiver um configurado).
    const distanceSquares = Math.round(distance);
    const useRun = distanceSquares > RUN_DISTANCE_THRESHOLD && runMotion !== null;
    const motion = useRun ? runMotion : walkMotion;

    if (!motion || !pieceWalkAnimation) {
      walkRef.current = null;
      phaseRef.current = null;
      locomotionRef.current = null;
      glideRef.current = { from, target, elapsed: 0 };
      return;
    }

    const plan = planWalk(motion, distance);
    // Correndo, a rampa cobre proporcionalmente a última casa do trajeto
    // (1/distanceSquares) em vez da fração fixa da caminhada — como a fase
    // avança ~linear fora das próprias rampas, isso faz a desaceleração já
    // ter começado ao entrar na penúltima casa, qualquer que seja a distância.
    const ramp = useRun ? 1 / distanceSquares : WALK_RAMP;

    glideRef.current = null;
    locomotionRef.current = useRun ? 'run' : 'walk';
    walkRef.current = {
      from,
      target,
      direction,
      plan,
      motion,
      ramp,
      duration: Math.max(0.15, plan.totalPhase / Math.max(0.1, pieceWalkTempo)),
      elapsed: 0,
      yaw,
    };
    phaseRef.current = plan.startPhase;
  }

  useEffect(() => {
    const previousSquare = lastSquareRef.current;
    lastSquareRef.current = piece.square;
    const group = groupRef.current;
    if (!group || previousSquare === null || previousSquare === piece.square) return;

    const target = new THREE.Vector3(...squareToPosition(piece.square));
    // Só a peça que acabou de jogar caminha. Sem isso um "reiniciar" ou
    // "desfazer" — que reposiciona várias peças de uma vez — faria o tabuleiro
    // inteiro sair andando.
    const { lastMove, lastCapture } = useGameStore.getState();
    const isPlayedMove = lastMove?.to === piece.square && lastMove?.from === previousSquare;

    // Auto-correção de posição. O normal é partir de onde a peça realmente
    // está — uma jogada que chega no meio da animação anterior não deve dar
    // salto. Mas se o modelo ficou LONGE da casa de origem, ele não está no
    // meio de um tween: uma animação anterior não chegou ao fim e a peça ficou
    // para trás. Nesse caso a casa lógica é a verdade e o modelo é reassentado
    // nela antes de qualquer cálculo.
    //
    // Sem isto, a captura seguinte mede direção e distância a partir do lugar
    // errado: era o que fazia o segundo golpe do peão sair da casa de origem e
    // acontecer já em cima do adversário. Meia casa de tolerância separa os
    // dois casos — um tween em andamento nunca passa disso, uma peça deixada
    // para trás fica a uma casa inteira ou mais.
    const previousPosition = new THREE.Vector3(...squareToPosition(previousSquare));
    const correcao = group.position.distanceTo(previousPosition) > 0.5;
    if (correcao) {
      group.position.copy(previousPosition);
      walkRef.current = null;
      glideRef.current = null;
      phaseRef.current = null;
      locomotionRef.current = null;
    }
    const from = group.position.clone();

    if (!isPlayedMove || from.distanceTo(target) < 1e-4) {
      group.position.copy(target);
      walkRef.current = null;
      glideRef.current = null;
      phaseRef.current = null;
      locomotionRef.current = null;
      captureTargetRef.current = null;
      captureDefenderIdRef.current = null;
      pendingAttackRef.current = null;
      strikePhaseRef.current = null;
      return;
    }

    if (lastCapture?.attackerId === piece.id && config.attackClip) {
      const direction = target.clone().sub(from);
      // Quantas CASAS o lance andou, contado no tabuleiro (distância de
      // Chebyshev entre as casas), não pela distância até onde o modelo está
      // renderizado. Medir pelo mundo faz uma captura de peão (1 passo na
      // diagonal, √2 ≈ 1.41 unidades) virar "2 casas" assim que a peça estiver
      // minimamente atrasada em relação à casa lógica — e aí ela cai no ramo de
      // captura à distância, que anda primeiro e só golpeia no fim.
      const distanceSquares = Math.max(
        Math.abs(piece.square.charCodeAt(0) - previousSquare.charCodeAt(0)),
        Math.abs(Number(piece.square[1]) - Number(previousSquare[1])),
      );
      // Yaw que coloca o GOLPE em cima do adversário: a frente do modelo aponta
      // para o alvo menos o desvio do próprio golpe (`attackYaw`). Num golpe
      // frontal o desvio é 0 e a peça encara o adversário como antes; no chute
      // lateral do peão vilão ela se planta de lado, com o pé — não o rosto —
      // apontado para a casa que vai ser capturada.
      const strikeYaw =
        Math.atan2(direction.x, direction.z) - config.rotation[1] - (config.attackYaw ?? 0);

      if (distanceSquares > 1) {
        // Captura à distância: anda/corre normalmente até ficar adjacente ao
        // alvo (uma casa antes) — o golpe só dispara quando essa aproximação
        // terminar, no bloco de chegada da caminhada em `useFrame`.
        const approach = target.clone().addScaledVector(direction.clone().normalize(), -1);
        // Durante a aproximação não há golpe pendente: a fase só volta a
        // 'turning' quando a caminhada chegar (bloco de `pendingAttackRef` em
        // `useFrame`). Deixar uma fase antiga aqui faria a checagem de
        // alinhamento disparar um golpe no meio do caminho.
        strikePhaseRef.current = null;
        captureTargetRef.current = null;
        captureDefenderIdRef.current = null;
        pendingAttackRef.current = { target, defenderId: lastCapture.defenderId, yaw: strikeYaw };
        beginTravel(from, approach);
        return;
      }

      // Já adjacente: a peça para na casa de origem, gira até `strikeYaw` e só
      // então bate (o disparo fica com `useFrame`, quando a virada terminar).
      // A caminhada (1 casa) só começa depois que o golpe termina — e, se o
      // adversário tiver queda, só depois que a queda também termina (ver
      // `useFrame` abaixo, que faz esse acompanhamento).
      captureYawRef.current = strikeYaw;
      captureTargetRef.current = target;
      captureDefenderIdRef.current = lastCapture.defenderId;
      pendingAttackRef.current = null;
      strikePhaseRef.current = 'turning';
      walkRef.current = null;
      glideRef.current = null;
      phaseRef.current = null;
      locomotionRef.current = null;
      return;
    }

    // Lance normal (sem golpe): zera também a fase, senão um golpe que ficou
    // pela metade continuaria valendo no lance seguinte desta peça.
    captureTargetRef.current = null;
    captureDefenderIdRef.current = null;
    pendingAttackRef.current = null;
    strikePhaseRef.current = null;
    beginTravel(from, target);
    // beginTravel não é memoizada, mas fecha sobre os mesmos valores já
    // listados abaixo — incluí-la só faria o efeito rodar de novo a cada
    // render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piece.square, piece.id, walkMotion, runMotion, pieceWalkAnimation, pieceWalkTempo, config.rotation, config.attackClip]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    // Captura com golpe em andamento: primeiro espera o golpe terminar (e aí
    // libera a queda do adversário), depois espera a queda sumir da cena, só
    // então começa a andar até a casa de destino.
    if (captureTargetRef.current) {
      if (strikePhaseRef.current === 'turning') {
        // Parada, girando. Quem passa daqui para 'striking' é a checagem de
        // alinhamento no fim deste mesmo useFrame.
      } else if (strikePhaseRef.current === 'striking') {
        // Só agora 'idle' quer dizer "o golpe acabou" — o clipe comprovadamente
        // começou. Aí o adversário é liberado para cair.
        if (actionRef.current === 'idle') {
          useGameStore.getState().releasePendingGhost();
          strikePhaseRef.current = null;
        }
      } else {
        const defenderId = captureDefenderIdRef.current;
        const stillFalling =
          defenderId !== null &&
          useGameStore.getState().capturedGhosts.some((ghost) => ghost.piece.id === defenderId);
        if (!stillFalling) {
          beginTravel(group.position.clone(), captureTargetRef.current);
          captureTargetRef.current = null;
          captureDefenderIdRef.current = null;
        }
      }
    }

    const walk = walkRef.current;
    if (walk) {
      walk.elapsed += delta;
      const u = Math.min(1, walk.elapsed / walk.duration);
      const phase = walk.plan.startPhase + walk.plan.totalPhase * rampedProgress(u, walk.ramp);
      phaseRef.current = phase;

      // Posição = avanço do próprio clipe. Não há interpolação independente
      // para a pose "alcançar": o chão percorrido é o que a animação diz.
      const travelled = (walk.motion.displacementAt(phase) - walk.plan.startDisplacement) * walk.plan.warp;
      group.position.copy(walk.from).addScaledVector(walk.direction, travelled);

      if (u >= 1) {
        // A fase parou num footfall, com o pé de apoio já imóvel: a peça
        // assenta no centro exato da casa sem correção nenhuma.
        group.position.copy(walk.target);
        walkRef.current = null;
        phaseRef.current = null;
        locomotionRef.current = null;

        // Chegou adjacente ao alvo de uma captura à distância: dispara o
        // golpe agora, no lugar de onde a aproximação parou (não na casa de
        // origem original).
        const pending = pendingAttackRef.current;
        if (pending) {
          pendingAttackRef.current = null;
          captureYawRef.current = pending.yaw;
          captureTargetRef.current = pending.target;
          captureDefenderIdRef.current = pending.defenderId;
          strikePhaseRef.current = 'turning';
        }
      }
    } else {
      const glide = glideRef.current;
      if (glide) {
        glide.elapsed += delta;
        const t = Math.min(1, glide.elapsed / GLIDE_DURATION);
        group.position.lerpVectors(glide.from, glide.target, easeInOutQuad(t));
        if (t >= 1) {
          group.position.copy(glide.target);
          glideRef.current = null;
        }
      }
    }

    // Durante o golpe (ainda parada, antes de andar) a peça fica plantada no
    // yaw que joga o golpe em cima do adversário — ver `captureYawRef`.
    const targetYaw = walk ? walk.yaw : captureTargetRef.current ? captureYawRef.current : 0;
    group.rotation.y = dampAngle(group.rotation.y, targetYaw, TURN_LAMBDA, delta);

    // Virada terminada: agora sim o golpe. Como o giro é exponencial, ele nunca
    // chega ao alvo exato — `STRIKE_ALIGNED_EPS` é o "perto o bastante" para o
    // pé cair na casa certa (a 1 casa de distância, 0.04 rad dá menos de 5 cm
    // de desvio).
    if (strikePhaseRef.current === 'turning') {
      let error = (captureYawRef.current - group.rotation.y) % (Math.PI * 2);
      if (error > Math.PI) error -= Math.PI * 2;
      if (error < -Math.PI) error += Math.PI * 2;
      if (Math.abs(error) < STRIKE_ALIGNED_EPS) {
        group.rotation.y = captureYawRef.current;
        strikePhaseRef.current = 'striking';
        actionRef.current = 'attack';
      }
    }

    const targetScale = isSelected ? 1.08 : 1;
    group.scale.setScalar(THREE.MathUtils.damp(group.scale.x, targetScale, 10, delta));
  });

  const visual = theme.pieces[piece.color];

  return (
    <group
      ref={groupRef}
      onClick={(event) => {
        event.stopPropagation();
        select(piece.square);
      }}
    >
      <PieceModel
        color={piece.color}
        type={piece.type}
        walkMotion={walkMotion}
        runMotion={runMotion}
        locomotionRef={locomotionRef}
        phaseRef={phaseRef}
        actionRef={actionRef}
      />
      {isSelected && (
        <pointLight position={[0, 1.6, 0]} intensity={0.8} color={visual.accentColor} distance={2.8} />
      )}
    </group>
  );
}
