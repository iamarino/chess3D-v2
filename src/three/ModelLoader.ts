import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import type { PieceColor, PieceType } from '@/core/chess/types';

export interface PieceModelConfig {
  path: string;
  /** Uniform scale bringing this specific model to the right size on a 1-unit square. */
  scale: number;
  /** Corrective rotation — assets come from different generators with different up-axis conventions. */
  rotation: [number, number, number];
  /**
   * Name of the clip to play once when the piece appears on the board (it
   * freezes on the clip's last frame afterwards) — for models with baked
   * animation (Tripo's Animation tool exports unlabeled `NlaTrack` clips —
   * name the one that reads as the "dance"/intro once you've previewed
   * them). Leave unset to fall back to the model's first clip, or to a
   * static pose if it has none.
   */
  introClip?: string;
  /**
   * Name of the clip to loop while the piece is sliding between squares,
   * for models with baked animation. Leave unset to skip the walk cycle
   * and just glide (no leg motion) between squares.
   */
  walkClip?: string;
  /**
   * Instantes (em segundos do clipe de caminhada) em que cada pé encosta no
   * chão. A caminhada começa e termina sempre num desses instantes, para a
   * peça parar com o pé de apoio já plantado (ver `walkMotion.ts`).
   *
   * Medidos pela velocidade do osso do pé em espaço de mundo ao longo do
   * clipe: no apoio ela cai para ~6% do pico. Se o modelo ou o clipe de
   * caminhada for trocado, estes números precisam ser medidos de novo.
   */
  walkFootfalls?: number[];
  /**
   * Clipe tocado uma vez, no lugar, quando esta peça vai capturar outra —
   * toca primeiro, parada na casa de origem e já virada para o adversário; a
   * caminhada até a casa de destino só começa depois que ele (e a queda do
   * adversário, se houver `hitClip`) terminam. Diferente do clipe de
   * caminhada, o root motion aqui NÃO é extraído: a peça ainda não saiu do
   * lugar, então o pequeno deslocamento que o golpe carrega é só o "peso" do
   * movimento, tocado em espaço local do modelo — ver docs/animacao-de-pecas.md.
   */
  attackClip?: string;
  /**
   * Clipe tocado uma vez, no lugar, quando esta peça acaba de ser capturada.
   * Se quem capturou tem `attackClip`, só começa a tocar depois que o golpe
   * termina; senão, toca imediatamente quando a captura é resolvida — ver
   * docs/animacao-de-pecas.md. Ao terminar, a peça é removida da cena.
   */
  hitClip?: string;
}

const Z_UP_ROTATION: [number, number, number] = [-Math.PI / 2, 0, 0];

// Starter procedural low-poly set (trimesh-generated): authored Z-up with
// the pivot at the base's bottom center, no textures.
const TRIMESH_SCALE = 0.52;

function trimeshConfig(path: string): PieceModelConfig {
  return { path, scale: TRIMESH_SCALE, rotation: Z_UP_ROTATION };
}

export const MODEL_CONFIGS: Record<PieceColor, Record<PieceType, PieceModelConfig>> = {
  hero: {
    // Tripo-generated (AI image-to-3D), already Y-up with height normalized
    // to 1 unit and a textured PBR material — needs its own scale. Authored
    // facing away from the board's home side, so it's spun 180° to face the camera.
    king: { path: '/models/hero_king.glb', scale: 1.32, rotation: [0, Math.PI, 0] },
    queen: trimeshConfig('/models/hero_queen.glb'),
    rook: trimeshConfig('/models/hero_rook.glb'),
    bishop: trimeshConfig('/models/hero_bishop.glb'),
    knight: trimeshConfig('/models/hero_knight.glb'),
    // Tripo-generated with a rig + 8 baked animation clips (Tripo's Animation tool),
    // replacing the static pawn — raw height is 0.9375 units (vs. 1.0 for the static
    // asset it replaces), scale compensates to keep the same on-board size.
    // Clips are unlabeled ("NlaTrack", "NlaTrack.001"...) — identified by
    // motion signature (legs alternating + opposite arm/leg sync = gait);
    // reconfirm visually if pieces start looking wrong mid-move.
    pawn: {
      path: '/models/hero_pawn.glb',
      scale: 1.12,
      rotation: [0, Math.PI, 0],
      introClip: 'NlaTrack',
      walkClip: 'NlaTrack.001',
      // 4 passos por ciclo de 2.375s. O ciclo avança 1.329 unidades de mundo
      // nessa escala, ou seja 0.332 por passo — uma casa dá 3.01 passos, o
      // que deixa a caminhada praticamente sem correção de passada.
      walkFootfalls: [0.37, 0.96, 1.56, 2.13],
    },
  },
  villain: {
    // Tripo-generated, but a separate generation from the hero king — its
    // "front" already faces the board center unrotated (unlike the hero king).
    king: { path: '/models/villain_king.glb', scale: 1.32, rotation: [0, 0, 0] },
    queen: trimeshConfig('/models/villain_queen.glb'),
    rook: trimeshConfig('/models/villain_rook.glb'),
    bishop: trimeshConfig('/models/villain_bishop.glb'),
    knight: trimeshConfig('/models/villain_knight.glb'),
    // Tripo-generated com rig + 4 clipes: parado com braços cruzados (NlaTrack,
    // meio do loop de 13.67s), caminhada (NlaTrack.003), chute de ataque
    // (NlaTrack.002) e queda ao ser capturado (NlaTrack.001). Frente já olha
    // para o centro do tabuleiro em rotação identidade, como o resto do time.
    // Altura bruta 0.950 vs. 0.9996×1.05 do peão estático que substituiu —
    // scale escolhido para manter o mesmo tamanho aparente no tabuleiro.
    //
    // O export original vinha com 1,35 milhão de triângulos (52 MB de GPU só
    // nesta malha — chegou a derrubar o processo de GPU em teste) para um
    // peão de xadrez; passado por `gltf-transform simplify --ratio 0.025
    // --error 0.001` (preserva esqueleto/skinning/animações, só decima a
    // malha), caiu para 33.7k triângulos / 1.4 MB, na mesma faixa do
    // hero_pawn (17k vértices). Refazer com o mesmo comando se o asset for
    // trocado de novo.
    pawn: {
      path: '/models/villain_pawn.glb',
      scale: 1.1,
      rotation: [0, 0, 0],
      introClip: 'NlaTrack',
      walkClip: 'NlaTrack.003',
      // 4 passos por ciclo de 1.833s. Uma casa dá 3.2 passos — arredonda
      // para 3, com 6.2% de correção de passada.
      walkFootfalls: [0.25, 0.73, 1.2, 1.66],
      attackClip: 'NlaTrack.002',
      hitClip: 'NlaTrack.001',
    },
  },
};

export function getModelConfig(color: PieceColor, type: PieceType): PieceModelConfig {
  return MODEL_CONFIGS[color][type];
}

/**
 * Cenas GLTF são compartilhadas por URL — clonar por instância evita montar o
 * mesmo Object3D sob vários pais (oito peões, um pawn.glb). `clone(true)`
 * copia a hierarquia mas NÃO o esqueleto: cada SkinnedMesh clonado seguiria
 * apontando para os ossos do original, e todas as instâncias do modelo com
 * rig colapsariam sobre a que se moveu por último. SkeletonUtils.clone
 * reconstrói um esqueleto por clone (e serve também para os modelos sem rig).
 */
export function cloneSkinnedScene(scene: THREE.Object3D): THREE.Object3D {
  const clone = SkeletonUtils.clone(scene) as THREE.Object3D;
  clone.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return clone;
}

export function preloadAllPieceModels(): void {
  (Object.keys(MODEL_CONFIGS) as PieceColor[]).forEach((color) => {
    (Object.keys(MODEL_CONFIGS[color]) as PieceType[]).forEach((type) => {
      useGLTF.preload(MODEL_CONFIGS[color][type].path);
    });
  });
}
