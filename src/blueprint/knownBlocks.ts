// Lista de blocos vanilla do Minecraft Java (1.21) para conferir os IDs que a IA escreve.
// Não precisa ser perfeita: um ID fora daqui gera só um aviso, não um erro.

export const WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'pale_oak'] as const;
export const NETHER_WOODS = ['crimson', 'warped'] as const;
export const DYES = [
  'white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray',
  'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black',
] as const;

const WOOD_SET = ['planks', 'stairs', 'slab', 'fence', 'fence_gate', 'door', 'trapdoor', 'pressure_plate', 'button', 'sign', 'wall_sign', 'hanging_sign', 'wall_hanging_sign'];
const TREE_SET = ['log', 'wood', 'leaves', 'sapling'];
const DYE_SET = ['wool', 'carpet', 'concrete', 'concrete_powder', 'terracotta', 'glazed_terracotta', 'stained_glass', 'stained_glass_pane', 'bed', 'banner', 'wall_banner', 'candle', 'candle_cake', 'shulker_box'];

/** Blocos de pedra/tijolo que têm escada, laje e muro. Formato: [bloco, base das variações] */
const STONE_FAMILIES: [string, string][] = [
  ['stone', 'stone'], ['cobblestone', 'cobblestone'], ['mossy_cobblestone', 'mossy_cobblestone'],
  ['stone_bricks', 'stone_brick'], ['mossy_stone_bricks', 'mossy_stone_brick'], ['smooth_stone', 'smooth_stone'],
  ['granite', 'granite'], ['polished_granite', 'polished_granite'], ['diorite', 'diorite'], ['polished_diorite', 'polished_diorite'],
  ['andesite', 'andesite'], ['polished_andesite', 'polished_andesite'],
  ['sandstone', 'sandstone'], ['smooth_sandstone', 'smooth_sandstone'], ['cut_sandstone', 'cut_sandstone'],
  ['red_sandstone', 'red_sandstone'], ['smooth_red_sandstone', 'smooth_red_sandstone'], ['cut_red_sandstone', 'cut_red_sandstone'],
  ['bricks', 'brick'], ['mud_bricks', 'mud_brick'], ['nether_bricks', 'nether_brick'], ['red_nether_bricks', 'red_nether_brick'],
  ['quartz_block', 'quartz'], ['smooth_quartz', 'smooth_quartz'], ['purpur_block', 'purpur'],
  ['prismarine', 'prismarine'], ['prismarine_bricks', 'prismarine_brick'], ['dark_prismarine', 'dark_prismarine'],
  ['blackstone', 'blackstone'], ['polished_blackstone', 'polished_blackstone'], ['polished_blackstone_bricks', 'polished_blackstone_brick'],
  ['cobbled_deepslate', 'cobbled_deepslate'], ['polished_deepslate', 'polished_deepslate'],
  ['deepslate_bricks', 'deepslate_brick'], ['deepslate_tiles', 'deepslate_tile'],
  ['end_stone_bricks', 'end_stone_brick'], ['tuff', 'tuff'], ['polished_tuff', 'polished_tuff'], ['tuff_bricks', 'tuff_brick'],
  ['resin_bricks', 'resin_brick'],
  ['cut_copper', 'cut_copper'], ['exposed_cut_copper', 'exposed_cut_copper'], ['weathered_cut_copper', 'weathered_cut_copper'],
  ['oxidized_cut_copper', 'oxidized_cut_copper'], ['waxed_cut_copper', 'waxed_cut_copper'],
];

const FLOWERS = [
  'dandelion', 'poppy', 'blue_orchid', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip',
  'oxeye_daisy', 'cornflower', 'lily_of_the_valley', 'wither_rose', 'torchflower', 'open_eyeblossom', 'closed_eyeblossom',
];

const SINGLES = `
air cave_air void_air water lava bedrock barrier light
stone deepslate calcite dripstone_block pointed_dripstone basalt polished_basalt smooth_basalt
dirt coarse_dirt rooted_dirt grass_block podzol mycelium mud packed_mud muddy_mangrove_roots farmland dirt_path clay
sand red_sand suspicious_sand gravel suspicious_gravel chiseled_sandstone chiseled_red_sandstone
chiseled_stone_bricks cracked_stone_bricks infested_stone chiseled_deepslate cracked_deepslate_bricks cracked_deepslate_tiles
chiseled_polished_blackstone cracked_polished_blackstone_bricks gilded_blackstone chiseled_tuff chiseled_tuff_bricks
chiseled_nether_bricks cracked_nether_bricks quartz_bricks quartz_pillar chiseled_quartz_block purpur_pillar
end_stone obsidian crying_obsidian netherrack soul_sand soul_soil magma_block glowstone shroomlight
nether_wart_block warped_wart_block crimson_nylium warped_nylium crimson_fungus warped_fungus crimson_roots warped_roots
nether_sprouts weeping_vines twisting_vines nether_wart
coal_ore iron_ore copper_ore gold_ore redstone_ore emerald_ore lapis_ore diamond_ore
deepslate_coal_ore deepslate_iron_ore deepslate_copper_ore deepslate_gold_ore deepslate_redstone_ore
deepslate_emerald_ore deepslate_lapis_ore deepslate_diamond_ore nether_gold_ore nether_quartz_ore ancient_debris
coal_block iron_block copper_block gold_block redstone_block emerald_block lapis_block diamond_block netherite_block
raw_iron_block raw_copper_block raw_gold_block amethyst_block budding_amethyst amethyst_cluster
exposed_copper weathered_copper oxidized_copper waxed_copper_block chiseled_copper copper_grate copper_bulb copper_door copper_trapdoor
glass tinted_glass glass_pane iron_bars chain iron_chain
ice packed_ice blue_ice snow snow_block powder_snow
bamboo_block stripped_bamboo_block bamboo_mosaic bamboo_mosaic_stairs bamboo_mosaic_slab
bamboo_planks bamboo_stairs bamboo_slab bamboo_fence bamboo_fence_gate bamboo_door bamboo_trapdoor bamboo_pressure_plate bamboo_button
bamboo_sign bamboo_wall_sign bamboo_hanging_sign bamboo_wall_hanging_sign bamboo
mangrove_roots mangrove_propagule azalea flowering_azalea azalea_leaves flowering_azalea_leaves
moss_block moss_carpet pale_moss_block pale_moss_carpet pale_hanging_moss
short_grass tall_grass fern large_fern dead_bush seagrass tall_seagrass kelp kelp_plant sea_pickle lily_pad vine glow_lichen
sunflower lilac rose_bush peony pitcher_plant pink_petals spore_blossom hanging_roots big_dripleaf small_dripleaf
sugar_cane cactus pumpkin carved_pumpkin jack_o_lantern melon hay_block dried_kelp_block
wheat carrots potatoes beetroots melon_stem pumpkin_stem sweet_berry_bush cocoa
brown_mushroom red_mushroom brown_mushroom_block red_mushroom_block mushroom_stem
crafting_table furnace blast_furnace smoker cartography_table fletching_table smithing_table stonecutter loom grindstone
chest trapped_chest ender_chest barrel hopper dropper dispenser observer
piston sticky_piston redstone_wire redstone_torch redstone_wall_torch repeater comparator lever
redstone_lamp daylight_detector target tripwire tripwire_hook note_block jukebox
stone_pressure_plate polished_blackstone_pressure_plate light_weighted_pressure_plate heavy_weighted_pressure_plate
stone_button polished_blackstone_button
rail powered_rail detector_rail activator_rail
torch wall_torch soul_torch soul_wall_torch lantern soul_lantern campfire soul_campfire candle sea_lantern end_rod lightning_rod
bookshelf chiseled_bookshelf lectern enchanting_table anvil chipped_anvil damaged_anvil brewing_stand cauldron
water_cauldron lava_cauldron composter beehive bee_nest bell beacon conduit respawn_anchor lodestone
ladder scaffolding cobweb slime_block honey_block sponge wet_sponge tnt
iron_door iron_trapdoor flower_pot decorated_pot armor_stand
spawner trial_spawner vault crafter heavy_core
white_bed skeleton_skull wither_skeleton_skull zombie_head player_head creeper_head dragon_head piglin_head
sculk sculk_vein sculk_catalyst sculk_shrieker sculk_sensor calibrated_sculk_sensor reinforced_deepslate
frogspawn ochre_froglight verdant_froglight pearlescent_froglight
tube_coral_block brain_coral_block bubble_coral_block fire_coral_block horn_coral_block
tube_coral brain_coral bubble_coral fire_coral horn_coral
cake shulker_box end_portal_frame end_portal end_gateway nether_portal fire soul_fire dragon_egg
creaking_heart resin_block resin_clump chiseled_resin_bricks
`;

function build(): Set<string> {
  const s = new Set<string>(SINGLES.split(/\s+/).filter(Boolean));
  for (const w of WOODS) {
    for (const t of [...WOOD_SET, ...TREE_SET]) s.add(`${w}_${t}`);
    s.add(`stripped_${w}_log`);
    s.add(`stripped_${w}_wood`);
    s.add(`potted_${w}_sapling`);
  }
  for (const w of NETHER_WOODS) {
    for (const t of WOOD_SET) s.add(`${w}_${t}`);
    for (const t of ['stem', 'hyphae']) {
      s.add(`${w}_${t}`);
      s.add(`stripped_${w}_${t}`);
    }
  }
  for (const d of DYES) for (const t of DYE_SET) s.add(`${d}_${t}`);
  for (const [block, base] of STONE_FAMILIES) {
    s.add(block);
    s.add(`${base}_stairs`);
    s.add(`${base}_slab`);
    s.add(`${base}_wall`);
  }
  for (const f of FLOWERS) {
    s.add(f);
    s.add(`potted_${f}`);
  }
  return s;
}

export const KNOWN_BLOCKS = build();

/**
 * Nomes que a IA (ou gente) costuma escrever errado → ID correto.
 * Só entra aqui o que é inequívoco.
 */
export const BLOCK_ALIASES: Record<string, string> = {
  planks: 'oak_planks', wood_planks: 'oak_planks', wooden_planks: 'oak_planks', oak_plank: 'oak_planks',
  log: 'oak_log', wooden_log: 'oak_log',
  grass: 'grass_block', dirt_grass: 'grass_block',
  cobble: 'cobblestone', mossy_cobble: 'mossy_cobblestone',
  stone_brick: 'stone_bricks', stonebrick: 'stone_bricks', mossy_stone_brick: 'mossy_stone_bricks',
  brick: 'bricks', brick_block: 'bricks', nether_brick: 'nether_bricks', red_nether_brick: 'red_nether_bricks',
  glass_panes: 'glass_pane', thin_glass: 'glass_pane', window: 'glass_pane',
  door: 'oak_door', wooden_door: 'oak_door', fence: 'oak_fence', wooden_fence: 'oak_fence', fence_gate: 'oak_fence_gate',
  trapdoor: 'oak_trapdoor', wooden_trapdoor: 'oak_trapdoor', stairs: 'oak_stairs', wooden_stairs: 'oak_stairs',
  wooden_slab: 'oak_slab', sign: 'oak_sign', wall_sign: 'oak_wall_sign', leaves: 'oak_leaves', sapling: 'oak_sapling',
  button: 'oak_button', wooden_button: 'oak_button', pressure_plate: 'oak_pressure_plate', wooden_pressure_plate: 'oak_pressure_plate',
  wool: 'white_wool', carpet: 'white_carpet', concrete: 'white_concrete', concrete_powder: 'white_concrete_powder',
  stained_glass: 'white_stained_glass', stained_glass_pane: 'white_stained_glass_pane', bed: 'red_bed', banner: 'white_banner',
  hardened_clay: 'terracotta', stained_clay: 'terracotta',
  workbench: 'crafting_table', crafting_bench: 'crafting_table', work_bench: 'crafting_table',
  water_source: 'water', still_water: 'water', flowing_water: 'water', water_block: 'water',
  lava_source: 'lava', still_lava: 'lava', flowing_lava: 'lava',
  redstone: 'redstone_wire', redstone_dust: 'redstone_wire',
  redstone_repeater: 'repeater', redstone_comparator: 'comparator', piston_block: 'piston',
  sugarcane: 'sugar_cane', reeds: 'sugar_cane', melon_block: 'melon', lit_pumpkin: 'jack_o_lantern',
  snow_layer: 'snow', web: 'cobweb', path: 'dirt_path', grass_path: 'dirt_path',
  quartz: 'quartz_block', purpur: 'purpur_block', golden_block: 'gold_block', iron: 'iron_block',
  lamp: 'redstone_lamp', glow_stone: 'glowstone', sealantern: 'sea_lantern', hay: 'hay_block', hay_bale: 'hay_block',
  book_shelf: 'bookshelf', bookshelves: 'bookshelf', enchantment_table: 'enchanting_table',
  noteblock: 'note_block', torches: 'torch', lanterns: 'lantern', ladders: 'ladder',
  slime: 'slime_block', honey: 'honey_block', end_stone_brick: 'end_stone_bricks', prismarine_brick: 'prismarine_bricks',
  deepslate_brick: 'deepslate_bricks', deepslate_tile: 'deepslate_tiles', mud_brick: 'mud_bricks', tuff_brick: 'tuff_bricks',
  polished_blackstone_brick: 'polished_blackstone_bricks', smooth_stone_block: 'smooth_stone',
};

/** Distância de edição (quantas letras trocar para virar a outra palavra). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Sugere o ID conhecido mais parecido. Devolve undefined se nada estiver perto. */
export function suggestBlock(id: string): { id: string; distance: number; unique: boolean } | undefined {
  let best: string | undefined;
  let bestD = Infinity;
  let ties = 0;
  for (const k of KNOWN_BLOCKS) {
    if (Math.abs(k.length - id.length) > 3) continue;
    const d = levenshtein(id, k);
    if (d < bestD) {
      bestD = d;
      best = k;
      ties = 0;
    } else if (d === bestD) ties++;
  }
  if (!best || bestD > 3) return undefined;
  return { id: best, distance: bestD, unique: ties === 0 };
}
