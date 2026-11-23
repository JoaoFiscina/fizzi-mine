// Aparência de cada bloco: cor, transparência e forma.
// Sem texturas da Mojang (direitos autorais). Fase 3: carregar as texturas do jogo do próprio usuário.

/** Família de forma; a geometria final (direção, conexões) é decidida em geometry.ts. */
export type Kind =
  | 'full' | 'slab' | 'carpet' | 'small' | 'stairs' | 'door' | 'trapdoor' | 'fence' | 'fence_gate'
  | 'pane' | 'wall' | 'rod' | 'lantern' | 'bed' | 'chest' | 'plate' | 'cross';

export interface BlockLook {
  color: number;
  opacity: number;
  kind: Kind;
}

const DYES: [string, number][] = [
  ['light_blue', 0x3aafd9], ['light_gray', 0x8e8e86],
  ['white', 0xe9ecec], ['orange', 0xf07613], ['magenta', 0xbd44b3], ['yellow', 0xf8c527],
  ['lime', 0x70b919], ['pink', 0xed8dac], ['gray', 0x3e4447], ['cyan', 0x158991],
  ['purple', 0x792aac], ['blue', 0x35399d], ['brown', 0x724728], ['green', 0x546d1b],
  ['red', 0xa12722], ['black', 0x141519],
];

const COLORS: Record<string, number> = {
  // terra e pedra
  stone: 0x7d7d7d, cobblestone: 0x7a7a7a, mossy_cobblestone: 0x6e7d5e, stone_bricks: 0x7a7a7a,
  mossy_stone_bricks: 0x737d63, cracked_stone_bricks: 0x767676, smooth_stone: 0x9e9e9e,
  andesite: 0x888889, polished_andesite: 0x848786, diorite: 0xbcbcbc, polished_diorite: 0xc0c1c2,
  granite: 0x956756, polished_granite: 0x9a6a59, deepslate: 0x505053, cobbled_deepslate: 0x4d4d51,
  deepslate_bricks: 0x464648, deepslate_tiles: 0x37373a, polished_deepslate: 0x484849, tuff: 0x6c6d66,
  calcite: 0xdfe0dc, blackstone: 0x2a2328, polished_blackstone_bricks: 0x302a31,
  dirt: 0x866043, coarse_dirt: 0x77553b, grass_block: 0x5d9b3a, podzol: 0x5b3f18, mud: 0x3c3a3d,
  mud_bricks: 0x8a6a4f, farmland: 0x5a3a20, dirt_path: 0x947a41, clay: 0xa0a6b3,
  sand: 0xdbcfa3, red_sand: 0xbe6721, sandstone: 0xd8cb9b, smooth_sandstone: 0xe0d6aa,
  cut_sandstone: 0xd9ce9f, red_sandstone: 0xb5621f, gravel: 0x837f7e,
  bricks: 0x966153, terracotta: 0x985e43, netherrack: 0x6f3535, nether_bricks: 0x2c1519,
  end_stone: 0xdbde9e, end_stone_bricks: 0xdadfa3, purpur_block: 0xa97ca9, obsidian: 0x14121d,
  prismarine: 0x63a29a, prismarine_bricks: 0x63ab9e, dark_prismarine: 0x335b4b,
  quartz_block: 0xebe5de, smooth_quartz: 0xebe5de, quartz_bricks: 0xeae4dc, quartz_pillar: 0xebe6e0,
  // madeira
  oak_planks: 0xa2834f, spruce_planks: 0x725430, birch_planks: 0xc0af79, jungle_planks: 0xa07351,
  acacia_planks: 0xa85a32, dark_oak_planks: 0x42290f, mangrove_planks: 0x763631,
  cherry_planks: 0xe2b3ac, bamboo_planks: 0xc3ad53, crimson_planks: 0x65304a, warped_planks: 0x2b6963,
  pale_oak_planks: 0xe3d9d4,
  oak_log: 0x6d5533, spruce_log: 0x3b2610, birch_log: 0xd8d7d2, jungle_log: 0x564419,
  acacia_log: 0x676157, dark_oak_log: 0x3c2e1a, mangrove_log: 0x544229, cherry_log: 0x37202a,
  stripped_oak_log: 0xb1904f, stripped_spruce_log: 0x75592f, stripped_birch_log: 0xc5b077,
  stripped_dark_oak_log: 0x48382a,
  oak_leaves: 0x4a7a23, spruce_leaves: 0x3b5e3b, birch_leaves: 0x5f8a3a, jungle_leaves: 0x3f8f1f,
  dark_oak_leaves: 0x3b6b1a, acacia_leaves: 0x5a8a22, cherry_leaves: 0xe7a6c4, azalea_leaves: 0x5a7a2b,
  // vidro, água
  glass: 0xc0e4f0, glass_pane: 0xc0e4f0, tinted_glass: 0x2c2733, water: 0x3f76e4, ice: 0x91b7fd,
  packed_ice: 0x8db4fa, blue_ice: 0x74a8fd, lava: 0xd96415,
  // minérios e blocos de recurso
  iron_block: 0xdcdcdc, gold_block: 0xf6d03d, diamond_block: 0x62ede4, emerald_block: 0x2acb57,
  lapis_block: 0x1e43a8, redstone_block: 0xaf1a05, coal_block: 0x101010, netherite_block: 0x423d3f,
  copper_block: 0xc06c50, cut_copper: 0xbf6b51, oxidized_copper: 0x52a284, amethyst_block: 0x8562c2,
  // utilitários
  crafting_table: 0x8f6a3c, furnace: 0x6b6b6b, blast_furnace: 0x5a5a5c, smoker: 0x6b5a48,
  chest: 0xa26d2e, barrel: 0x86643a, trapped_chest: 0xa26d2e, ender_chest: 0x1f2e2e,
  hopper: 0x4a4a4a, dropper: 0x6e6e6e, dispenser: 0x6e6e6e, observer: 0x5e5e5e,
  piston: 0x9c8a6a, sticky_piston: 0x7f9c6a, redstone_wire: 0xc01010, redstone_lamp: 0x9a6a3a,
  repeater: 0xa0a0a0, comparator: 0xa0a0a0, lever: 0x7a6a50, rail: 0x8a7a60, powered_rail: 0xb09040,
  bookshelf: 0x7a5a32, lectern: 0xa2834f, anvil: 0x444444, enchanting_table: 0x5b2a3a,
  brewing_stand: 0x7a6a5a, cauldron: 0x3d3d3d, composter: 0x7a5a30, beacon: 0x75dfd9,
  torch: 0xffd75e, wall_torch: 0xffd75e, lantern: 0xe8a640, soul_lantern: 0x60c8d0,
  glowstone: 0xfcd17a, sea_lantern: 0xc8e0d8, shroomlight: 0xf09a4a, jack_o_lantern: 0xe08a1e,
  hay_block: 0xa68b0c, pumpkin: 0xc6761e, melon: 0x72921e, sugar_cane: 0x94c065, cactus: 0x587d2c,
  bamboo: 0x6a9a2a, kelp: 0x56862a, wheat: 0xc8b048, carrots: 0x58a028, potatoes: 0x68a038,
  slime_block: 0x6fc05a, honey_block: 0xf4a82a, target: 0xe5b0a0, tnt: 0xd03a2a,
  iron_bars: 0x8a8a8a, chain: 0x3a3e48, scaffolding: 0xc8a050, ladder: 0x9a7a4a,
  bell: 0xe0c040, campfire: 0xe08a30, spawner: 0x2a3a4a, bedrock: 0x555555,
  nether_portal: 0x8a3ad8, end_portal: 0x0c1a24, fire: 0xff9a2a,
};

const WOODS = ['dark_oak', 'pale_oak', 'oak', 'spruce', 'birch', 'jungle', 'acacia', 'mangrove', 'cherry', 'bamboo', 'crimson', 'warped'];
const SUFFIXES = ['_stairs', '_slab', '_wall', '_fence_gate', '_fence', '_door', '_trapdoor', '_pressure_plate', '_button', '_sign', '_hanging_sign', '_wall_sign', '_pillar'];

function baseColor(id: string): number | undefined {
  if (COLORS[id] !== undefined) return COLORS[id];

  // Corantes: white_wool, red_concrete, blue_stained_glass, black_terracotta, lime_carpet, red_bed...
  for (const [dye, c] of DYES) {
    if (id.startsWith(dye + '_')) {
      if (id.includes('terracotta')) return mix(c, 0x985e43, 0.45);
      if (id.includes('concrete_powder')) return mix(c, 0xffffff, 0.15);
      return c;
    }
  }

  // Variações: oak_stairs → oak_planks, stone_brick_stairs → stone_bricks, cobblestone_wall → cobblestone
  for (const suf of SUFFIXES) {
    if (id.endsWith(suf)) {
      const base = id.slice(0, -suf.length);
      for (const cand of [base, base + 's', base + '_planks', base + '_block']) if (COLORS[cand] !== undefined) return COLORS[cand];
    }
  }
  for (const wood of WOODS) if (id.startsWith(wood + '_')) return COLORS[wood + '_planks'];

  // Palavras-chave
  const kw: [RegExp, number][] = [
    [/_ore$/, 0x7f7f7f], [/leaves/, 0x4a7a23], [/log|wood|stem/, 0x6d5533], [/glass/, 0xc0e4f0],
    [/copper/, 0xc06c50], [/sandstone/, 0xd8cb9b], [/deepslate/, 0x4d4d51], [/brick/, 0x966153],
    [/stone/, 0x7d7d7d], [/flower|tulip|poppy|dandelion|orchid|allium|daisy/, 0xd04060],
    [/sapling|fern|grass|bush|vine/, 0x4f8a2a], [/coral/, 0xd05a8a], [/candle/, 0xe8d8a0],
  ];
  for (const [re, c] of kw) if (re.test(id)) return c;
  return undefined;
}

function mix(a: number, b: number, t: number): number {
  const ch = (n: number, s: number) => (n >> s) & 255;
  const m = (s: number) => Math.round(ch(a, s) * (1 - t) + ch(b, s) * t) << s;
  return m(16) | m(8) | m(0);
}

/** Cor estável para blocos desconhecidos (mesmo id → mesma cor). */
function hashColor(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  const s = 0.35, l = 0.5;
  const k = (n: number) => (n + hue / 30) % 12;
  const f = (n: number) => l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
}

function kindOf(id: string, props: Record<string, string>): Kind {
  if (id.endsWith('_slab')) return props.type === 'double' ? 'full' : 'slab';
  if (id.endsWith('_stairs')) return 'stairs';
  if (id.endsWith('_trapdoor')) return 'trapdoor';
  if (id.endsWith('_door')) return 'door';
  if (id.endsWith('_fence_gate')) return 'fence_gate';
  if (id.endsWith('_fence')) return 'fence';
  if (id.endsWith('_pane') || id === 'iron_bars') return 'pane';
  if (id.endsWith('_wall') && !/sign|banner|torch|fan|head|skull/.test(id)) return 'wall';
  if (/^(chain|iron_chain|end_rod|lightning_rod)$/.test(id)) return 'rod';
  if (/lantern$/.test(id) && !id.includes('sea_') && id !== 'jack_o_lantern') return 'lantern';
  if (id.endsWith('_bed')) return 'bed';
  if (/^(chest|trapped_chest|ender_chest)$/.test(id)) return 'chest';
  if (id === 'ladder' || id.endsWith('_wall_sign') || id.endsWith('_wall_banner') || id === 'vine') return 'plate';
  if (/carpet|pressure_plate|rail$|^redstone_wire$|^snow$|lily_pad|^repeater$|^comparator$|^tripwire$|pink_petals/.test(id)) return 'carpet';
  if (/flower|tulip|poppy|dandelion|orchid|allium|bluet|daisy|cornflower|lily_of|rose|sapling|^sugar_cane$|^bamboo$|^kelp|^wheat$|^carrots$|^potatoes$|^beetroots$|fern$|^short_grass$|^tall_grass$|mushroom$|^dead_bush$|^cobweb$|roots$|fungus$|^sweet_berry_bush$|^seagrass$|^tall_seagrass$|^lilac$|^peony$|^sunflower$|^torchflower$|^pitcher_plant$/.test(id) && !id.endsWith('_block') && !id.startsWith('potted_')) return 'cross';
  if (/torch|^lever$|_button$|^candle|_candle$|^bell$|^sea_pickle$|^flower_pot$|^potted_|_head$|_skull$|^tripwire_hook$|^amethyst_cluster$/.test(id)) return 'small';
  return 'full';
}

function opacityOf(id: string): number {
  if (id === 'water') return 0.55;
  if (id === 'nether_portal') return 0.7;
  if (/glass|^ice$/.test(id)) return 0.45;
  if (/leaves/.test(id)) return 0.9;
  return 1;
}

const cache = new Map<string, BlockLook>();

export function lookFor(id: string, props: Record<string, string>): BlockLook {
  const key = id + '|' + (props.type ?? '');
  let look = cache.get(key);
  if (!look) {
    let color = baseColor(id) ?? hashColor(id);
    // Portas, alçapões e portões mais escuros para não sumirem na parede de mesma madeira
    if (/_door$|_trapdoor$|_fence_gate$/.test(id)) color = mix(color, 0x000000, 0.4);
    look = { color, opacity: opacityOf(id), kind: kindOf(id, props) };
    cache.set(key, look);
  }
  return look;
}

/** Blocos inteiros e opacos: cercas, painéis e muros se conectam a eles. */
export function isSolidCube(look: BlockLook): boolean {
  return look.kind === 'full';
}

export function cssColor(id: string): string {
  return '#' + lookFor(id.replace(/ \(.*\)$/, '').replace(/_bucket$/, ''), {}).color.toString(16).padStart(6, '0');
}
