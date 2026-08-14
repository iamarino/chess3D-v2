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
   * Congela o `introClip` neste instante (segundos, tempo real — o clipe
   * continua tocando na velocidade original, só é cortado aí) — para clipes
   * de pose longos que do contrário ainda estariam tocando muito depois do
   * resto do time já ter assentado no tabuleiro. Deixe sem definir para
   * tocar o clipe até o fim natural dele.
   */
  introFreezeAt?: number;
  /**
   * Desliga completamente o `introClip` — a peça não toca nenhuma animação
   * de entrada, nem cai no primeiro clipe do arquivo (comportamento padrão
   * quando `introClip` não é declarado). Usado quando o único clipe
   * disponível para servir de intro para numa pose ruim quando cortado
   * (ex.: as rainhas, cujo único clipe fora a caminhada é uma "dança" longa
   * sem um instante de pose limpa para congelar).
   */
  noIntro?: boolean;
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
   * Clipe de corrida, usado em vez de `walkClip` quando o lance percorre mais
   * de `RUN_DISTANCE_THRESHOLD` casas (ver `Piece.tsx`) — hoje só a torre
   * vilã tem. Sem isso, qualquer distância usa `walkClip`. Mesmo mecanismo de
   * root motion do `walkClip` (posição derivada da fase, pé não escorrega);
   * a rampa de desaceleração no fim do trajeto também muda quando a corrida
   * está ativa: cobre exatamente a última casa do trajeto (proporcional à
   * distância), em vez da fração fixa usada na caminhada — ver
   * docs/animacao-de-pecas.md.
   */
  runClip?: string;
  /** Footfalls de `runClip`, mesmo critério de medição de `walkFootfalls`. */
  runFootfalls?: number[];
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
   * Ângulo (radianos) entre a FRENTE do modelo e a direção em que o golpe de
   * `attackClip` de fato aterrissa — nem todo golpe sai para a frente. Medido
   * no plano XZ com a mesma convenção de yaw do resto do código
   * (`atan2(x, z)`), então é positivo para a esquerda do modelo (+X é o lado
   * esquerdo do rig: os ossos `L_*` ficam em +X e os `R_*` em -X).
   *
   * `Piece.tsx` vira a peça para `direção do alvo - attackYaw` antes de
   * disparar o golpe, de modo que quem chega no adversário é o pé/a mão, não a
   * frente do modelo. Sem isso um golpe lateral acerta a casa errada: o peão
   * vilão dá um chute que cruza para a esquerda dele, então mirando a frente no
   * adversário o pé caía ~80° à esquerda do alvo — com o inimigo na diagonal
   * direita, o chute terminava exatamente na casa da diagonal esquerda.
   *
   * Medido pelo alcance máximo do osso do golpe em relação ao quadril, no plano
   * XZ (mesma técnica de `scripts/analisar-caminhada.mjs`). Deixe sem definir
   * (= 0) para golpes que já saem para a frente, como os socos das duas torres
   * (mãos a ~7-10° da frente, conferido).
   */
  attackYaw?: number;
  /**
   * Clipe tocado uma vez, no lugar, quando esta peça acaba de ser capturada.
   * Se quem capturou tem `attackClip`, só começa a tocar depois que o golpe
   * termina; senão, toca imediatamente quando a captura é resolvida — ver
   * docs/animacao-de-pecas.md. Ao terminar, a peça é removida da cena.
   */
  hitClip?: string;
  /**
   * Clipe tocado em loop, no lugar, enquanto a peça comemora uma vitória por
   * xeque-mate (ver `CheckmateCelebration.tsx` e `PieceMotionManager.setDancing`).
   * Só as peças com este campo declarado dançam — as demais ficam paradas na
   * comemoração. Hoje só as torres têm um clipe de dança/comemoração já
   * identificado (`dança_02`/`comemoração` nos comentários acima) e com
   * deslocamento líquido baixo o bastante para tocar em loop sem a peça
   * derivar para fora da casa.
   */
  danceClip?: string;
  /**
   * Desliga o brilho por time (`applyGlow`) para este modelo. Default `true`.
   * O critério de brilho (`isGlowing`) é por cor de pixel, não por região da
   * malha — em texturas onde pele/cabelo caem no mesmo tom saturado das
   * gemas (ex.: bispo e cavalo vilões, tom de pele muito vermelho), a máscara
   * acende o rosto/cabelo inteiro em vez de só as gemas. Sem uma gema de
   * verdade para isolar, a peça fica bem mais clara que o resto do time —
   * melhor desligar o brilho todo do que acender partes erradas do corpo.
   */
  glow?: boolean;
}

export const MODEL_CONFIGS: Record<PieceColor, Record<PieceType, PieceModelConfig>> = {
  hero: {
    // Tripo-generated (AI image-to-3D), already Y-up with height normalized
    // to 1 unit and a textured PBR material — needs its own scale. Authored
    // facing away from the board's home side, so it's spun 180° to face the camera.
    king: { path: '/models/hero_king.glb', scale: 1.32, rotation: [0, Math.PI, 0] },
    // Reexportado (2026-08-13, "rainha azul") com rig + 2 clipes, mesma
    // altura bruta (0,9996) — mesma escala 1,32 da versão anterior. Autorado
    // de costas para a frente do tabuleiro — girado 180° no eixo Y, como o
    // resto do time herói.
    //
    //   [0] NlaTrack      dur=12.833s  amp=0.319 — pose longa com balanço de
    //       peso — sem alternativa curta, então vira introClip mesmo com um
    //       drift líquido não desprezível (0,28 local / 0,37 un. de mundo,
    //       ~35% de uma casa); único clipe além da caminhada, mesma situação
    //       da rainha vilã (docs/animacao-de-pecas.md). Conferido visualmente
    //       (2026-08-13): a peça assenta dentro da casa, sem sair visivelmente
    //       do centro.
    //   [1] NlaTrack.001  dur=2.375s   amp=1.424 — caminhada (walkClip)
    //
    // Sem attackClip/hitClip: o asset não tem golpe nem queda dedicados.
    //
    // walkClip: passada 0,4700 un./passo, 1 casa em 2 passos — 6,0% de
    // correção de passada, bem abaixo do limiar de ~15%.
    //
    // Export original: 31,4 MB; decimado com a mesma receita das outras
    // peças Tripo (`gltf-transform simplify --ratio 0.025 --error 0.001`)
    // para 3,85 MB.
    //
    // Textura já em azul escuro (L mediano 0.186) — abaixo do L>0.55 do
    // critério `isGlowing` do time herói, então não acende nada por engano;
    // sem necessidade de glow:false nem recolor, ao contrário da rainha vilã.
    queen: {
      path: '/models/hero_queen.glb',
      scale: 1.32,
      rotation: [0, Math.PI, 0],
      // Sem introClip: o único clipe fora a caminhada é uma "dança" de
      // 12,833s sem um instante de pose limpa — congelar em qualquer ponto
      // cortado deixava a peça parada numa pose ruim. `noIntro` evita o
      // fallback padrão pro primeiro clipe do arquivo; a peça assenta na
      // pose de bind do rig, sem animação de entrada.
      noIntro: true,
      walkClip: 'NlaTrack.001',
      walkFootfalls: [0.30, 0.92, 1.46, 2.05],
    },
    // Tripo-generated com rig + 5 clipes. Exportados como "concordar",
    // "boxe_01", "dança_02", "correr" e "caminhar", mas gravados no .glb como
    // NlaTrack genéricos — mapeados por amplitude/duração do root motion no
    // osso Hip (`scripts/analisar-caminhada.mjs`), já que a ordem de
    // exportação não é preservada 1:1 no glTF:
    //
    //   [0] NlaTrack      amp=1.490 dur=1.000s  — correr    (runClip)
    //   [1] NlaTrack.001  amp=0.146 dur=2.250s  — boxe_01   (attackClip, a
    //       pedido — troca o golpe padrão por um soco)
    //   [2] NlaTrack.002  amp=0.171 dur=12.833s — dança_02  (não usado)
    //   [3] NlaTrack.003  amp=0.751 dur=1.833s  — caminhar  (walkClip)
    //   [4] NlaTrack.004  amp=0.015 dur=4.042s  — concordar (introClip, a
    //       pedido — idle da torre herói é o aceno de concordância)
    //
    // Só [0] e [3] têm root motion de verdade (os dois "prováveis de
    // caminhada" apontados pelo script) — batem exatamente com as duas únicas
    // animações de locomoção da exportação (correr/caminhar), o que confirma
    // o mapeamento por eliminação. Sem hitClip: o asset não tem uma animação
    // de queda para esta peça — ao ser capturada ela some da cena sem clipe
    // de queda (mesmo mecanismo genérico de GhostPiece.tsx, só que sem pose
    // de queda antes de sumir).
    //
    // Export original: 883k triângulos / 38 MB; decimado com `gltf-transform
    // simplify --ratio 0.025 --error 0.001` (preserva esqueleto/skinning/
    // animações, mesma receita da torre vilã) para 22k triângulos / 4,2 MB.
    //
    // walkClip/runClip, mesma receita da torre vilã (docs/animacao-de-pecas.md):
    // `NlaTrack.003` anda (passada 0.389 un./passo, 1 casa em 3 passos, 16.6%
    // de correção — na mesma faixa aceita pela torre vilã, 17.7%, o asset não
    // tem uma passada melhor disponível). `NlaTrack` corre (passada 1.028
    // un./passo, quase 1 passo por casa, 2.8% de correção). A partir de
    // `RUN_DISTANCE_THRESHOLD` casas a torre troca para a corrida.
    rook: {
      path: '/models/hero_rook.glb',
      scale: 2.07,
      // Autorado de costas para o tabuleiro (ao contrário do resto do time
      // herói) — girada 180° para olhar para o centro, como as demais peças.
      rotation: [0, Math.PI, 0],
      introClip: 'NlaTrack.004',
      attackClip: 'NlaTrack.001',
      walkClip: 'NlaTrack.003',
      walkFootfalls: [0.29, 0.74, 1.2, 1.66],
      runClip: 'NlaTrack',
      runFootfalls: [0.25, 0.5, 0.75],
      // "dança_02" — não usada em nenhuma outra ação; deslocamento líquido
      // baixo (amp=0.171), então serve para tocar em loop na comemoração de
      // xeque-mate sem a peça derivar para fora da casa (ver `danceClip`).
      danceClip: 'NlaTrack.002',
    },
    // Tripo-generated com rig + 3 clipes, já Y-up (altura bruta 0.9997) —
    // escala escolhida para bater a altura renderizada do bispo trimesh que
    // substituiu (2,78 × 0,52 ≈ 1,4456). Autorado de costas para a frente do
    // tabuleiro — girado 180° no eixo Y, como o resto do time herói.
    //
    //   [0] NlaTrack      dur=1.833s  amp=1.612  — caminhada (walkClip)
    //   [1] NlaTrack.001  dur=12.25s  amp=0.182  — pose longa, sem root
    //       motion líquido (drift ~0); descartada como introClip pelo mesmo
    //       motivo da "dança_02" da torre herói (docs/animacao-de-pecas.md):
    //       longa demais para uma entrada.
    //   [2] NlaTrack.002  dur=2.25s   amp=0.314  — pose curta, sem root
    //       motion líquido — usada como introClip.
    //
    // Sem attackClip/hitClip: o asset não tem golpe nem queda dedicados para
    // esta peça — captura e remoção seguem o mecanismo genérico (GhostPiece).
    //
    // walkClip: passada 0,5843 un./passo, 1 casa em 2 passos — 16,9% de
    // correção de passada, levemente acima do ~15% em que começa a aparecer
    // como pé escorregando, mas na mesma faixa já aceita para a torre
    // (16,6%/17,7%): o asset não tem uma passada melhor disponível nesta
    // escala, e reduzir a escala para zerar a correção destacaria demais o
    // bispo do resto do tabuleiro.
    //
    // Export original: 4,3M vértices renderizados / 58,5 MB; decimado com
    // `gltf-transform simplify --ratio 0.025 --error 0.001` (mesma receita
    // das outras peças Tripo) para 4,1 MB.
    bishop: {
      path: '/models/hero_bishop.glb',
      scale: 1.45,
      rotation: [0, Math.PI, 0],
      introClip: 'NlaTrack.002',
      walkClip: 'NlaTrack',
      walkFootfalls: [0.21, 0.71, 1.13, 1.62],
    },
    // Tripo-generated horse-profile model (sem rig/animação) — malha bruta de
    // ~2M triângulos, decimada com `gltf-transform simplify --ratio 0.025
    // --error 0.001` (mesma receita das outras peças Tripo); a malha resistiu
    // a mais compressão que o normal (parou em ~224k triângulos mesmo com
    // --error bem mais alto — provável geometria não-manifold/crina em
    // camadas), então ficou mais pesada que as demais (11,8 MB). Já Y-up,
    // altura bruta 0.874 — escala escolhida para bater a altura renderizada
    // do cavalo trimesh que substituiu (2,576 × 0.52 ≈ 1,34). Autorado de
    // costas para a frente do tabuleiro — girado 180° no eixo Y, como o
    // resto do time herói.
    knight: { path: '/models/hero_knight.glb', scale: 1.53, rotation: [0, Math.PI, 0] },
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
    // Reexportado (2026-08-13, "rainha vermelha") com rig + 2 clipes, mesma
    // altura bruta da rainha herói (1.0) — mesma escala. Frente já olha para
    // o centro do tabuleiro em rotação identidade, como o resto do time.
    //
    //   [0] NlaTrack      dur=12.833s  amp=0.460  — pose longa, sem root
    //       motion líquido (avanço total 0.051 un. de mundo nessa escala) —
    //       único clipe além da caminhada, então vira introClip mesmo sendo
    //       longa (sem alternativa curta, como o bispo/cavalo vilões).
    //   [1] NlaTrack.001  dur=2.375s   amp=1.421  — caminhada (walkClip)
    //
    // Nomes dos clipes trocados em relação à versão anterior do asset
    // (antes: caminhada em NlaTrack, pose em NlaTrack.001) — conferir sempre
    // com `scripts/analisar-caminhada.mjs`, nunca assumir por posição.
    //
    // Sem attackClip/hitClip: o asset não tem golpe nem queda dedicados.
    //
    // walkClip: passada 0,4689 un./passo, 1 casa em 2 passos — 6,2% de
    // correção de passada, abaixo do limiar de ~15%.
    //
    // Export original: 46,2 MB; decimado com a mesma receita das outras
    // peças Tripo (`gltf-transform simplify --ratio 0.025 --error 0.001`)
    // para 3,85 MB.
    //
    // glow: false + basecolor recolorido (2026-08-13) — 99,7% da textura
    // original caía na faixa "vermelho" do critério de brilho (é um asset
    // pintado de vermelho por inteiro, sem gema separada para isolar), e
    // 25,9% batia no próprio critério de `isGlowing` (S mediano 0.587, acima
    // do 0.55 do threshold) — sem correção, um quarto da peça acenderia como
    // gema. Mesma receita das outras peças vilãs: medi a mediana HSL dos
    // pixels "vermelho" (H -8.2°, S 0.587, L 0.255) contra a do cavalo vilão
    // (H 6.1°, S 0.388, L 0.271) e apliquei só nesses pixels: +14.3° de
    // matiz, -0.199 de saturação, +0.016 de luminosidade (isGlowing % caiu
    // para 6,9 — glow: false continua necessário, a correção só aproxima o
    // tom do resto do time).
    queen: {
      path: '/models/villain_queen.glb',
      scale: 1.32,
      rotation: [0, 0, 0],
      // Mesmo motivo da rainha herói — sem introClip, pose de bind do rig.
      noIntro: true,
      walkClip: 'NlaTrack.001',
      walkFootfalls: [0.30, 0.92, 1.46, 2.05],
      glow: false,
    },
    // Tripo-generated com rig + 5 clipes. Identificação por
    // `scripts/analisar-caminhada.mjs` + conferência visual (2026-08-11):
    //
    //   [0] NlaTrack      — caminhada (walkClip)
    //   [1] NlaTrack.001  — corrida (runClip)
    //   [2] NlaTrack.002  — golpe (attackClip, e também introClip — ver nota abaixo)
    //   [3] NlaTrack.003  — comemoração (cogitado para introClip, descartado — ver nota abaixo)
    //   [4] NlaTrack.004  — queda (hitClip); identificado por eliminação (o
    //       único clipe que sobrou depois dos outros quatro), confirmado
    //       visualmente (2026-08-11)
    //
    // Frente já olha para o centro do tabuleiro em rotação identidade, como o
    // resto do time.
    //
    // O export original vinha com 1,78 milhão de triângulos (72,6 MB, dos
    // quais ~70 MB só da malha) para uma torre; passado por
    // `gltf-transform simplify --ratio 0.025 --error 0.001` (preserva
    // esqueleto/skinning/animações, só decima a malha), caiu para 44,6k
    // triângulos / 4,77 MB — mesma receita usada no villain_pawn. Escala
    // 1.43 é uma primeira estimativa (altura bruta 0.803, entre o pawn e o
    // king) pendente de conferência visual; refazer a decimação com o mesmo
    // comando se o asset for trocado de novo.
    //
    // introClip: sem isso, `Piece.tsx` cai no primeiro clipe do arquivo
    // (NlaTrack, amplitude 1.1), que toca uma vez e congela na última pose —
    // a torre "andava" para fora da casa assim que aparecia. `NlaTrack.003`
    // (comemoração, deslocamento líquido de só 0.015 unidade de mundo) foi o
    // primeiro substituto por não arrastar a peça, mas achamos o golpe mais
    // interessante como pose de entrada/repouso — por pedido, a torre agora
    // usa o próprio `NlaTrack.002` (golpe) como introClip também. Como
    // introClip === attackClip aqui, `Piece.tsx` duplica o clipe sob um nome
    // à parte para a intro (ver comentário em `clips` no PieceModel) — sem
    // isso as duas ações disputariam o mesmo peso e o golpe nunca chegaria a
    // tocar cheio.
    //
    // attackClip: `NlaTrack.002` — confirmado visualmente como o golpe da
    // torre; deslocamento líquido baixíssimo (0.0002 unidade de mundo), então
    // não arrasta a peça para fora da casa central onde o golpe é tocado.
    //
    // hitClip: `NlaTrack.004` — toca uma vez, parada na própria casa, quando
    // a torre é capturada (mecanismo genérico de `GhostPiece.tsx` +
    // `useGameStore`, o mesmo já usado pelo peão vilão); ao terminar, a torre
    // some da cena. Sem relação com o root motion do walkClip/runClip — a
    // peça já está parada quando a queda começa.
    //
    // walkClip/runClip: `NlaTrack` anda (passada 0.392 un./passo, 1 casa em 3
    // passos — 17,7% de correção de passada, um pouco acima do ~15% em que a
    // correção começa a ficar visível; o asset não tem uma passada melhor
    // disponível). `NlaTrack.001` corre (passada 1.037 un./passo, quase 1
    // passo por casa, 3,7% de correção). A partir de 3 casas de deslocamento
    // (`RUN_DISTANCE_THRESHOLD` em `Piece.tsx`) a torre troca para a corrida.
    rook: {
      path: '/models/villain_rook.glb',
      scale: 1.58,
      rotation: [0, 0, 0],
      introClip: 'NlaTrack.002',
      walkClip: 'NlaTrack',
      walkFootfalls: [0.27, 0.73, 1.2, 1.66],
      runClip: 'NlaTrack.001',
      runFootfalls: [0.34, 0.63, 0.96],
      attackClip: 'NlaTrack.002',
      hitClip: 'NlaTrack.004',
      // "comemoração" — descartada como introClip (ver nota acima), mas
      // deslocamento líquido baixíssimo (0.015 un. de mundo) a torna segura
      // para tocar em loop na comemoração de xeque-mate.
      danceClip: 'NlaTrack.003',
    },
    // Tripo-generated com rig + 2 clipes, mesma altura bruta do bispo herói
    // (0.9996) — mesma escala. Frente já olha para o centro do tabuleiro em
    // rotação identidade, como o resto do time.
    //
    //   [0] NlaTrack      dur=8.5s    amp=0.102  — balanço de repouso (sem
    //       root motion líquido); sem introClip declarado, `Piece.tsx` cai
    //       neste (o primeiro clipe do arquivo) por padrão, mesmo mecanismo
    //       do cavalo vilão.
    //   [1] NlaTrack.001  dur=2.375s  amp=1.466  — caminhada (walkClip)
    //
    // Sem attackClip/hitClip: o asset não tem golpe nem queda dedicados.
    //
    // walkClip: passada 0,5313 un./passo, 1 casa em 2 passos — 6,3% de
    // correção de passada, bem abaixo do limiar de ~15%.
    //
    // Export original: 3,7M vértices renderizados / 51,3 MB; decimado com a
    // mesma receita das outras peças Tripo para 4,0 MB.
    //
    // glow: false — a pele do rosto cai no mesmo vermelho saturado do
    // critério de brilho vilão (`isGlowing`), que é por cor de pixel, não por
    // região da malha; sem uma gema de verdade pra isolar, a máscara acendia
    // o rosto inteiro e a peça ficava bem mais clara que o resto do time.
    //
    // basecolor recolorido (2026-08-13): 84% da textura original caía na
    // faixa "vermelho" do critério acima, contra 28-56% nas outras peças
    // vilãs, e mais saturado (S mediano 0.505 vs 0.355-0.388) — o bispo
    // destoava visivelmente do tom das outras armaduras vermelhas. Medi a
    // mediana HSL dos pixels "vermelho" do cavalo vilão (H 6.1°, S 0.388,
    // L 0.271) contra a do bispo original (H -1.0°, S 0.505, L 0.212) e
    // apliquei a peças de fase (script `recolor.mjs`, descartável, não
    // versionado) só nesses pixels: +7.1° de matiz, -0.117 de saturação,
    // +0.059 de luminosidade — sem mexer no cinza/dourado/normal/roughness.
    // Robe continua vermelho (é o desenho da peça, não dá pra virar metal
    // cinza só com correção de cor), só menos neon/rosado. Reaplicar a
    // mesma receita se o asset for regenerado.
    bishop: {
      path: '/models/villain_bishop.glb',
      scale: 1.45,
      rotation: [0, 0, 0],
      walkClip: 'NlaTrack.001',
      walkFootfalls: [0.30, 0.92, 1.46, 2.05],
      glow: false,
    },
    // Tripo-generated horse-profile model, reexportado (2026-08-13) com rig +
    // 2 clipes — a versão anterior só tinha o balanço de repouso, sem
    // caminhada. Altura bruta 0.875, praticamente igual à versão anterior
    // (0.874) — mesma escala.
    //
    //   [0] NlaTrack      dur=2.375s  amp=1.139  — caminhada (walkClip)
    //   [1] NlaTrack.001  dur=6.042s  amp=0.062  — balanço de repouso (sem
    //       root motion líquido, mesmo clipe da versão anterior — usado como
    //       introClip; sem declarar, `Piece.tsx` cairia por padrão no [0], a
    //       caminhada, e congelaria no fim dela).
    //
    // Sem attackClip/hitClip: o asset não tem golpe nem queda dedicados.
    //
    // walkClip: passada 0,4355 un./passo, 1 casa em 2 passos — 12,9% de
    // correção de passada, abaixo do limiar de ~15%.
    //
    // Export original: 5,9M vértices renderizados / 80,4 MB; decimado com a
    // mesma receita das outras peças Tripo para 5,2 MB.
    //
    // glow: false — mesmo problema do bispo vilão (pele/crina caem no
    // vermelho saturado do critério de brilho `isGlowing`, que é por cor de
    // pixel, não por região da malha); mantido desligado nesta reexportação
    // também, sem conferência visual — reavaliar se a nova textura já vier
    // sem esse problema.
    knight: {
      path: '/models/villain_knight.glb',
      scale: 1.53,
      rotation: [0, 0, 0],
      introClip: 'NlaTrack.001',
      walkClip: 'NlaTrack',
      walkFootfalls: [0.32, 0.92, 1.51, 2.08],
      glow: false,
    },
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
      // O chute é um giro de perna direita que cruza para a ESQUERDA do peão,
      // não um chute frontal: no instante de impacto (t=0.667s, alcance máximo
      // do R_ToeBase no plano XZ) o pé está em x=+0.321 / z=+0.061 relativo ao
      // quadril, ou seja 79° para a esquerda da frente. Ver `attackYaw`.
      attackYaw: (79 * Math.PI) / 180,
      hitClip: 'NlaTrack.001',
    },
  },
};

export function getModelConfig(color: PieceColor, type: PieceType): PieceModelConfig {
  return MODEL_CONFIGS[color][type];
}

// Cor do brilho por time — vermelho nas gemas vilãs, azul-safira nas gemas de
// vidro dos heróis (torre). A detecção (`isGlowing`) amostra a cor média dos
// pixels de cristal na textura (~#79c9e2, um ciano claro), mas o emissive usa
// um azul mais profundo e saturado no mesmo tom — o ciano claro ficava
// "plástico"/neon demais para luz própria; o safira lê como pedra preciosa.
const GLOW_COLOR: Record<PieceColor, THREE.Color> = {
  hero: new THREE.Color(0x0673e0),
  villain: new THREE.Color(0xff2a1a),
};
// Intensidade de pico do pulsar — ver `GlowPulse`, que anima entre
// GLOW_PULSE_MIN e este valor. Exportado pra os dois ficarem sincronizados.
export const GLOW_INTENSITY = 2.4;
// Resolução do canvas usado pra amostrar a textura de cor base e gerar a
// máscara — não precisa da resolução cheia (2048) pra pegar gemas/detalhes
// pequenos, e mantém o custo (rodado uma única vez por material) baixo.
const GLOW_MASK_RESOLUTION = 1024;

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return [h, s, l];
}

/**
 * Detecta os pixels que devem acender como luz própria, por time — critério
 * calibrado amostrando as texturas reais dos modelos:
 *
 * - `villain`: vermelho vivo (gemas, joias, detalhes vilanescos) — não pega
 *   couro, pele ou madeira, que também tendem pro avermelhado mas são bem
 *   menos saturados e/ou mais escuros. Nenhuma peça herói tem vermelho nesse
 *   critério; entre as vilãs, peão e torre têm gemas vermelhas (só elas
 *   acendem), o rei vilão não tem nenhum pixel assim.
 * - `hero`: azul-gelo claro (cristais/vidro) — não pega o azul-marinho da
 *   armadura (bem mais escuro e menos saturado) nem o azul-royal do manto do
 *   rei. Hoje só a torre tem esses cristais; rei e peão não têm nenhum pixel
 *   assim.
 */
function isGlowing(color: PieceColor, r: number, g: number, b: number): boolean {
  const [h, s, l] = rgbToHsl(r, g, b);
  if (color === 'villain') return (h < 18 || h > 342) && s > 0.55 && l > 0.22 && l < 0.62;
  return h > 180 && h < 230 && s > 0.45 && l > 0.55;
}

/**
 * Máscara preto-e-branco (mesmo UV da baseColorTexture) só com os pixels que
 * acendem para este time — vira o emissiveMap que acende só esses detalhes,
 * sem clarear o resto da textura. `null` quando o material não tem nenhum
 * pixel assim (a maioria — só gemas/joias/cristais passam no critério).
 */
function buildGlowMask(source: THREE.Texture, color: PieceColor): THREE.CanvasTexture | null {
  const image = source.image as CanvasImageSource | undefined;
  if (!image) return null;

  const size = GLOW_MASK_RESOLUTION;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0, size, size);
  const sample = ctx.getImageData(0, 0, size, size);

  const mask = ctx.createImageData(size, size);
  let hasGlow = false;
  for (let i = 0; i < sample.data.length; i += 4) {
    const glow = isGlowing(color, sample.data[i], sample.data[i + 1], sample.data[i + 2]);
    hasGlow ||= glow;
    const v = glow ? 255 : 0;
    mask.data[i] = v;
    mask.data[i + 1] = v;
    mask.data[i + 2] = v;
    mask.data[i + 3] = 255;
  }
  if (!hasGlow) return null;

  ctx.putImageData(mask, 0, 0);
  const maskTexture = new THREE.CanvasTexture(canvas);
  maskTexture.wrapS = source.wrapS;
  maskTexture.wrapT = source.wrapT;
  maskTexture.flipY = source.flipY;
  maskTexture.colorSpace = THREE.SRGBColorSpace;
  return maskTexture;
}

// Materiais GLTF são compartilhados por referência entre todas as instâncias
// clonadas do mesmo modelo (clone() não clona material) — processar uma vez
// por material (não por peça) evita refazer a leitura de pixels a cada peão.
const glowProcessedMaterials = new WeakSet<THREE.Material>();

/**
 * Todo material que recebeu brilho (vermelho vilão ou azul herói), pra
 * `GlowPulse` animar a intensidade de todos de uma vez só (um único
 * `useFrame`, não um por peça) — ver `src/three/effects/GlowPulse.tsx`.
 */
export const glowMaterials = new Set<THREE.MeshStandardMaterial>();

/**
 * Acende os detalhes vivos de um material como se tivessem luz própria: em
 * material texturizado, gera um emissiveMap a partir da própria
 * baseColorTexture (só as gemas/cristais acendem); em material de cor plana
 * (o set procedural sem textura), acende o material inteiro se a cor dele já
 * bater no critério do time — nenhuma peça sem gema/cristal cai nesse caso
 * hoje.
 */
function applyGlow(material: THREE.Material, color: PieceColor): void {
  if (glowProcessedMaterials.has(material)) return;
  glowProcessedMaterials.add(material);
  if (!(material instanceof THREE.MeshStandardMaterial)) return;

  if (material.map) {
    const mask = buildGlowMask(material.map, color);
    if (!mask) return;
    material.emissiveMap = mask;
    material.emissive = GLOW_COLOR[color];
    material.emissiveIntensity = GLOW_INTENSITY;
    material.needsUpdate = true;
    glowMaterials.add(material);
    return;
  }

  if (isGlowing(color, material.color.r * 255, material.color.g * 255, material.color.b * 255)) {
    material.emissive = material.color.clone();
    material.emissiveIntensity = GLOW_INTENSITY;
    material.needsUpdate = true;
    glowMaterials.add(material);
  }
}

/**
 * Cenas GLTF são compartilhadas por URL — clonar por instância evita montar o
 * mesmo Object3D sob vários pais (oito peões, um pawn.glb). `clone(true)`
 * copia a hierarquia mas NÃO o esqueleto: cada SkinnedMesh clonado seguiria
 * apontando para os ossos do original, e todas as instâncias do modelo com
 * rig colapsariam sobre a que se moveu por último. SkeletonUtils.clone
 * reconstrói um esqueleto por clone (e serve também para os modelos sem rig).
 */
export function cloneSkinnedScene(scene: THREE.Object3D, color: PieceColor, glow = true): THREE.Object3D {
  const clone = SkeletonUtils.clone(scene) as THREE.Object3D;
  clone.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (!glow) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => applyGlow(material, color));
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
