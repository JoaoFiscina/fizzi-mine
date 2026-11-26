// Datapack do Minecraft (Java 1.21+): constrói a construção, mostra um HOLOGRAMA ("construção fantasma")
// e confere o que falta. Tudo ancorado num marcador invisível: /function …/aqui marca o canto da construção
// e as outras funções usam essa posição, mesmo que você ande.
//
// O fantasma usa block_display: blocos de enfeite, sem colisão, um pouco menores que um bloco. Você constrói
// por cima e o bloco de verdade cobre o fantasma.

import { strToU8, zipSync } from 'fflate';
import type { CompiledModel, Voxel } from '../blueprint/compile';
import { parseState } from '../blueprint/compile';

/** Blocos que precisam de apoio: vão depois dos sólidos (portas, tochas, camas, tapetes…). */
const ATTACHED =
  /door|_bed$|torch|ladder|carpet|pressure_plate|button|rail|redstone_wire|lantern|sign|banner|vine|sugar_cane|cactus|wheat|carrots|potatoes|beetroots|sapling|flower|tulip|poppy|dandelion|orchid|allium|bluet|daisy|cornflower|lily|short_grass|fern|lever|repeater|comparator|candle|sea_pickle|kelp|water|lava|bell|tripwire|snow$|_head$|_skull$|potted_|flower_pot/;

/** Não aparecem como block_display (fluidos, portal, fogo). */
const NO_GHOST = /^(water|lava|nether_portal|end_portal|end_gateway|fire|soul_fire|air|light)$/;

const MAX_FILL = 32768;

export interface DatapackResult {
  zip: Uint8Array;
  fileName: string;
  ns: string;
  commands: number;
  ghosts: number;
  layers: number[];
}

function slugify(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'construcao';
}

/** "oak_stairs[facing=north]" → {Name:"minecraft:oak_stairs",Properties:{facing:"north"}} */
function blockStateSnbt(state: string): string {
  const { id, props } = parseState(state);
  const p = Object.entries(props);
  return `{Name:"minecraft:${id}"${p.length ? `,Properties:{${p.map(([k, v]) => `${k}:"${v}"`).join(',')}}` : ''}}`;
}

/** Nome de arquivo para a camada: y0, y12, y-3 */
const layerName = (y: number) => `y${y}`;

export function buildDatapack(model: CompiledModel, name: string): DatapackResult {
  const slug = slugify(name);
  const ns = `fizzimine:${slug}`;
  const tag = `fz_${slug}`.slice(0, 60);
  const [, oy] = model.offset;
  // posição relativa à âncora: x/z começam em ~1 (a construção sai a leste e a sul), y = coordenada do projeto
  const rel = (v: { x: number; y: number; z: number }) => [v.x + 1, v.y - oy, v.z + 1] as const;
  const atAnchor = `execute at @e[type=marker,tag=${tag},limit=1] run function`;
  const ensureAnchor = `execute unless entity @e[type=marker,tag=${tag}] run function ${ns}/aqui`;

  const sorted = [...model.voxels].sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
  const solid = sorted.filter((v) => !ATTACHED.test(v.id));
  const attached = sorted.filter((v) => ATTACHED.test(v.id));

  // junta blocos iguais lado a lado (no eixo x) num /fill
  const toCommands = (list: Voxel[]): string[] => {
    const out: string[] = [];
    let i = 0;
    while (i < list.length) {
      const a = list[i];
      let j = i;
      while (j + 1 < list.length && list[j + 1].y === a.y && list[j + 1].z === a.z && list[j + 1].x === list[j].x + 1 && list[j + 1].state === a.state) j++;
      const [x1, y, z] = rel(a);
      if (j > i) out.push(`fill ~${x1} ~${y} ~${z} ~${rel(list[j])[0]} ~${y} ~${z} ${a.state}`);
      else out.push(`setblock ~${x1} ~${y} ~${z} ${a.state}`);
      i = j + 1;
    }
    return out;
  };

  // fantasma: 1 block_display por bloco, 7/8 do tamanho, centralizado
  const ghostLine = (v: Voxel) => {
    const [x, y, z] = rel(v);
    return `summon block_display ~${x} ~${y} ~${z} {block_state:${blockStateSnbt(v.state)},transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],translation:[0.0625f,0.0625f,0.0625f],scale:[0.875f,0.875f,0.875f]},Tags:["fizzimine","${tag}","${tag}_y${v.y - oy}"]}`;
  };
  const ghostable = sorted.filter((v) => !NO_GHOST.test(v.id));
  const byLayer = new Map<number, Voxel[]>();
  for (const v of ghostable) {
    const y = v.y - oy;
    if (!byLayer.has(y)) byLayer.set(y, []);
    byLayer.get(y)!.push(v);
  }
  const layers = [...byLayer.keys()].sort((a, b) => a - b);

  const files: Record<string, Uint8Array> = {};
  const fn = (path: string, lines: string[]) => (files[`data/fizzimine/function/${slug}/${path}.mcfunction`] = strToU8(lines.join('\n') + '\n'));
  const say = (text: string, color = 'green') => `tellraw @s {"text":"${text.replace(/"/g, "'")}","color":"${color}"}`;

  // âncora
  fn('aqui', [
    `# Marca o canto da construção onde você está (a construção sai a leste e a sul daqui).`,
    `kill @e[type=marker,tag=${tag}]`,
    `execute align xyz run summon marker ~ ~ ~ {Tags:["fizzimine","${tag}"]}`,
    say(`FIZZI MINE: posição de "${name}" marcada aqui. Agora: /function ${ns}/fantasma ou /function ${ns}/construir`),
  ]);

  // construir
  fn('construir', [ensureAnchor, `${atAnchor} ${ns}/_blocos`, say(`FIZZI MINE: "${name}" construída (${model.voxels.length} blocos).`)]);
  fn('_blocos', [`# ${model.voxels.length} blocos`, ...toCommands(solid), ...toCommands(attached)]);

  // fantasma inteiro e por camada
  fn('fantasma', [ensureAnchor, `kill @e[type=block_display,tag=${tag}]`, `${atAnchor} ${ns}/_fantasma`, say(`FIZZI MINE: fantasma de "${name}" (${ghostable.length} blocos). Para tirar: /function ${ns}/apagar_fantasma`, 'aqua')]);
  fn('_fantasma', ghostable.map(ghostLine));
  for (const y of layers) {
    fn(`fantasma/${layerName(y)}`, [
      ensureAnchor,
      `kill @e[type=block_display,tag=${tag}]`,
      `${atAnchor} ${ns}/_fantasma_camada/${layerName(y)}`,
      say(`FIZZI MINE: camada y=${y} de "${name}" (${byLayer.get(y)!.length} blocos).`, 'aqua'),
    ]);
    fn(`_fantasma_camada/${layerName(y)}`, byLayer.get(y)!.map(ghostLine));
  }
  fn('apagar_fantasma', [`kill @e[type=block_display,tag=${tag}]`, say('FIZZI MINE: fantasma apagado.', 'gray')]);

  // conferir: partículas onde o bloco ainda não está (compara só o tipo do bloco, não a direção)
  fn('conferir', [ensureAnchor, `${atAnchor} ${ns}/_conferir`, say('FIZZI MINE: partículas verdes = falta bloco ali. Rode de novo depois de construir mais.', 'yellow')]);
  fn(
    '_conferir',
    sorted.map((v) => {
      const [x, y, z] = rel(v);
      return `execute unless block ~${x} ~${y} ~${z} minecraft:${v.id} run particle minecraft:happy_villager ~${x + 0.5} ~${y + 0.5} ~${z + 0.5} 0.25 0.25 0.25 0 4 force @a`;
    }),
  );

  // limpar: ar em toda a caixa da construção (em pedaços dentro do limite do /fill) + apaga fantasma
  const { size } = model;
  const clear: string[] = [`# Apaga (vira ar) a área da construção: ${size.x}×${size.y}×${size.z}`];
  const rowsPerFill = Math.max(1, Math.floor(MAX_FILL / (size.x * size.y)));
  for (let z = 0; z < size.z; z += rowsPerFill) {
    const z2 = Math.min(size.z - 1, z + rowsPerFill - 1);
    clear.push(`fill ~1 ~${-oy} ~${z + 1} ~${size.x} ~${size.y - 1 - oy} ~${z2 + 1} air`);
  }
  fn('limpar', [ensureAnchor, `kill @e[type=block_display,tag=${tag}]`, `${atAnchor} ${ns}/_limpar`, say('FIZZI MINE: área limpa.', 'gray')]);
  fn('_limpar', clear);

  const firstLayer = layers[0] ?? 0;
  const howto = [
    `FIZZI MINE · ${name}`,
    '',
    'Minecraft Java 1.21 ou mais novo, com comandos/cheats ativados.',
    '',
    'INSTALAR',
    '1. Coloque este .zip (sem descompactar) em: %appdata%\\.minecraft\\saves\\<nome do mundo>\\datapacks',
    '2. No jogo: /reload',
    '',
    'POSICIONAR (uma vez)',
    `   Fique em pé no canto NOROESTE de onde vai a construção e digite: /function ${ns}/aqui`,
    '   A construção vai para leste (+x) e para sul (+z); o térreo fica na altura dos seus pés.',
    '',
    'CONSTRUÇÃO FANTASMA (holograma para construir por cima)',
    `   Tudo:              /function ${ns}/fantasma`,
    `   Uma camada:        /function ${ns}/fantasma/${layerName(firstLayer)}   (troque o número: ${layers.map(layerName).join(', ')})`,
    `   Tirar o fantasma:  /function ${ns}/apagar_fantasma`,
    `   Ver o que falta:   /function ${ns}/conferir   (partículas verdes onde ainda falta bloco)`,
    '',
    'CONSTRUIR DE UMA VEZ (criativo)',
    `   /function ${ns}/construir      ·   apagar a área: /function ${ns}/limpar`,
    '',
    'Observações:',
    '- O fantasma não tem colisão: dá para andar e colocar blocos por cima. O bloco de verdade cobre o fantasma.',
    '- Baús, camas, placas e estandartes não aparecem no fantasma (o jogo não desenha esses como enfeite).',
    '- Água, lava e portal também não aparecem no fantasma.',
    '- Construções muito grandes viram muitas entidades: prefira mostrar uma camada por vez.',
  ].join('\n');

  const meta = { pack: { pack_format: 81, supported_formats: [48, 99], description: `FIZZI MINE: ${name}` } };
  files['pack.mcmeta'] = strToU8(JSON.stringify(meta, null, 2));
  files['como_usar.txt'] = strToU8(howto);

  return {
    zip: zipSync(files),
    fileName: `fizzimine-${slug}.zip`,
    ns,
    commands: toCommands(solid).length + toCommands(attached).length,
    ghosts: ghostable.length,
    layers,
  };
}
