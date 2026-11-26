// Itens brutos: desmonta cada bloco nas receitas do jogo (crafting, fornalha, cortador de pedras)
// até chegar no que se coleta no mundo (troncos, pedregulho, areia, argila, ferro, lã…).
// Receitas do Minecraft Java 1.21. Blocos sem receita aqui contam como brutos.

export type How = 'craft' | 'smelt' | 'stonecutter' | 'other';

export interface Recipe {
  /** Quantos itens saem por receita. */
  out: number;
  in: Record<string, number>;
  how: How;
  /** Observação curta (ex.: "machado no tronco"). */
  note?: string;
}

export interface RecipeOptions {
  /** Usar o cortador de pedras para escadas, lajes e muros de pedra (1 bloco → 1 escada / 2 lajes). */
  stonecutter?: boolean;
  /** Madeira usada para gravetos e itens "de qualquer madeira". */
  stickWood?: string;
}

const WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'pale_oak', 'crimson', 'warped', 'bamboo'];
const DYES = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];

const c = (out: number, inp: Record<string, number>, note?: string): Recipe => ({ out, in: inp, how: 'craft', note });
const smelt = (from: string): Recipe => ({ out: 1, in: { [from]: 1 }, how: 'smelt' });

/** Receitas fixas (sem família). */
const FIXED: Record<string, Recipe> = {
  stick: c(4, { __planks: 2 }),
  crafting_table: c(1, { __planks: 4 }),
  chest: c(1, { __planks: 8 }),
  trapped_chest: c(1, { chest: 1, tripwire_hook: 1 }),
  tripwire_hook: c(2, { iron_ingot: 1, stick: 1, __planks: 1 }),
  barrel: c(1, { __planks: 6, __slab: 2 }),
  bookshelf: c(1, { __planks: 6, book: 3 }),
  book: c(1, { paper: 3, leather: 1 }),
  paper: c(3, { sugar_cane: 3 }),
  lectern: c(1, { __slab: 4, bookshelf: 1 }),
  composter: c(1, { __slab: 7 }),
  ladder: c(3, { stick: 7 }),
  scaffolding: c(6, { bamboo: 6, string: 1 }),
  furnace: c(1, { cobblestone: 8 }),
  smoker: c(1, { furnace: 1, __log: 4 }),
  blast_furnace: c(1, { furnace: 1, iron_ingot: 5, smooth_stone: 3 }),
  torch: c(4, { coal: 1, stick: 1 }),
  soul_torch: c(4, { coal: 1, stick: 1, soul_sand: 1 }),
  lantern: c(1, { iron_nugget: 8, torch: 1 }),
  soul_lantern: c(1, { iron_nugget: 8, soul_torch: 1 }),
  campfire: c(1, { stick: 3, coal: 1, __log: 3 }),
  iron_nugget: c(9, { iron_ingot: 1 }),
  iron_block: c(1, { iron_ingot: 9 }),
  gold_block: c(1, { gold_ingot: 9 }),
  iron_bars: c(16, { iron_ingot: 6 }),
  chain: c(1, { iron_nugget: 2, iron_ingot: 1 }),
  iron_chain: c(1, { iron_nugget: 2, iron_ingot: 1 }),
  iron_door: c(3, { iron_ingot: 6 }),
  iron_trapdoor: c(1, { iron_ingot: 4 }),
  hopper: c(1, { iron_ingot: 5, chest: 1 }),
  cauldron: c(1, { iron_ingot: 7 }),
  anvil: c(1, { iron_block: 3, iron_ingot: 4 }),
  bucket: c(1, { iron_ingot: 3 }),
  rail: c(16, { iron_ingot: 6, stick: 1 }),
  powered_rail: c(6, { gold_ingot: 6, stick: 1, redstone: 1 }),
  redstone_torch: c(1, { redstone: 1, stick: 1 }),
  redstone_lamp: c(1, { redstone: 4, glowstone: 1 }),
  repeater: c(1, { redstone_torch: 2, redstone: 1, stone: 3 }),
  comparator: c(1, { redstone_torch: 3, quartz: 1, stone: 3 }),
  lever: c(1, { stick: 1, cobblestone: 1 }),
  piston: c(1, { __planks: 3, cobblestone: 4, iron_ingot: 1, redstone: 1 }),
  sticky_piston: c(1, { piston: 1, slime_ball: 1 }),
  observer: c(1, { cobblestone: 6, redstone: 2, quartz: 1 }),
  dropper: c(1, { cobblestone: 7, redstone: 1 }),
  dispenser: c(1, { cobblestone: 7, redstone: 1, bow: 1 }),
  stone_button: c(1, { stone: 1 }),
  stone_pressure_plate: c(1, { stone: 2 }),
  note_block: c(1, { __planks: 8, redstone: 1 }),
  target: c(1, { redstone: 4, hay_block: 1 }),
  daylight_detector: c(1, { glass: 3, quartz: 3, __slab: 3 }),
  // pedra
  stone: smelt('cobblestone'),
  smooth_stone: smelt('stone'),
  stone_bricks: c(4, { stone: 4 }),
  cracked_stone_bricks: smelt('stone_bricks'),
  chiseled_stone_bricks: c(1, { stone_brick_slab: 2 }),
  mossy_cobblestone: c(1, { cobblestone: 1, vine: 1 }),
  mossy_stone_bricks: c(1, { stone_bricks: 1, vine: 1 }),
  polished_andesite: c(4, { andesite: 4 }),
  polished_diorite: c(4, { diorite: 4 }),
  polished_granite: c(4, { granite: 4 }),
  deepslate: smelt('cobbled_deepslate'),
  polished_deepslate: c(4, { cobbled_deepslate: 4 }),
  deepslate_bricks: c(4, { polished_deepslate: 4 }),
  deepslate_tiles: c(4, { deepslate_bricks: 4 }),
  polished_blackstone: c(4, { blackstone: 4 }),
  polished_blackstone_bricks: c(4, { polished_blackstone: 4 }),
  polished_tuff: c(4, { tuff: 4 }),
  tuff_bricks: c(4, { polished_tuff: 4 }),
  bricks: c(1, { brick: 4 }),
  brick: smelt('clay_ball'),
  clay: c(1, { clay_ball: 4 }),
  terracotta: smelt('clay'),
  flower_pot: c(1, { brick: 3 }),
  packed_mud: c(1, { mud: 1, wheat: 1 }),
  mud_bricks: c(4, { packed_mud: 4 }),
  nether_bricks: c(1, { nether_brick: 4 }),
  nether_brick: smelt('netherrack'),
  red_nether_bricks: c(1, { nether_brick: 2, nether_wart: 2 }),
  end_stone_bricks: c(4, { end_stone: 4 }),
  purpur_block: c(4, { popped_chorus_fruit: 4 }),
  // areia, vidro, quartzo
  sandstone: c(1, { sand: 4 }),
  smooth_sandstone: smelt('sandstone'),
  cut_sandstone: c(4, { sandstone: 4 }),
  chiseled_sandstone: c(1, { sandstone_slab: 2 }),
  red_sandstone: c(1, { red_sand: 4 }),
  smooth_red_sandstone: smelt('red_sandstone'),
  cut_red_sandstone: c(4, { red_sandstone: 4 }),
  glass: smelt('sand'),
  glass_pane: c(16, { glass: 6 }),
  tinted_glass: c(2, { glass: 1, amethyst_shard: 4 }),
  quartz_block: c(1, { quartz: 4 }),
  quartz_pillar: c(2, { quartz_block: 2 }),
  quartz_bricks: c(4, { quartz_block: 4 }),
  smooth_quartz: smelt('quartz_block'),
  glowstone: c(1, { glowstone_dust: 4 }),
  sea_lantern: c(1, { prismarine_shard: 4, prismarine_crystals: 5 }),
  prismarine: c(1, { prismarine_shard: 4 }),
  prismarine_bricks: c(1, { prismarine_shard: 9 }),
  dark_prismarine: c(1, { prismarine_shard: 8, black_dye: 1 }),
  // terra, plantas
  coarse_dirt: c(4, { dirt: 2, gravel: 2 }),
  dirt_path: { out: 1, in: { dirt: 1 }, how: 'other', note: 'pá na terra/grama' },
  farmland: { out: 1, in: { dirt: 1 }, how: 'other', note: 'enxada na terra' },
  hay_block: c(1, { wheat: 9 }),
  carved_pumpkin: { out: 1, in: { pumpkin: 1 }, how: 'other', note: 'tesoura na abóbora' },
  jack_o_lantern: c(1, { carved_pumpkin: 1, torch: 1 }),
  snow_block: c(1, { snowball: 4 }),
  packed_ice: c(1, { ice: 9 }),
  moss_carpet: c(3, { moss_block: 2 }),
  dried_kelp_block: c(1, { dried_kelp: 9 }),
  dried_kelp: smelt('kelp'),

};

/** Base de escadas/lajes/muros de pedra: o bloco de onde saem. */
function stoneBase(prefix: string): string {
  const MAP: Record<string, string> = {
    stone_brick: 'stone_bricks', mossy_stone_brick: 'mossy_stone_bricks', brick: 'bricks', nether_brick: 'nether_bricks',
    red_nether_brick: 'red_nether_bricks', quartz: 'quartz_block', purpur: 'purpur_block', deepslate_brick: 'deepslate_bricks',
    deepslate_tile: 'deepslate_tiles', polished_blackstone_brick: 'polished_blackstone_bricks', end_stone_brick: 'end_stone_bricks',
    mud_brick: 'mud_bricks', prismarine_brick: 'prismarine_bricks', tuff_brick: 'tuff_bricks', resin_brick: 'resin_bricks',
  };
  return MAP[prefix] ?? prefix;
}

/** Receita de um item (undefined = bruto, coleta no mundo). */
export function recipeFor(item: string, opts: RecipeOptions = {}): Recipe | undefined {
  const r = recipeForRaw(item, opts);
  return r && resolveGeneric(r, opts.stickWood ?? 'oak');
}

function recipeForRaw(item: string, opts: RecipeOptions): Recipe | undefined {
  if (FIXED[item]) return FIXED[item];

  // madeiras
  for (const w of WOODS) {
    if (!item.startsWith(`${w}_`)) continue;
    const rest = item.slice(w.length + 1);
    const nether = w === 'crimson' || w === 'warped';
    const log = w === 'bamboo' ? 'bamboo_block' : nether ? `${w}_stem` : `${w}_log`;
    const planks = `${w}_planks`;
    switch (rest) {
      case 'planks': return w === 'bamboo' ? c(2, { bamboo_block: 1 }) : c(4, { [log]: 1 });
      case 'block': return w === 'bamboo' ? c(1, { bamboo: 9 }) : undefined;
      case 'stairs': return c(4, { [planks]: 6 });
      case 'slab': return c(6, { [planks]: 3 });
      case 'fence': return c(3, { [planks]: 4, stick: 2 });
      case 'fence_gate': return c(1, { [planks]: 2, stick: 4 });
      case 'door': return c(3, { [planks]: 6 });
      case 'trapdoor': return c(2, { [planks]: 6 });
      case 'pressure_plate': return c(1, { [planks]: 2 });
      case 'button': return c(1, { [planks]: 1 });
      case 'sign': return c(3, { [planks]: 6, stick: 1 });
      case 'hanging_sign': return c(6, { [`stripped_${log}`]: 6, chain: 2 });
      case 'wood': case 'hyphae': return c(3, { [log]: 4 });
    }
  }
  if (item.startsWith('stripped_')) {
    const base = item.slice(9);
    if (/_(wood|hyphae)$/.test(base)) return c(3, { [`stripped_${base.replace(/_wood$/, '_log').replace(/_hyphae$/, '_stem')}`]: 4 });
    if (/_(log|stem)$/.test(base) || base === 'bamboo_block') return { out: 1, in: { [base]: 1 }, how: 'other', note: 'machado no tronco' };
  }

  // corantes / lã / concreto / vidro colorido…
  for (const d of DYES) {
    if (!item.startsWith(`${d}_`)) continue;
    const rest = item.slice(d.length + 1);
    const dye = `${d}_dye`;
    switch (rest) {
      case 'wool': return d === 'white' ? undefined : c(1, { white_wool: 1, [dye]: 1 }); // lã branca: tosquiar ovelha
      case 'carpet': return c(3, { [`${d}_wool`]: 2 });
      case 'bed': return c(1, { [`${d}_wool`]: 3, [`__planks`]: 3 });
      case 'banner': return c(1, { [`${d}_wool`]: 6, stick: 1 });
      case 'concrete': return { out: 1, in: { [`${d}_concrete_powder`]: 1 }, how: 'other', note: 'pó + água' };
      case 'concrete_powder': return c(8, { sand: 4, gravel: 4, [dye]: 1 });
      case 'terracotta': return c(8, { terracotta: 8, [dye]: 1 });
      case 'glazed_terracotta': return smelt(`${d}_terracotta`);
      case 'stained_glass': return c(8, { glass: 8, [dye]: 1 });
      case 'stained_glass_pane': return c(16, { [`${d}_stained_glass`]: 6 });
      case 'candle': return c(1, { candle: 1, [dye]: 1 });
    }
  }
  if (item.startsWith('potted_')) return c(1, { flower_pot: 1, [item.slice(7)]: 1 });

  // escadas, lajes e muros de pedra/tijolo
  for (const [suf, craft, cut] of [
    ['_stairs', { out: 4, n: 6 }, { out: 1, n: 1 }],
    ['_slab', { out: 6, n: 3 }, { out: 2, n: 1 }],
    ['_wall', { out: 6, n: 6 }, { out: 1, n: 1 }],
  ] as const) {
    if (!item.endsWith(suf)) continue;
    const base = stoneBase(item.slice(0, -suf.length));
    const r = opts.stonecutter ? cut : craft;
    return { out: r.out, in: { [base]: r.n }, how: opts.stonecutter ? 'stonecutter' : 'craft' };
  }
  return undefined;
}

/** Troca os curingas (__planks, __slab, __log) pela madeira escolhida. */
function resolveGeneric(r: Recipe, wood: string): Recipe {
  const map: Record<string, string> = { __planks: `${wood}_planks`, __slab: `${wood}_slab`, __log: wood === 'bamboo' ? 'bamboo_block' : `${wood}_log` };
  const inp: Record<string, number> = {};
  for (const [k, v] of Object.entries(r.in)) inp[map[k] ?? k] = (inp[map[k] ?? k] ?? 0) + v;
  return { ...r, in: inp };
}

export interface CraftStep {
  item: string;
  how: How;
  /** Quantas vezes fazer a receita. */
  times: number;
  /** Quantos itens saem no total (pode sobrar). */
  produced: number;
  /** Quantos eram necessários. */
  needed: number;
  in: Record<string, number>;
  note?: string;
}

export interface RawResult {
  /** item bruto → quantidade */
  raw: Map<string, number>;
  /** Passos de crafting/fornalha, na ordem de fazer (primeiro o que vem dos brutos). */
  steps: CraftStep[];
  smelts: number;
  /** Carvão para a fornalha (1 carvão = 8 itens). */
  fuelCoal: number;
}

/**
 * Desmonta a lista (item → quantidade) até os brutos, arredondando por receita
 * (ex.: 10 escadas = 3 receitas = 18 tábuas = 5 troncos).
 */
export function rawMaterials(needs: Map<string, number>, opts: RecipeOptions = {}): RawResult {
  // ordem: produto antes dos ingredientes (pós-ordem invertida)
  const post: string[] = [];
  const seen = new Set<string>();
  const visit = (item: string, depth = 0) => {
    if (seen.has(item) || depth > 20) return;
    seen.add(item);
    const r = recipeFor(item, opts);
    if (r) for (const ing of Object.keys(r.in)) visit(ing, depth + 1);
    post.push(item);
  };
  for (const item of needs.keys()) visit(item);
  const order = post.reverse();

  const demand = new Map(needs);
  const raw = new Map<string, number>();
  const steps: CraftStep[] = [];
  let smelts = 0;
  for (const item of order) {
    const need = demand.get(item) ?? 0;
    if (need <= 0) continue;
    const r = recipeFor(item, opts);
    if (!r) {
      raw.set(item, (raw.get(item) ?? 0) + need);
      continue;
    }
    const times = Math.ceil(need / r.out);
    for (const [ing, q] of Object.entries(r.in)) demand.set(ing, (demand.get(ing) ?? 0) + times * q);
    if (r.how === 'smelt') smelts += times;
    steps.push({ item, how: r.how, times, produced: times * r.out, needed: need, in: Object.fromEntries(Object.entries(r.in).map(([k, v]) => [k, v * times])), note: r.note });
  }
  const fuelCoal = Math.ceil(smelts / 8);
  return { raw, steps: steps.reverse(), smelts, fuelCoal };
}

/** Madeira mais usada na lista (para gravetos, baús etc.). */
export function dominantWood(items: Iterable<string>): string {
  const count = new Map<string, number>();
  for (const it of items) for (const w of WOODS) if (it.startsWith(`${w}_`) || it.startsWith(`stripped_${w}_`)) count.set(w, (count.get(w) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'oak';
}
