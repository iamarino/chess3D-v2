/**
 * Mede o root motion e os footfalls de um clipe de caminhada num .glb.
 *
 * Imprime, pronto para colar, os campos que `MODEL_CONFIGS` (src/three/ModelLoader.ts)
 * precisa para uma peça animada. Ver docs/animacao-de-pecas.md.
 *
 *   node scripts/analisar-caminhada.mjs public/models/hero_pawn.glb
 *   node scripts/analisar-caminhada.mjs public/models/hero_pawn.glb --clip NlaTrack.001 --scale 1.12
 *
 * Sem --clip ele lista os clipes do arquivo e sai (os exports da Tripo vêm com
 * nomes genéricos "NlaTrack", "NlaTrack.001"..., então é preciso identificar a
 * caminhada — é a que tem deslocamento grande do osso raiz, destacada na lista).
 */
import * as THREE from 'three';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const clipName = valueOf('--clip');
const scale = Number(valueOf('--scale') ?? 1);

function valueOf(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

if (!file) {
  console.error('uso: node scripts/analisar-caminhada.mjs <arquivo.glb> [--clip NOME] [--scale N]');
  process.exit(1);
}

// ---------------------------------------------------------------- GLB parsing
const buf = readFileSync(file);
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file} não é um .glb`);

let offset = 12;
let json = null;
let bin = null;
while (offset < buf.length) {
  const len = buf.readUInt32LE(offset);
  const type = buf.readUInt32LE(offset + 4);
  const chunk = buf.subarray(offset + 8, offset + 8 + len);
  if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(chunk));
  if (type === 0x004e4942) bin = chunk;
  offset += 8 + len;
  offset += (4 - (offset % 4)) % 4;
}

const COMPONENT = {
  5120: [Int8Array, 1], 5121: [Uint8Array, 1], 5122: [Int16Array, 2],
  5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4],
};
const COMPONENTS_PER_TYPE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function readAccessor(index) {
  const a = json.accessors[index];
  const view = json.bufferViews[a.bufferView];
  const [Ctor, bytes] = COMPONENT[a.componentType];
  const n = COMPONENTS_PER_TYPE[a.type];
  const start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const stride = view.byteStride;
  const out = new Ctor(a.count * n);
  if (!stride || stride === n * bytes) {
    out.set(new Ctor(bin.buffer, bin.byteOffset + start, a.count * n));
  } else {
    for (let e = 0; e < a.count; e++) {
      out.set(new Ctor(bin.buffer, bin.byteOffset + start + e * stride, n), e * n);
    }
  }
  return { data: out, count: a.count };
}

const nodes = json.nodes ?? [];
const parentOf = new Map();
nodes.forEach((node, i) => (node.children ?? []).forEach((c) => parentOf.set(c, i)));
const roots = nodes.map((_, i) => i).filter((i) => !parentOf.has(i));

function clipDuration(anim) {
  return Math.max(...anim.channels.map((ch) => {
    const input = readAccessor(anim.samplers[ch.sampler].input);
    return input.data[input.count - 1];
  }));
}

/** Track de posição com maior amplitude = osso que carrega o root motion. */
function rootMotionTrack(anim) {
  let best = null;
  for (const ch of anim.channels) {
    if (ch.target.path !== 'translation') continue;
    const sampler = anim.samplers[ch.sampler];
    const input = readAccessor(sampler.input);
    const output = readAccessor(sampler.output);
    let span = 0;
    for (let axis = 0; axis < 3; axis++) {
      let min = Infinity;
      let max = -Infinity;
      for (let k = 0; k < input.count; k++) {
        const v = output.data[k * 3 + axis];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      span = Math.max(span, max - min);
    }
    if (!best || span > best.span) {
      best = { span, node: ch.target.node, name: nodes[ch.target.node].name, input, output };
    }
  }
  return best;
}

// -------------------------------------------------------- listagem dos clipes
const animations = json.animations ?? [];
if (!clipName) {
  console.log(`${file} — ${animations.length} clipe(s):\n`);
  animations.forEach((anim, i) => {
    const track = rootMotionTrack(anim);
    const drift = track
      ? Math.abs(track.output.data[(track.input.count - 1) * 3 + 1] - track.output.data[1])
      : 0;
    const flag = track && track.span > 0.5 ? '  <-- provável caminhada (root motion)' : '';
    console.log(
      `  [${i}] "${anim.name}"  dur=${clipDuration(anim).toFixed(3)}s  ` +
      `osso=${track?.name ?? '-'}  amplitude=${track?.span.toFixed(3) ?? '-'}${flag}`,
    );
    void drift;
  });
  console.log('\nRode de novo com --clip "<nome>" para medir os footfalls.');
  process.exit(0);
}

// ------------------------------------------------------- análise de um clipe
const anim = animations.find((a) => a.name === clipName);
if (!anim) throw new Error(`clipe "${clipName}" não encontrado`);

const duration = clipDuration(anim);
const channels = anim.channels.map((ch) => ({
  node: ch.target.node,
  path: ch.target.path,
  input: readAccessor(anim.samplers[ch.sampler].input),
  output: readAccessor(anim.samplers[ch.sampler].output),
  interpolation: anim.samplers[ch.sampler].interpolation ?? 'LINEAR',
}));

function sample(input, output, n, t, interpolation) {
  let i = 0;
  while (i < input.count && input.data[i] < t) i++;
  if (i === 0) return Array.from(output.data.slice(0, n));
  if (i >= input.count) return Array.from(output.data.slice((input.count - 1) * n, input.count * n));
  const span = input.data[i] - input.data[i - 1];
  const f = span > 0 ? (t - input.data[i - 1]) / span : 0;
  const stride = interpolation === 'CUBICSPLINE' ? 3 : 1;
  const shift = interpolation === 'CUBICSPLINE' ? n : 0;
  const a = Array.from(output.data.slice((i - 1) * stride * n + shift, (i - 1) * stride * n + shift + n));
  const b = Array.from(output.data.slice(i * stride * n + shift, i * stride * n + shift + n));
  if (interpolation === 'STEP') return a;
  if (n === 4) {
    const qa = new THREE.Quaternion(...a);
    qa.slerp(new THREE.Quaternion(...b), f);
    return [qa.x, qa.y, qa.z, qa.w];
  }
  return a.map((v, k) => v + (b[k] - v) * f);
}

/** Matrizes de mundo de todos os nós, com o clipe avaliado em `t`. */
function worldMatrices(t) {
  const local = nodes.map((node) => ({
    T: node.translation ? new THREE.Vector3(...node.translation) : new THREE.Vector3(),
    R: node.rotation ? new THREE.Quaternion(...node.rotation) : new THREE.Quaternion(),
    S: node.scale ? new THREE.Vector3(...node.scale) : new THREE.Vector3(1, 1, 1),
    matrix: new THREE.Matrix4(),
  }));
  for (const ch of channels) {
    if (ch.path === 'weights') continue;
    const n = ch.path === 'rotation' ? 4 : 3;
    const v = sample(ch.input, ch.output, n, t, ch.interpolation);
    const L = local[ch.node];
    if (ch.path === 'translation') L.T.set(v[0], v[1], v[2]);
    if (ch.path === 'rotation') L.R.set(v[0], v[1], v[2], v[3]);
    if (ch.path === 'scale') L.S.set(v[0], v[1], v[2]);
  }
  local.forEach((L) => L.matrix.compose(L.T, L.R, L.S));

  const world = new Array(nodes.length);
  const visit = (i, parent) => {
    world[i] = new THREE.Matrix4().multiplyMatrices(parent, local[i].matrix);
    (nodes[i].children ?? []).forEach((c) => visit(c, world[i]));
  };
  roots.forEach((r) => visit(r, new THREE.Matrix4()));
  return world;
}

// Ossos dos pés: o apoio é detectado pela velocidade em espaço de MUNDO. Com
// root motion autorado corretamente o pé apoiado fica praticamente imóvel no
// mundo enquanto o corpo avança — é essa queda de velocidade que marca o footfall.
let feet = nodes.map((n, i) => [n.name ?? '', i]).filter(([n]) => /foot/i.test(n));
if (feet.length === 0) feet = nodes.map((n, i) => [n.name ?? '', i]).filter(([n]) => /toe|ankle/i.test(n));
if (feet.length === 0) throw new Error('nenhum osso de pé encontrado (procurei por foot/toe/ankle)');

const SAMPLES = 96;
const times = Array.from({ length: SAMPLES + 1 }, (_, k) => (k / SAMPLES) * duration);
const positions = times.map((t) => {
  const world = worldMatrices(t);
  return feet.map(([, i]) => new THREE.Vector3().setFromMatrixPosition(world[i]));
});

const footfalls = [];
feet.forEach(([name], footIndex) => {
  const speeds = [];
  for (let k = 1; k <= SAMPLES; k++) {
    speeds.push(positions[k][footIndex].distanceTo(positions[k - 1][footIndex]) / (duration / SAMPLES));
  }
  const threshold = Math.max(...speeds) * 0.18;
  let start = null;
  for (let k = 0; k < speeds.length; k++) {
    const planted = speeds[k] < threshold;
    if (planted && start === null) start = k;
    if (!planted && start !== null) {
      // Janelas que começam no quadro 0 são a continuação do apoio do ciclo
      // anterior, não um novo footfall.
      if (start > 0) footfalls.push({ t: times[start], foot: name });
      start = null;
    }
  }
  if (start !== null && start > 0) footfalls.push({ t: times[start], foot: name });
});
footfalls.sort((a, b) => a.t - b.t);

const track = rootMotionTrack(anim);
let axis = 0;
let bestDelta = 0;
for (let a = 0; a < 3; a++) {
  const delta = Math.abs(track.output.data[(track.input.count - 1) * 3 + a] - track.output.data[a]);
  if (delta > bestDelta) {
    bestDelta = delta;
    axis = a;
  }
}
const loopWorld = bestDelta * scale;
const stride = loopWorld / footfalls.length;

console.log(`\n${file} — clipe "${clipName}"`);
console.log(`  duração ............ ${duration.toFixed(4)}s`);
console.log(`  osso do root motion  ${track.name} (eixo local ${'XYZ'[axis]})`);
console.log(`  avanço por ciclo ... ${bestDelta.toFixed(4)} local = ${loopWorld.toFixed(4)} un. de mundo (scale ${scale})`);
console.log(`  footfalls .......... ${footfalls.length} por ciclo`);
footfalls.forEach((f) => console.log(`      t=${f.t.toFixed(3)}s  (${f.foot})`));
console.log(`  passada ............ ${stride.toFixed(4)} un. de mundo`);
console.log(`  1 casa = ${(1 / stride).toFixed(3)} passos   |   2 casas = ${(2 / stride).toFixed(3)}   |   diagonal = ${(Math.SQRT2 / stride).toFixed(3)}`);

const steps = Math.max(1, Math.round(1 / stride));
const erro = Math.abs(1 - steps * stride) / 1;
console.log(`\n  -> 1 casa será andada em ${steps} passo(s), com ${(erro * 100).toFixed(1)}% de correção de passada.`);
if (erro > 0.15) {
  console.log('     ATENÇÃO: acima de ~15% a correção começa a aparecer como pé escorregando.');
  console.log('     Ajuste `scale` do modelo ou reexporte o clipe com passada compatível.');
}

console.log('\n  Para colar em MODEL_CONFIGS (src/three/ModelLoader.ts):');
console.log(`      walkClip: '${clipName}',`);
console.log(`      walkFootfalls: [${footfalls.map((f) => f.t.toFixed(2)).join(', ')}],`);
