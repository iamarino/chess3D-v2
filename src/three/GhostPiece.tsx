'use client';

// Peça que acabou de ser capturada: `manager.getState()` já não a inclui mais
// em `pieces` (ver GameManager.executeMove), então sem isto ela sumiria no
// mesmo quadro da captura. Renderizada a partir de `capturedGhosts`
// (useGameStore) — o store só cria um fantasma para modelos com `hitClip`;
// ver docs/animacao-de-pecas.md. Quando quem capturou tem golpe (`attackClip`),
// o fantasma fica represado em `pendingGhost` e só entra aqui (via
// `releasePendingGhost`, chamado por `Piece`) depois que o golpe termina — a
// queda começa nesse instante, tocada imediatamente ao montar.

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { ChessPiece } from '@/core/chess/types';
import { DEFAULT_PIECE_MODEL_OFFSET, useSettingsStore } from '@/store/useSettingsStore';
import { cloneSkinnedScene, getModelConfig } from './ModelLoader';
import { squareToPosition } from './boardUtils';

export function GhostPiece({ piece, onDone }: { piece: ChessPiece; onDone: () => void }) {
  const config = getModelConfig(piece.color, piece.type);
  const { scene, animations } = useGLTF(config.path);
  const root = useRef<THREE.Group>(null);
  const modelOffset = useSettingsStore(
    (s) => s.pieceModelOffsets[`${piece.color}-${piece.type}`] ?? DEFAULT_PIECE_MODEL_OFFSET,
  );

  const cloned = useMemo(() => cloneSkinnedScene(scene), [scene]);
  const { actions, names, mixer } = useAnimations(animations, root);
  const clipName = config.hitClip && names.includes(config.hitClip) ? config.hitClip : null;

  // `onDone` remove este fantasma da lista do store — chamá-lo via ref evita
  // que a closure inline do chamador (nova a cada render) reinicie o efeito.
  const onDoneRef = useRef(onDone);
  useLayoutEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    // O store só cria um fantasma quando `config.hitClip` existe; chegar aqui
    // sem a action correspondente é um nome de clipe errado no config, não um
    // estado normal — melhor sumir do que travar um fantasma na cena.
    if (!clipName) {
      onDoneRef.current();
      return;
    }
    const action = actions[clipName];
    if (!action) {
      onDoneRef.current();
      return;
    }

    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.reset().play();

    const onFinished = (event: { action: THREE.AnimationAction }) => {
      if (event.action === action) onDoneRef.current();
    };
    mixer.addEventListener('finished', onFinished);
    return () => mixer.removeEventListener('finished', onFinished);
  }, [actions, clipName, mixer]);

  return (
    <group position={squareToPosition(piece.square)}>
      <group ref={root}>
        <primitive
          object={cloned}
          position={[modelOffset.x, modelOffset.y, modelOffset.z]}
          rotation={config.rotation}
          scale={config.scale}
        />
      </group>
    </group>
  );
}
