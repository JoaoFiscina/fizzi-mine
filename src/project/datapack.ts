// Datapack do Minecraft (Java 1.21+) que constrói a construção no mundo com /function.
// A construção sai 1 bloco a leste e 1 a sul de onde você está; o y=0 do projeto fica na altura dos seus pés.

import { strToU8, zipSync } from 'fflate';
import type { CompiledModel, Voxel } from '../blueprint/compile';

/** Blocos que precisam de apoio: vão depois dos sólidos (portas, tochas, camas, tapetes…). */
const ATTACHED =
  /door|_bed$|torch|ladder|carpet|pressure_plate|button|rail|redstone_wire|lantern|sign|banner|vine|sugar_cane|cactus|wheat|carrots|potatoes|beetroots|sapling|flower|tulip|poppy|dandelion|orchid|allium|bluet|daisy|cornflower|lily|short_grass|fern|lever|repeater|comparator|candle|sea_pickle|kelp|water|lava|bell|tripwire|snow$|_head$|_skull$|potted_|flower_pot/;

const MAX_FILL = 32768;

export interface DatapackResult {
  zip: Uint8Array;
  fileName: string;
  /** Comando para digitar no jogo. */
  command: string;
  clearCommand: string;
  commands: number;
}

function slugify(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'construcao';
}

export function buildDatapack(model: CompiledModel, name: string): DatapackResult {
  const slug = slugify(name);
  const [, oy] = model.offset;
  // posição relativa ao jogador: x/z começam em ~1, y = coordenada do projeto
  const rel = (v: { x: number; y: number; z: number }) => [v.x + 1, v.y - oy, v.z + 1] as const;

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

  const build = [
    `# FIZZI MINE: ${name}`,
    `# ${model.voxels.length} blocos. Rode em pé no canto noroeste do terreno: a construção sai a leste (+x) e a sul (+z).`,
    ...toCommands(solid),
    ...toCommands(attached),
    `tellraw @s {"text":"FIZZI MINE: ${name.replace(/"/g, "'")} construída (${model.voxels.length} blocos).","color":"green"}`,
  ];

  // limpar: ar em toda a caixa da construção, em pedaços dentro do limite do /fill
  const { size } = model;
  const clear: string[] = [`# Apaga (vira ar) a área da construção: ${size.x}×${size.y}×${size.z}`];
  const rowsPerFill = Math.max(1, Math.floor(MAX_FILL / (size.x * size.y)));
  for (let z = 0; z < size.z; z += rowsPerFill) {
    const z2 = Math.min(size.z - 1, z + rowsPerFill - 1);
    clear.push(`fill ~1 ~${-oy} ~${z + 1} ~${size.x} ~${size.y - 1 - oy} ~${z2 + 1} air`);
  }

  const howto = [
    `FIZZI MINE · ${name}`,
    '',
    'Como usar (Minecraft Java 1.21 ou mais novo, com comandos/cheats ativados):',
    '1. Abra a pasta do mundo: %appdata%\\.minecraft\\saves\\<nome do mundo>\\datapacks',
    '2. Coloque este .zip lá dentro (não precisa descompactar).',
    '3. No jogo, digite /reload',
    '4. Fique em pé onde quer o canto NOROESTE da construção (olhe o F3: a construção vai para +x e +z).',
    `5. Digite: /function fizzimine:${slug}/construir`,
    '',
    `Para apagar a área depois: /function fizzimine:${slug}/limpar`,
    '',
    'Dica: faça num mundo criativo ou numa cópia do mundo. Blocos com gravidade (areia, cascalho) caem se ficarem sem apoio.',
  ].join('\n');

  const meta = { pack: { pack_format: 81, supported_formats: [48, 99], description: `FIZZI MINE: ${name}` } };
  const zip = zipSync({
    'pack.mcmeta': strToU8(JSON.stringify(meta, null, 2)),
    'como_usar.txt': strToU8(howto),
    [`data/fizzimine/function/${slug}/construir.mcfunction`]: strToU8(build.join('\n') + '\n'),
    [`data/fizzimine/function/${slug}/limpar.mcfunction`]: strToU8(clear.join('\n') + '\n'),
  });
  return {
    zip,
    fileName: `fizzimine-${slug}.zip`,
    command: `/function fizzimine:${slug}/construir`,
    clearCommand: `/function fizzimine:${slug}/limpar`,
    commands: build.length - 3,
  };
}
