# Animação de peças — locomoção por root motion

Como uma peça com rig caminha (ou corre) de uma casa para outra, e o que
fazer para animar uma peça nova pelo mesmo mecanismo.

Toda peça sem `walkClip` continua simplesmente deslizando entre as casas, sem
animação de pernas — isso é esperado e não precisa de nada.

## O princípio

**A posição da peça no tabuleiro é derivada da animação, nunca calculada em
paralelo a ela.**

O clipe de caminhada é autorado com root motion de verdade: o osso raiz avança
sozinho e, durante o apoio, o pé fica imóvel no mundo enquanto o corpo passa
por cima dele. Ou seja, a própria animação já diz exatamente quanto chão o
personagem cobre a cada passo.

A implementação tira esse avanço do osso (o clipe vira *in-place*) e o reaplica
no grupo da peça, ao longo da direção da jogada. Como pose e posição saem da
**mesma fase do clipe**, o pé não escorrega em instante nenhum — em qualquer
ritmo, acelerando ou desacelerando.

### O que havia antes, e por que não funcionava

O avanço do root motion era aplicado ao osso **e** a peça era interpolada por
fora, ao mesmo tempo. Dois movimentos somados, cada um com seu próprio ritmo.
Como o resultado não caía na casa certa, existia um ajuste manual
("ponto de parada da caminhada") que mandava a caminhada parar antes do
destino, seguido de uma correção rápida até o centro da casa — e era essa
correção que aparecia como um deslize no fim da jogada.

Com a posição derivada da animação, esse ajuste deixou de existir: não há o que
calibrar, a peça chega no centro por construção.

## As três peças do mecanismo

| arquivo | papel |
|---|---|
| `src/three/walkMotion.ts` | Extrai o root motion do clipe, monta o plano da caminhada e a curva de aceleração. Puro, sem React nem three.js de cena. Genérico: serve tanto para `walkClip` quanto para `runClip`. |
| `src/three/ModelLoader.ts` | `MODEL_CONFIGS` declara `walkClip`/`walkFootfalls` (e, opcionalmente, `runClip`/`runFootfalls`) por modelo. |
| `src/three/Piece.tsx` | Toca o plano: escolhe caminhada ou corrida, avança a fase, posiciona o grupo, vira a peça e faz o crossfade entre parado/caminhando/correndo. |

### Por que a parada coincide com a desaceleração

Dois detalhes fazem isso acontecer:

1. **A caminhada começa e termina num footfall** — um instante em que um pé
   acabou de encostar no chão. `planWalk` escolhe um número inteiro de passos e
   fecha a fase exatamente num desses instantes. Quando a peça para, o pé de
   apoio já está imóvel: não há nada para escorregar.
2. **A cadência e o avanço vêm da mesma curva** (`rampedProgress`). Desacelerar
   a peça desacelera os passos na mesma proporção, automaticamente.

O número de passos é inteiro, então a distância autoral quase nunca bate no
milímetro com a casa destino. A diferença é absorvida por um fator (`warp`) que
estica ou comprime o avanço. **Abaixo de ~15% ele é invisível**; acima disso o
pé começa a escorregar de verdade. No peão herói ele fica em 2% (1 casa) e 1%
(2 casas).

## Receita para animar uma peça nova

### 1. Descobrir os clipes

Exports da Tripo vêm com nomes genéricos (`NlaTrack`, `NlaTrack.001`, ...), então
é preciso identificar quais são a introdução e a caminhada:

```bash
node scripts/analisar-caminhada.mjs public/models/hero_king.glb
```

A caminhada é a que tem amplitude grande no osso raiz — o script marca as
candidatas. Confirme visualmente antes de seguir: um clipe de corrida ou de
esquiva também tem deslocamento.

### 2. Medir os footfalls

```bash
node scripts/analisar-caminhada.mjs public/models/hero_king.glb --clip NlaTrack.001 --scale 1.32
```

Passe em `--scale` o mesmo `scale` que o modelo usa em `MODEL_CONFIGS` — é ele
que converte as unidades do modelo em casas do tabuleiro. O script mede os
footfalls pela velocidade do osso do pé em espaço de mundo (no apoio ela cai
para uns 6% do pico) e imprime o trecho pronto para colar.

Olhe a linha da correção de passada. Se passar de ~15%, ajuste o `scale` do
modelo ou reexporte o clipe com uma passada compatível, em vez de aceitar o
escorregamento.

### 3. Declarar no `MODEL_CONFIGS`

```ts
pawn: {
  path: '/models/hero_pawn.glb',
  scale: 1.12,
  rotation: [0, Math.PI, 0],
  introClip: 'NlaTrack',
  walkClip: 'NlaTrack.001',
  walkFootfalls: [0.37, 0.96, 1.56, 2.13],
},
```

Não é preciso mexer em `Piece.tsx`: havendo `walkClip` + `walkFootfalls`, a
locomoção por root motion entra sozinha para aquele modelo.

### 4. Conferir

Mova a peça uma casa e duas casas, e faça uma captura na diagonal. O que
observar: o pé de apoio deve ficar cravado no chão durante todo o apoio, a peça
deve assentar no centro da casa sem nenhum salto no fim, e ela deve se virar
para a direção do movimento (a virada só aparece nas diagonais).

## Corrida (`runClip`) para lances longos

Peças que cobrem muitas casas num só lance (hoje só a torre vilã) podem ter um
segundo clipe — de corrida — usado em vez da caminhada quando o lance passa de
`RUN_DISTANCE_THRESHOLD` casas (constante em `Piece.tsx`, hoje 2). É o mesmo
mecanismo de root motion do `walkClip`: identifique o clipe e meça os
footfalls do mesmo jeito (seção 1–2 acima), e declare `runClip` +
`runFootfalls` em `MODEL_CONFIGS` ao lado de `walkClip`. Sem `runClip`,
qualquer distância usa a caminhada, como sempre.

```ts
rook: {
  path: '/models/villain_rook.glb',
  scale: 1.43,
  rotation: [0, 0, 0],
  walkClip: 'NlaTrack',
  walkFootfalls: [0.27, 0.73, 1.2, 1.66],
  runClip: 'NlaTrack.001',
  runFootfalls: [0.34, 0.63, 0.96],
},
```

`Piece.tsx` escolhe entre as duas WalkMotions em `beginTravel` (`useRun`) e
guarda qual está ativa em `locomotionRef`, que `PieceModel` lê para saber qual
das duas actions tocar — os dois clipes ficam sempre carregados no mixer, só
um por vez tem peso > 0.

### Desaceleração proporcional à distância

Andando, a rampa de aceleração/desaceleração é a fração fixa `WALK_RAMP`
(18% da duração, em cada ponta) — o padrão de sempre. Correndo, a rampa passa
a ser `1 / distanceSquares`: como a fase avança ~linear fora das próprias
rampas, isso faz a zona de desaceleração cobrir aproximadamente **a última
casa do trajeto**, qualquer que seja a distância total — a peça já está
freando ao entrar na penúltima casa, em vez de frear só nos últimos ~18% do
tempo (que para um lance de 7 casas seria menos de uma casa inteira). Ver
`ramp` em `WalkState` e `beginTravel`, em `Piece.tsx`.

## Golpe (`attackClip`) em capturas à distância

**Regra: todo golpe acontece na casa ANTES da casa de quem vai ser capturado,
nunca na casa de quem vai ser capturado.** A peça só ocupa a casa do
adversário depois que ele já sumiu da cena. Como isso se resolve depende de
quão longe a captura começa:

- **Já adjacente ao alvo** (o peão, sempre — captura é sempre na diagonal ao
  lado; ou qualquer peça capturando a 1 casa de distância): a casa de origem
  já É a "casa antes" do alvo, então o golpe dispara direto, sem se mover.
  Sequência: golpe → espera a animação de queda do adversário terminar **e**
  ele sumir da cena → só então caminha a 1 casa até a casa do alvo.
- **Mais de 1 casa de distância** (a torre, capturando em qualquer casa da
  mesma linha/coluna): golpear direto na casa de origem ficaria estranho — a
  peça pareceria "já saber" que vai vencer antes de sequer se aproximar. Em
  vez disso, `Piece.tsx` insere uma etapa antes do golpe: anda/corre
  normalmente (mesmo mecanismo de `walkClip`/`runClip` acima) até ficar
  exatamente 1 casa antes do alvo, e só então dispara o golpe. Sequência
  completa: caminhada/corrida até a casa antes do alvo → golpe → espera a
  animação de queda do adversário terminar e ele sumir da cena → só então
  caminha a última casa até a casa do alvo.

Essa aproximação é orquestrada por `pendingAttackRef`: guarda o alvo real e o
defensor enquanto a peça ainda está a caminho da casa adjacente; o bloco de
chegada da caminhada, em `useFrame`, o consome e é isso que dispara
`actionRef.current = 'attack'` — em vez de fazer isso na hora da captura, como
acontece quando já está adjacente. O restante (golpe → queda → caminhada
final) é o mesmo bloco de `captureTargetRef` nos dois casos, orquestrado no
`useFrame` — só muda onde e quando o golpe é disparado.

## Invariantes — o que não quebrar

- **Não interpole a posição por fora da fase.** Qualquer tween de posição que
  não venha de `displacementAt(phase)` reintroduz exatamente o bug original.
- **Não use `position` como prop reativa no JSX do grupo da peça.** Ela seria
  reaplicada na mesma renderização em que a jogada muda a casa, teleportando a
  peça e zerando a distância que a caminhada deveria percorrer.
- **Não baixe o peso do clipe de caminhada para "encurtar a passada".** Misturar
  a caminhada com uma pose parada reduz a amplitude das pernas e deixa o
  personagem arrastando os pés. A passada casa com o chão por construção; se
  parecer errada, o problema está no `scale` ou nos footfalls.
- **A fase é ditada pela locomoção, não pelo relógio do mixer.** A action fica
  `paused` e recebe `time` a cada quadro; é isso que garante terminar no
  footfall planejado em vez de onde o tempo cair.
- **Só a peça que acabou de jogar caminha.** `Piece` compara a jogada com
  `lastMove` do store; sem isso um "reiniciar" ou "desfazer" faz o tabuleiro
  inteiro sair andando.
- **`locomotionRef` e `phaseRef` andam juntos.** Todo lugar que zera
  `phaseRef.current` (chegada, jogada cancelada, início de golpe) também zera
  `locomotionRef.current` — senão `PieceModel` pode achar que uma locomoção
  antiga ainda está ativa na próxima vez que `phaseRef` voltar a um número.
- **O golpe nunca toca na casa do alvo.** Sempre na casa antes dela — direto,
  se a peça já começa adjacente, ou depois de uma etapa de aproximação, se
  começa mais longe (ver "Golpe em capturas à distância" acima). A peça só
  ocupa a casa do adversário depois que ele já sumiu da cena.

## Ajuste de ritmo

Em Configurações → Animação de peças, "Ritmo da caminhada" multiplica a cadência
autoral (1.00× = o ritmo em que a animação foi feita). Não existe controle de
duração: a duração sai da distância, porque a peça avança pelo root motion do
clipe. Duas casas levam o dobro de passos, não o dobro de pressa.

Mudar o ritmo é seguro em termos de qualidade — como a posição vem da fase,
acelerar a caminhada inteira nunca descola o pé do chão.
