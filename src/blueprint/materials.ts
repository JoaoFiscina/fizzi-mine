import type { Voxel } from './compile';

export interface MaterialLine {
  item: string;
  count: number;
  stackSize: number;
  /** pilhas completas */
  stacks: number;
  /** itens que sobram fora das pilhas completas */
  remainder: number;
}

const TALL_PLANTS = new Set(['tall_grass', 'large_fern', 'sunflower', 'lilac', 'rose_bush', 'peony', 'tall_seagrass', 'pitcher_plant']);

/** Converte um bloco colocado no item que você precisa ter no inventário. */
export function toItem(v: Voxel): { item: string; qty: number } | null {
  const { id, props } = v;
  // Blocos que ocupam 2 espaços mas são 1 item
  if (id.endsWith('_door') && props.half === 'upper') return null;
  if (id.endsWith('_bed') && props.part === 'head') return null;
  if (TALL_PLANTS.has(id) && props.half === 'upper') return null;
  if (id === 'piston_head' || id === 'moving_piston') return null;
  // não são itens: o portal se acende com isqueiro dentro da moldura
  if (['nether_portal', 'end_portal', 'end_gateway', 'fire', 'soul_fire'].includes(id)) return null;
  if (id.endsWith('_wall_torch') || id === 'wall_torch') return { item: id.replace('wall_torch', 'torch'), qty: 1 };
  if (id === 'water_cauldron' || id === 'lava_cauldron') return { item: 'cauldron', qty: 1 };
  if (id.startsWith('potted_')) return { item: 'flower_pot', qty: 1 };
  if (id === 'farmland') return { item: 'dirt', qty: 1 };
  if (id === 'dirt_path') return { item: 'dirt', qty: 1 };
  if (id === 'kelp_plant') return { item: 'kelp', qty: 1 };
  if (['carrots', 'potatoes', 'wheat', 'beetroots'].includes(id)) {
    const seed: Record<string, string> = { carrots: 'carrot', potatoes: 'potato', wheat: 'wheat_seeds', beetroots: 'beetroot_seeds' };
    return { item: seed[id], qty: 1 };
  }

  if (id.endsWith('_slab') && props.type === 'double') return { item: id, qty: 2 };
  if (id === 'water') return { item: 'water_bucket (fonte)', qty: 1 };
  if (id === 'lava') return { item: 'lava_bucket (fonte)', qty: 1 };
  if (id === 'wall_torch') return { item: 'torch', qty: 1 };
  if (id === 'soul_wall_torch') return { item: 'soul_torch', qty: 1 };
  if (id === 'redstone_wall_torch') return { item: 'redstone_torch', qty: 1 };
  if (id.endsWith('_wall_hanging_sign')) return { item: id.replace('_wall_hanging_sign', '_hanging_sign'), qty: 1 };
  if (id.endsWith('_wall_sign')) return { item: id.replace('_wall_sign', '_sign'), qty: 1 };
  if (id.endsWith('_wall_banner')) return { item: id.replace('_wall_banner', '_banner'), qty: 1 };
  if (id === 'redstone_wire') return { item: 'redstone', qty: 1 };
  if (id === 'tripwire') return { item: 'string', qty: 1 };
  if (id === 'snow' && props.layers) return { item: 'snow', qty: Number(props.layers) || 1 };
  if (id.endsWith('candle') && props.candles) return { item: id, qty: Number(props.candles) || 1 };
  if (id === 'sea_pickle' && props.pickles) return { item: id, qty: Number(props.pickles) || 1 };
  return { item: id, qty: 1 };
}

function stackSizeOf(item: string): number {
  if (/_bed$|_bucket|_boat$|_minecart$|^cake$|^saddle$/.test(item)) return 1;
  if (/_sign$|_banner$|^(ender_pearl|snowball|egg|honey_bottle|armor_stand)$/.test(item)) return 16;
  return 64;
}

export function computeMaterials(voxels: Voxel[]): MaterialLine[] {
  const counts = new Map<string, number>();
  for (const v of voxels) {
    const it = toItem(v);
    if (it) counts.set(it.item, (counts.get(it.item) ?? 0) + it.qty);
  }
  return [...counts.entries()]
    .map(([item, count]) => {
      const stackSize = stackSizeOf(item);
      return { item, count, stackSize, stacks: Math.floor(count / stackSize), remainder: count % stackSize };
    })
    .sort((a, b) => b.count - a.count || a.item.localeCompare(b.item));
}

/** Quantas shulker boxes (27 slots) cabem tudo. */
export function shulkersNeeded(lines: MaterialLine[]): number {
  const slots = lines.reduce((acc, l) => acc + Math.ceil(l.count / l.stackSize), 0);
  return Math.ceil(slots / 27);
}

export function formatStacks(l: MaterialLine): string {
  if (l.stackSize === 1 || l.count < l.stackSize) return `${l.count}`;
  return l.remainder ? `${l.stacks}×${l.stackSize} + ${l.remainder}` : `${l.stacks}×${l.stackSize}`;
}
