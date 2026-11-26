// Nomes dos blocos em português (como aparecem no jogo em pt-BR, ou bem perto disso).
// Quando não conhecemos o bloco, mostramos o ID "humanizado".

const EXACT: Record<string, string> = {
  air: 'Ar', water: 'Água', lava: 'Lava', bedrock: 'Rocha-matriz', nether_portal: 'Portal do Nether', fire: 'Fogo',
  stone: 'Pedra', cobblestone: 'Pedregulho', mossy_cobblestone: 'Pedregulho musgoso', smooth_stone: 'Pedra lisa',
  stone_bricks: 'Tijolos de pedra', mossy_stone_bricks: 'Tijolos de pedra musgosos', cracked_stone_bricks: 'Tijolos de pedra rachados',
  chiseled_stone_bricks: 'Tijolos de pedra talhados', granite: 'Granito', polished_granite: 'Granito polido',
  diorite: 'Diorito', polished_diorite: 'Diorito polido', andesite: 'Andesito', polished_andesite: 'Andesito polido',
  deepslate: 'Ardósia', cobbled_deepslate: 'Pedregulho de ardósia', polished_deepslate: 'Ardósia polida',
  deepslate_bricks: 'Tijolos de ardósia', deepslate_tiles: 'Ladrilhos de ardósia', tuff: 'Tufo', calcite: 'Calcita',
  dirt: 'Terra', coarse_dirt: 'Terra grossa', grass_block: 'Bloco de grama', podzol: 'Podzol', mud: 'Lama',
  mud_bricks: 'Tijolos de barro', farmland: 'Terra arada', dirt_path: 'Caminho de terra', clay: 'Argila',
  sand: 'Areia', red_sand: 'Areia vermelha', gravel: 'Cascalho', sandstone: 'Arenito', smooth_sandstone: 'Arenito liso',
  cut_sandstone: 'Arenito cortado', chiseled_sandstone: 'Arenito talhado', red_sandstone: 'Arenito vermelho',
  bricks: 'Tijolos', terracotta: 'Terracota', obsidian: 'Obsidiana', crying_obsidian: 'Obsidiana chorona',
  netherrack: 'Netherrack', nether_bricks: 'Tijolos do Nether', red_nether_bricks: 'Tijolos vermelhos do Nether',
  soul_sand: 'Areia das almas', soul_soil: 'Solo das almas', magma_block: 'Bloco de magma', basalt: 'Basalto',
  blackstone: 'Pedra-negra', polished_blackstone: 'Pedra-negra polida', polished_blackstone_bricks: 'Tijolos de pedra-negra polida',
  end_stone: 'Pedra do End', end_stone_bricks: 'Tijolos de pedra do End', purpur_block: 'Bloco de púrpura', purpur_pillar: 'Pilar de púrpura',
  quartz_block: 'Bloco de quartzo', smooth_quartz: 'Bloco de quartzo liso', quartz_bricks: 'Tijolos de quartzo', quartz_pillar: 'Pilar de quartzo',
  prismarine: 'Prismarinho', prismarine_bricks: 'Tijolos de prismarinho', dark_prismarine: 'Prismarinho escuro',
  glass: 'Vidro', glass_pane: 'Painel de vidro', tinted_glass: 'Vidro fumê', iron_bars: 'Barras de ferro',
  chain: 'Corrente', iron_chain: 'Corrente de ferro', ice: 'Gelo', packed_ice: 'Gelo compactado', blue_ice: 'Gelo azul',
  snow: 'Neve', snow_block: 'Bloco de neve',
  coal_block: 'Bloco de carvão', iron_block: 'Bloco de ferro', gold_block: 'Bloco de ouro', diamond_block: 'Bloco de diamante',
  emerald_block: 'Bloco de esmeralda', lapis_block: 'Bloco de lápis-lazúli', redstone_block: 'Bloco de redstone',
  netherite_block: 'Bloco de netherita', copper_block: 'Bloco de cobre', amethyst_block: 'Bloco de ametista',
  crafting_table: 'Bancada de trabalho', furnace: 'Fornalha', blast_furnace: 'Alto-forno', smoker: 'Defumador',
  chest: 'Baú', trapped_chest: 'Baú com armadilha', ender_chest: 'Baú do End', barrel: 'Barril',
  hopper: 'Funil', dropper: 'Liberador', dispenser: 'Ejetor', observer: 'Observador',
  piston: 'Pistão', sticky_piston: 'Pistão aderente', redstone_wire: 'Redstone (pó)', redstone_torch: 'Tocha de redstone',
  redstone_wall_torch: 'Tocha de redstone (na parede)', repeater: 'Repetidor de redstone', comparator: 'Comparador de redstone',
  lever: 'Alavanca', redstone_lamp: 'Lâmpada de redstone', daylight_detector: 'Sensor de luz solar', target: 'Alvo',
  note_block: 'Bloco musical', tripwire_hook: 'Gancho de armadilha', tnt: 'Dinamite', slime_block: 'Bloco de slime', honey_block: 'Bloco de mel',
  rail: 'Trilho', powered_rail: 'Trilho energizado', detector_rail: 'Trilho detector', activator_rail: 'Trilho ativador',
  stone_pressure_plate: 'Placa de pressão de pedra', stone_button: 'Botão de pedra',
  torch: 'Tocha', wall_torch: 'Tocha (na parede)', soul_torch: 'Tocha das almas', lantern: 'Lanterna', soul_lantern: 'Lanterna das almas',
  campfire: 'Fogueira', soul_campfire: 'Fogueira das almas', glowstone: 'Pedra luminosa', sea_lantern: 'Lanterna do mar',
  shroomlight: 'Cogumelo luminoso', jack_o_lantern: 'Abóbora de Halloween', end_rod: 'Barra do End', candle: 'Vela',
  bookshelf: 'Estante de livros', chiseled_bookshelf: 'Estante talhada', lectern: 'Atril', enchanting_table: 'Mesa de encantamentos',
  anvil: 'Bigorna', brewing_stand: 'Suporte de poções', cauldron: 'Caldeirão', composter: 'Composteira',
  beehive: 'Colmeia', bell: 'Sino', beacon: 'Sinalizador', ladder: 'Escada de mão', scaffolding: 'Andaime', cobweb: 'Teia',
  iron_door: 'Porta de ferro', iron_trapdoor: 'Alçapão de ferro', flower_pot: 'Vaso de flor',
  cartography_table: 'Mesa de cartografia', fletching_table: 'Mesa de arco e flecha', smithing_table: 'Mesa de ferraria',
  stonecutter: 'Cortador de pedras', loom: 'Tear', grindstone: 'Rebolo', jukebox: 'Toca-discos', spawner: 'Gerador de monstros',
  hay_block: 'Fardo de feno', pumpkin: 'Abóbora', carved_pumpkin: 'Abóbora esculpida', melon: 'Melancia',
  sugar_cane: 'Cana-de-açúcar', cactus: 'Cacto', bamboo: 'Bambu', kelp: 'Alga', wheat: 'Trigo', carrots: 'Cenouras',
  potatoes: 'Batatas', beetroots: 'Beterrabas', sweet_berry_bush: 'Arbusto de bagas doces', nether_wart: 'Fungo do Nether',
  short_grass: 'Grama', tall_grass: 'Grama alta', fern: 'Samambaia', vine: 'Trepadeira', lily_pad: 'Vitória-régia',
  moss_block: 'Bloco de musgo', moss_carpet: 'Tapete de musgo', dandelion: 'Dente-de-leão', poppy: 'Papoula',
  sunflower: 'Girassol', rose_bush: 'Roseira', lilac: 'Lilás', peony: 'Peônia', azalea: 'Azaleia',
  brown_mushroom: 'Cogumelo marrom', red_mushroom: 'Cogumelo vermelho', dried_kelp_block: 'Bloco de alga seca',
  sponge: 'Esponja', bamboo_block: 'Bloco de bambu', bamboo_mosaic: 'Mosaico de bambu',
};

const WOOD: Record<string, string> = {
  oak: 'carvalho', spruce: 'pinheiro', birch: 'bétula', jungle: 'selva', acacia: 'acácia', dark_oak: 'carvalho-escuro',
  mangrove: 'mangue', cherry: 'cerejeira', pale_oak: 'carvalho-pálido', bamboo: 'bambu', crimson: 'carmesim', warped: 'distorcido',
};

const WOOD_PARTS: [string, string][] = [
  ['stripped_*_log', 'Tronco descascado de *'], ['stripped_*_wood', 'Madeira descascada de *'],
  ['stripped_*_stem', 'Caule descascado de *'], ['stripped_*_hyphae', 'Hifas descascadas de *'],
  ['potted_*_sapling', 'Muda de * no vaso'],
  ['*_planks', 'Tábuas de *'], ['*_log', 'Tronco de *'], ['*_wood', 'Madeira de *'], ['*_stem', 'Caule de *'], ['*_hyphae', 'Hifas de *'],
  ['*_leaves', 'Folhas de *'], ['*_sapling', 'Muda de *'], ['*_stairs', 'Escadas de *'], ['*_slab', 'Laje de *'],
  ['*_fence_gate', 'Portão de *'], ['*_fence', 'Cerca de *'], ['*_door', 'Porta de *'], ['*_trapdoor', 'Alçapão de *'],
  ['*_pressure_plate', 'Placa de pressão de *'], ['*_button', 'Botão de *'],
  ['*_wall_hanging_sign', 'Placa suspensa de * (parede)'], ['*_hanging_sign', 'Placa suspensa de *'],
  ['*_wall_sign', 'Placa de * (na parede)'], ['*_sign', 'Placa de *'],
];

/** [masculino, feminino] */
const DYE: Record<string, [string, string]> = {
  white: ['branco', 'branca'], orange: ['laranja', 'laranja'], magenta: ['magenta', 'magenta'],
  light_blue: ['azul-claro', 'azul-clara'], yellow: ['amarelo', 'amarela'], lime: ['verde-limão', 'verde-limão'],
  pink: ['rosa', 'rosa'], gray: ['cinza', 'cinza'], light_gray: ['cinza-claro', 'cinza-clara'], cyan: ['ciano', 'ciano'],
  purple: ['roxo', 'roxa'], blue: ['azul', 'azul'], brown: ['marrom', 'marrom'], green: ['verde', 'verde'],
  red: ['vermelho', 'vermelha'], black: ['preto', 'preta'],
};

/** sufixo → [nome, gênero 0=m 1=f] */
const DYE_PARTS: [string, string, 0 | 1][] = [
  ['stained_glass_pane', 'Painel de vidro tingido', 0], ['stained_glass', 'Vidro tingido', 0],
  ['glazed_terracotta', 'Terracota esmaltada', 1], ['terracotta', 'Terracota', 1],
  ['concrete_powder', 'Concreto em pó', 0], ['concrete', 'Concreto', 0], ['wool', 'Lã', 1], ['carpet', 'Tapete', 0],
  ['wall_banner', 'Estandarte (na parede)', 0], ['banner', 'Estandarte', 0], ['candle_cake', 'Bolo com vela', 0],
  ['candle', 'Vela', 1], ['bed', 'Cama', 1], ['shulker_box', 'Caixa de shulker', 1],
];

const SHAPE_SUFFIX: [string, string][] = [
  ['_stairs', 'Escadas de'], ['_slab', 'Laje de'], ['_wall', 'Muro de'],
];

function lowerFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function humanize(id: string) {
  const s = id.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const cache = new Map<string, string>();

/** Nome em português do bloco (só o ID, sem estados). */
export function blockName(id: string): string {
  const hit = cache.get(id);
  if (hit) return hit;
  const name = compute(id);
  cache.set(id, name);
  return name;
}

function compute(id: string): string {
  if (EXACT[id]) return EXACT[id];

  for (const [dye, [m, f]] of Object.entries(DYE)) {
    if (!id.startsWith(dye + '_')) continue;
    const rest = id.slice(dye.length + 1);
    // "light_blue" começa com "light_"... garantir que não pegamos "light_gray" como "light"
    const part = DYE_PARTS.find(([suf]) => rest === suf);
    if (part) return `${part[1]} ${part[2] ? f : m}`;
  }

  // ordena madeiras maiores primeiro (dark_oak antes de oak)
  const woods = Object.keys(WOOD).sort((a, b) => b.length - a.length);
  for (const [pattern, label] of WOOD_PARTS) {
    for (const w of woods) {
      if (id === pattern.replace('*', w)) return label.replace('*', WOOD[w]);
    }
  }

  for (const [suf, label] of SHAPE_SUFFIX) {
    if (id.endsWith(suf)) {
      const base = id.slice(0, -suf.length);
      for (const cand of [base, base + 's', base + '_block']) {
        if (EXACT[cand]) return `${label} ${lowerFirst(EXACT[cand])}`;
      }
      return `${label} ${lowerFirst(humanize(base))}`;
    }
  }

  if (id.startsWith('potted_')) return `${blockName(id.slice(7))} no vaso`;
  if (id.endsWith('_ore')) {
    const deep = id.startsWith('deepslate_');
    const mineral = id.replace(/^deepslate_|^nether_/, '').replace(/_ore$/, '');
    const MIN: Record<string, string> = { coal: 'carvão', iron: 'ferro', copper: 'cobre', gold: 'ouro', redstone: 'redstone', emerald: 'esmeralda', lapis: 'lápis-lazúli', diamond: 'diamante', quartz: 'quartzo' };
    return `Minério de ${MIN[mineral] ?? mineral}${deep ? ' de ardósia' : ''}`;
  }
  return humanize(id);
}

/** Nome do item na lista de materiais (aceita "water_bucket (fonte)", etc.). */
export function itemName(item: string): string {
  if (item.startsWith('water_bucket')) return 'Balde de água (fonte)';
  if (item.startsWith('lava_bucket')) return 'Balde de lava (fonte)';
  if (item === 'redstone') return 'Redstone (pó)';
  if (item === 'string') return 'Linha';
  const ITEMS: Record<string, string> = {
    carrot: 'Cenoura', potato: 'Batata', wheat_seeds: 'Sementes de trigo', beetroot_seeds: 'Sementes de beterraba',
    stick: 'Graveto', coal: 'Carvão', iron_ingot: 'Barra de ferro', gold_ingot: 'Barra de ouro', iron_nugget: 'Pepita de ferro',
    clay_ball: 'Bola de argila', brick: 'Tijolo (item)', nether_brick: 'Tijolo do Nether (item)', paper: 'Papel', book: 'Livro',
    leather: 'Couro', quartz: 'Quartzo do Nether', glowstone_dust: 'Pó de pedra luminosa', prismarine_shard: 'Fragmento de prismarinho',
    prismarine_crystals: 'Cristais de prismarinho', slime_ball: 'Bola de slime', bow: 'Arco', amethyst_shard: 'Fragmento de ametista',
    snowball: 'Bola de neve', dried_kelp: 'Alga seca', popped_chorus_fruit: 'Fruta do coro estourada', bucket: 'Balde',
  };
  if (ITEMS[item]) return ITEMS[item];
  if (item.endsWith('_dye')) {
    const DYE_M: Record<string, string> = {
      white: 'branco', orange: 'laranja', magenta: 'magenta', light_blue: 'azul-claro', yellow: 'amarelo', lime: 'verde-limão',
      pink: 'rosa', gray: 'cinza', light_gray: 'cinza-claro', cyan: 'ciano', purple: 'roxo', blue: 'azul', brown: 'marrom',
      green: 'verde', red: 'vermelho', black: 'preto',
    };
    const color = item.slice(0, -4);
    if (DYE_M[color]) return `Corante ${DYE_M[color]}`;
  }
  return blockName(item);
}

const DIR: Record<string, string> = { north: 'norte', south: 'sul', east: 'leste', west: 'oeste', up: 'cima', down: 'baixo' };

/** Traduz os estados do bloco ("facing=north" → "virado para o norte"). */
export function describeProps(props: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(props)) {
    switch (k) {
      case 'facing':
        out.push(`virado para ${DIR[v] ? (v === 'up' || v === 'down' ? DIR[v] : `o ${DIR[v]}`) : v}`);
        break;
      case 'half':
        out.push(v === 'upper' ? 'parte de cima' : v === 'lower' ? 'parte de baixo' : v === 'top' ? 'encaixado em cima' : v === 'bottom' ? 'encaixado embaixo' : `half=${v}`);
        break;
      case 'type':
        out.push(v === 'top' ? 'laje de cima' : v === 'bottom' ? 'laje de baixo' : v === 'double' ? 'laje dupla' : `tipo ${v}`);
        break;
      case 'part':
        out.push(v === 'head' ? 'cabeceira' : v === 'foot' ? 'pé' : `parte ${v}`);
        break;
      case 'axis':
        out.push(v === 'y' ? 'em pé' : v === 'x' ? 'deitado (leste-oeste)' : v === 'z' ? 'deitado (norte-sul)' : `eixo ${v}`);
        break;
      case 'hanging':
        if (v === 'true') out.push('pendurado');
        break;
      case 'open':
        out.push(v === 'true' ? 'aberto' : 'fechado');
        break;
      case 'hinge':
        out.push(`dobradiça à ${v === 'left' ? 'esquerda' : 'direita'}`);
        break;
      case 'waterlogged':
        if (v === 'true') out.push('com água');
        break;
      case 'lit':
        out.push(v === 'true' ? 'aceso' : 'apagado');
        break;
      case 'powered':
        if (v === 'true') out.push('energizado');
        break;
      case 'delay':
        out.push(`atraso ${v}`);
        break;
      case 'mode':
        out.push(v === 'subtract' ? 'modo subtração' : 'modo comparação');
        break;
      case 'layers':
        out.push(`${v} camada(s)`);
        break;
      case 'age':
        out.push(`idade ${v}`);
        break;
      default:
        out.push(`${k}: ${v}`);
    }
  }
  return out;
}
