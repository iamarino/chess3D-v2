'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import type { ChessPiece } from '@/core/chess/types';
import { useGameStore } from '@/store/useGameStore';
import { DEFAULT_PIECE_MODEL_OFFSET, useSettingsStore } from '@/store/useSettingsStore';
import { heroesVillainsTheme } from '@/themes/heroes-villains/theme';
import { getModelConfig, type PieceModelConfig } from './ModelLoader';
import { squareToPosition } from './boardUtils';
import { createWalkMotion, planWalk, rampedProgress, type WalkMotion, type WalkPlan } from './walkMotion';

const theme = heroesVillainsTheme;

/** Fração da duração gasta acelerando (e outro tanto desacelerando). */
const WALK_RAMP = 0.18;
/** Transição entre a pose parada e a caminhada. */
const BLEND_LAMBDA = 16;
/** Velocidade com que a peça se vira para a direção do movimento. */
const TURN_LAMBDA = 11;
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

// Extrair o root motion custa uma varredura das keyframes, então é feito uma
// única vez por modelo — o resultado é imutável e compartilhado por todas as
// instâncias (os oito peões usam o mesmo clipe).
const motionCache = new Map<string, WalkMotion | null>();

function useWalkMotion(config: PieceModelConfig): WalkMotion | null {
  const { animations } = useGLTF(config.path);
  return useMemo(() => {
    if (!config.walkClip || !config.walkFootfalls) return null;
    const cached = motionCache.get(config.path);
    if (cached !== undefined) return cached;
    const source = animations.find((clip) => clip.name === config.walkClip) ?? null;
    const motion = source ? createWalkMotion(source, config.scale, config.walkFootfalls) : null;
    motionCache.set(config.path, motion);
    return motion;
  }, [animations, config]);
}

/**
 * Fase atual do clipe de caminhada, ou null quando a peça está parada.
 * É o único canal entre a locomoção (que vive em `Piece`, junto da posição no
 * tabuleiro) e o mixer de animação (que vive aqui): as duas leem a mesma fase,
 * e é justamente isso que mantém pé e chão sincronizados.
 */
type PhaseRef = { current: number | null };

function PieceModel({
  color,
  type,
  motion,
  phaseRef,
}: {
  color: ChessPiece['color'];
  type: ChessPiece['type'];
  motion: WalkMotion | null;
  phaseRef: PhaseRef;
}) {
  const config = getModelConfig(color, type);
  const { scene, animations } = useGLTF(config.path);
  const animationRoot = useRef<THREE.Group>(null);
  // Correção de posição por modelo, ao vivo (ver PieceModelOffset) — lida das
  // configurações para o painel "Ajuste de posição" refletir na hora.
  const modelOffset = useSettingsStore((s) => s.pieceModelOffsets[`${color}-${type}`] ?? DEFAULT_PIECE_MODEL_OFFSET);

  // Cenas GLTF são compartilhadas por URL — clonar por instância evita montar
  // o mesmo Object3D sob vários pais (oito peões, um pawn.glb). `clone(true)`
  // copia a hierarquia mas NÃO o esqueleto: cada SkinnedMesh clonado seguiria
  // apontando para os ossos do original, e todas as instâncias do modelo com
  // rig colapsariam sobre a que se moveu por último. SkeletonUtils.clone
  // reconstrói um esqueleto por clone (e serve também para os modelos sem rig).
  const cloned = useMemo(() => {
    const clone = SkeletonUtils.clone(scene) as THREE.Object3D;
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  // Troca o clipe de caminhada pela versão in-place: o avanço do osso raiz foi
  // extraído e agora é aplicado por `Piece` na posição do grupo.
  const clips = useMemo(() => {
    if (!motion || !config.walkClip) return animations;
    return animations.map((clip) => (clip.name === config.walkClip ? motion.clip : clip));
  }, [animations, motion, config.walkClip]);

  // A maioria das peças é malha estática sem `animations` e este hook vira
  // no-op. Modelos gerados com a ferramenta de animação da Tripo (hoje o peão
  // herói) tocam o clipe de introdução uma vez ao aparecer e congelam na
  // última pose — é essa pose que serve de "parado" entre as jogadas.
  const { actions, names } = useAnimations(clips, animationRoot);

  // O getter `actions[name]` da drei só cria (e memoriza) a AnimationAction
  // depois que `animationRoot.current` existe, o que não vale ainda na
  // primeira renderização — resolver por useMemo congelaria tudo em undefined.
  // Buscar por nome dentro de efeitos/useFrame pega a action de verdade.
  const introClipName = names.length > 0 ? (config.introClip && names.includes(config.introClip) ? config.introClip : names[0]) : null;
  const walkClipName = config.walkClip && names.includes(config.walkClip) ? config.walkClip : null;

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

  const walkStartedRef = useRef(false);

  useFrame((_, delta) => {
    if (!walkClipName || !motion) return;
    const walkAction = actions[walkClipName];
    const introAction = introClipName ? actions[introClipName] : undefined;
    if (!walkAction) return;

    const phase = phaseRef.current;
    const walking = phase !== null;

    if (walking) {
      if (!walkStartedRef.current) {
        walkAction.reset().play();
        walkStartedRef.current = true;
      }
      // A fase é ditada pela locomoção, não pelo relógio do mixer: com a action
      // pausada o mixer avalia o clipe exatamente em `time`. É o que garante
      // que a pose corresponda ao ponto do trajeto, quadro a quadro, e que a
      // caminhada termine no footfall planejado em vez de onde o tempo cair.
      walkAction.paused = true;
      walkAction.time = phase % motion.duration;
    } else if (walkStartedRef.current && walkAction.weight < 0.01) {
      walkAction.stop();
      walkStartedRef.current = false;
    }

    // Crossfade por peso. Ao chegar, a peça volta para a mesma pose parada dos
    // peões que ainda não jogaram — antes ela congelava na pose de caminhada e
    // cada peão acabava parado num meio-passo diferente.
    const target = walking ? 1 : 0;
    walkAction.weight = THREE.MathUtils.damp(walkAction.weight, target, BLEND_LAMBDA, delta);
    if (introAction) {
      introAction.weight = THREE.MathUtils.damp(introAction.weight, 1 - target, BLEND_LAMBDA, delta);
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
  const motion = useWalkMotion(config);
  const pieceWalkAnimation = useSettingsStore((s) => s.pieceWalkAnimation);
  // Multiplicador da cadência autoral. Como a posição vem da fase, mudar o
  // ritmo acelera a caminhada inteira sem nunca descolar o pé do chão — o que
  // não era verdade quando a duração era fixa e a distância variava.
  const pieceWalkTempo = useSettingsStore((s) => s.pieceWalkTempo);

  const walkRef = useRef<WalkState | null>(null);
  const glideRef = useRef<GlideState | null>(null);
  const phaseRef = useRef<number | null>(null);

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

  useEffect(() => {
    const previousSquare = lastSquareRef.current;
    lastSquareRef.current = piece.square;
    const group = groupRef.current;
    if (!group || previousSquare === null || previousSquare === piece.square) return;

    const target = new THREE.Vector3(...squareToPosition(piece.square));
    // Só a peça que acabou de jogar caminha. Sem isso um "reiniciar" ou
    // "desfazer" — que reposiciona várias peças de uma vez — faria o tabuleiro
    // inteiro sair andando.
    const lastMove = useGameStore.getState().lastMove;
    const isPlayedMove = lastMove?.to === piece.square && lastMove?.from === previousSquare;

    // Parte de onde a peça realmente está, não do alvo anterior, para uma
    // jogada que chega no meio de outra animação não dar salto.
    const from = group.position.clone();
    const direction = target.clone().sub(from);
    const distance = direction.length();

    if (!isPlayedMove || distance < 1e-4) {
      group.position.copy(target);
      walkRef.current = null;
      glideRef.current = null;
      phaseRef.current = null;
      return;
    }

    direction.normalize();

    if (!motion || !pieceWalkAnimation) {
      walkRef.current = null;
      phaseRef.current = null;
      glideRef.current = { from, target, elapsed: 0 };
      return;
    }

    const plan = planWalk(motion, distance);
    // A frente do modelo é o +Z da cena girado pela rotação de correção do
    // config; o grupo gira o quanto falta para essa frente apontar para o
    // destino. Para o peão herói andando reto isso dá 0, que é exatamente como
    // ele já ficava — a virada só aparece nas capturas na diagonal.
    const yaw = Math.atan2(direction.x, direction.z) - config.rotation[1];

    glideRef.current = null;
    walkRef.current = {
      from,
      target,
      direction,
      plan,
      duration: Math.max(0.15, plan.totalPhase / Math.max(0.1, pieceWalkTempo)),
      elapsed: 0,
      yaw,
    };
    phaseRef.current = plan.startPhase;
  }, [piece.square, motion, pieceWalkAnimation, pieceWalkTempo, config.rotation]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const walk = walkRef.current;
    if (walk && motion) {
      walk.elapsed += delta;
      const u = Math.min(1, walk.elapsed / walk.duration);
      const phase = walk.plan.startPhase + walk.plan.totalPhase * rampedProgress(u, WALK_RAMP);
      phaseRef.current = phase;

      // Posição = avanço do próprio clipe. Não há interpolação independente
      // para a pose "alcançar": o chão percorrido é o que a animação diz.
      const travelled = (motion.displacementAt(phase) - walk.plan.startDisplacement) * walk.plan.warp;
      group.position.copy(walk.from).addScaledVector(walk.direction, travelled);

      if (u >= 1) {
        // A fase parou num footfall, com o pé de apoio já imóvel: a peça
        // assenta no centro exato da casa sem correção nenhuma.
        group.position.copy(walk.target);
        walkRef.current = null;
        phaseRef.current = null;
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

    const targetYaw = walk ? walk.yaw : 0;
    group.rotation.y = dampAngle(group.rotation.y, targetYaw, TURN_LAMBDA, delta);

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
      <PieceModel color={piece.color} type={piece.type} motion={motion} phaseRef={phaseRef} />
      {isSelected && (
        <pointLight position={[0, 1.6, 0]} intensity={0.8} color={visual.accentColor} distance={2.8} />
      )}
    </group>
  );
}
