// Exporta para o Minecraft BEDROCK: arquivo .mcstructure (o mesmo que o Bloco de Estrutura exporta).
// Serve para o HoloPrint/Structura (holograma com suporte de armadura, funciona no Realms) e para
// carregar com Bloco de Estrutura ou /structure.
//
// Formato: NBT little-endian. Os nomes e estados dos blocos do Java são convertidos para os do Bedrock
// nos casos comuns; o que não dá para converter com segurança fica com o estado padrão (o bloco aparece,
// talvez virado para outro lado).

import type { CompiledModel, Voxel } from '../blueprint/compile';

// ---------- NBT little-endian ----------
type Tag =
  | { t: 'byte'; v: number }
  | { t: 'int'; v: number }
  | { t: 'string'; v: string }
  | { t: 'list'; of: number; v: Tag[] }
  | { t: 'compound'; v: Record<string, Tag> };

const TYPE = { byte: 1, int: 3, string: 8, list: 9, compound: 10 } as const;

class Writer {
  private buf = new Uint8Array(1 << 16);
  private len = 0;
  private ensure(n: number) {
    if (this.len + n <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.len + n) size *= 2;
    const b = new Uint8Array(size);
    b.set(this.buf.subarray(0, this.len));
    this.buf = b;
  }
  u8(v: number) { this.ensure(1); this.buf[this.len++] = v & 0xff; }
  i16(v: number) { this.ensure(2); new DataView(this.buf.buffer).setInt16(this.len, v, true); this.len += 2; }
  i32(v: number) { this.ensure(4); new DataView(this.buf.buffer).setInt32(this.len, v, true); this.len += 4; }
  str(s: string) { const b = new TextEncoder().encode(s); this.i16(b.length); this.ensure(b.length); this.buf.set(b, this.len); this.len += b.length; }
  bytes() { return this.buf.slice(0, this.len); }
}

function writePayload(w: Writer, tag: Tag) {
  switch (tag.t) {
    case 'byte': return w.u8(tag.v);
    case 'int': return w.i32(tag.v);
    case 'string': return w.str(tag.v);
    case 'list':
      w.u8(tag.v.length ? TYPE[tag.v[0].t] : tag.of);
      w.i32(tag.v.length);
      for (const item of tag.v) writePayload(w, item);
      return;
    case 'compound':
      for (const [name, child] of Object.entries(tag.v)) {
        w.u8(TYPE[child.t]);
        w.str(name);
        writePayload(w, child);
      }
      w.u8(0);
  }
}

export function writeNbt(root: Record<string, Tag>): Uint8Array {
  const w = new Writer();
  w.u8(TYPE.compound);
  w.str('');
  writePayload(w, { t: 'compound', v: root });
  return w.bytes();
}

const int = (v: number): Tag => ({ t: 'int', v });
const str = (v: string): Tag => ({ t: 'string', v });
const compound = (v: Record<string, Tag>): Tag => ({ t: 'compound', v });
const list = (of: number, v: Tag[]): Tag => ({ t: 'list', of, v });

// ---------- Java → Bedrock ----------
/** Nomes que mudam no Bedrock. */
const RENAME: Record<string, string> = {
  terracotta: 'hardened_clay',
  dirt_path: 'grass_path',
  snow_block: 'snow',
  snow: 'snow_layer',
  magma_block: 'magma',
  nether_bricks: 'nether_brick',
  red_nether_bricks: 'red_nether_brick',
  end_stone_bricks: 'end_bricks',
  jack_o_lantern: 'lit_pumpkin',
  cobweb: 'web',
  melon: 'melon_block',
  sugar_cane: 'reeds',
  bricks: 'brick_block',
  spawner: 'mob_spawner',
  note_block: 'noteblock',
  powered_rail: 'golden_rail',
  slime_block: 'slime',
  dead_bush: 'deadbush',
  lily_pad: 'waterlily',
  nether_quartz_ore: 'quartz_ore',
  wall_torch: 'torch',
  soul_wall_torch: 'soul_torch',
  redstone_wall_torch: 'redstone_torch',
  light: 'light_block',
  stone_stairs: 'normal_stone_stairs',
  cobblestone_stairs: 'stone_stairs',
  stone_slab: 'normal_stone_slab',
  end_stone_brick_stairs: 'end_brick_stairs',
  end_stone_brick_slab: 'end_stone_brick_slab',
  prismarine_brick_stairs: 'prismarine_bricks_stairs',
  oak_sign: 'standing_sign',
  oak_wall_sign: 'wall_sign',
  oak_door: 'wooden_door',
  oak_trapdoor: 'trapdoor',
  oak_fence_gate: 'fence_gate',
  oak_pressure_plate: 'wooden_pressure_plate',
  oak_button: 'wooden_button',
  sea_lantern: 'sea_lantern',
  rooted_dirt: 'dirt_with_roots',
  bubble_column: 'bubble_column',
  moving_piston: 'moving_block',
  piston_head: 'piston_arm_collision',
  sticky_piston_head: 'sticky_piston_arm_collision',
  void_air: 'air',
  cave_air: 'air',
};

/** Blocos que não vão para o arquivo (precisam de dados que o Bedrock guarda de outro jeito). */
const SKIP = /^(air|structure_void|nether_portal|end_portal|end_gateway|fire|soul_fire)$/;

const STAIR_DIR: Record<string, number> = { east: 0, west: 1, south: 2, north: 3 };
const PILLAR = /(_log|_wood|_stem|_hyphae|^basalt|^polished_basalt|^hay_block|^bone_block|^quartz_pillar|^purpur_pillar|^deepslate|^muddy_mangrove_roots|^ochre_froglight|^verdant_froglight|^pearlescent_froglight|^chain)$/;
const CARDINAL = /^(furnace|lit_furnace|smoker|blast_furnace|chest|trapped_chest|ender_chest|carved_pumpkin|lit_pumpkin|stonecutter_block|loom|beehive|bee_nest|lectern|anvil|chipped_anvil|damaged_anvil)$/;

export interface BedrockBlock {
  name: string;
  states: Record<string, string | number | boolean>;
}

/** Converte um bloco do Java (id + propriedades) para o nome e estados do Bedrock. */
export function toBedrock(id: string, props: Record<string, string>): BedrockBlock | null {
  if (SKIP.test(id)) return null;
  let name = RENAME[id] ?? id;
  const states: BedrockBlock['states'] = {};

  if (name.endsWith('_stairs')) {
    if (props.facing in STAIR_DIR) states.weirdo_direction = STAIR_DIR[props.facing];
    states.upside_down_bit = props.half === 'top';
  } else if (name.endsWith('_slab')) {
    if (props.type === 'double') name = name.replace(/_slab$/, '_double_slab');
    states['minecraft:vertical_half'] = props.type === 'top' ? 'top' : 'bottom';
  } else if (PILLAR.test(name) && props.axis) {
    states.pillar_axis = props.axis;
  } else if (CARDINAL.test(name) && props.facing) {
    states['minecraft:cardinal_direction'] = props.facing;
  } else if (/door$/.test(name) && !/trapdoor$/.test(name)) {
    states.upper_block_bit = props.half === 'upper';
    states.door_hinge_bit = props.hinge === 'right';
    states.open_bit = props.open === 'true';
  } else if (/trapdoor$/.test(name)) {
    states.upside_down_bit = props.half === 'top';
    states.open_bit = props.open === 'true';
  } else if (/torch$/.test(name)) {
    states.torch_facing_direction = id.includes('wall_') && props.facing ? props.facing : 'top';
  } else if (/lantern$/.test(name) && name !== 'sea_lantern' && props.hanging) {
    states.hanging = props.hanging === 'true';
  } else if (name === 'snow_layer' && props.layers) {
    states.height = Math.max(0, Number(props.layers) - 1);
  }
  return { name: `minecraft:${name}`, states };
}

// ---------- montar o arquivo ----------
/** Versão do formato dos blocos (Bedrock 1.21.0). Arquivos mais antigos o jogo atualiza sozinho. */
const BLOCK_VERSION = (1 << 24) | (21 << 16);

export interface McstructureResult {
  data: Uint8Array;
  fileName: string;
  size: [number, number, number];
  blocks: number;
  skipped: number;
  /** Maior que 64 em x ou z: o Bloco de Estrutura não carrega de uma vez. */
  tooWide: boolean;
}

function slugify(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'construcao';
}

export function buildMcstructure(model: CompiledModel, name: string): McstructureResult {
  const vox = model.voxels;
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const v of vox) {
    const p = [v.x, v.y, v.z];
    for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); }
  }
  if (!vox.length) { lo.fill(0); hi.fill(0); }
  const sx = hi[0] - lo[0] + 1, sy = hi[1] - lo[1] + 1, sz = hi[2] - lo[2] + 1;
  const total = sx * sy * sz;

  const layer0 = new Int32Array(total).fill(-1);
  const layer1 = new Int32Array(total).fill(-1);
  const palette: Tag[] = [];
  const keyToIndex = new Map<string, number>();
  const indexOf = (b: BedrockBlock) => {
    const key = b.name + JSON.stringify(b.states);
    let i = keyToIndex.get(key);
    if (i === undefined) {
      i = palette.length;
      keyToIndex.set(key, i);
      const states: Record<string, Tag> = {};
      for (const [k, val] of Object.entries(b.states))
        states[k] = typeof val === 'boolean' ? { t: 'byte', v: val ? 1 : 0 } : typeof val === 'number' ? int(val) : str(val);
      palette.push(compound({ name: str(b.name), states: compound(states), version: int(BLOCK_VERSION) }));
    }
    return i;
  };

  let blocks = 0, skipped = 0;
  // ordem do Bedrock: z varia mais rápido, depois y, depois x
  const at = (v: Voxel) => (v.x - lo[0]) * sy * sz + (v.y - lo[1]) * sz + (v.z - lo[2]);
  for (const v of vox) {
    const b = toBedrock(v.id, v.props);
    if (!b) { skipped++; continue; }
    const i = at(v);
    layer0[i] = indexOf(b);
    if (v.props.waterlogged === 'true') layer1[i] = indexOf({ name: 'minecraft:water', states: { liquid_depth: 0 } });
    blocks++;
  }

  const data = writeNbt({
    format_version: int(1),
    size: list(TYPE.int, [int(sx), int(sy), int(sz)]),
    structure: compound({
      block_indices: list(TYPE.list, [list(TYPE.int, Array.from(layer0, int)), list(TYPE.int, Array.from(layer1, int))]),
      entities: list(TYPE.compound, []),
      palette: compound({ default: compound({ block_palette: list(TYPE.compound, palette), block_position_data: compound({}) }) }),
    }),
    structure_world_origin: list(TYPE.int, [int(0), int(0), int(0)]),
  });

  return { data, fileName: `${slugify(name)}.mcstructure`, size: [sx, sy, sz], blocks, skipped, tooWide: sx > 64 || sz > 64 };
}
