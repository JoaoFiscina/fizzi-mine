import { describe, expect, it } from 'vitest';
import { resolveFaces } from '../src/render/textures';

// nomes que existem no .jar do Minecraft 1.21 (amostra)
const NAMES = new Set([
  'grass_block_top', 'grass_block_side', 'dirt', 'oak_log', 'oak_log_top', 'oak_planks', 'stone_bricks', 'cobblestone',
  'furnace_front', 'furnace_side', 'furnace_top', 'crafting_table_front', 'crafting_table_side', 'crafting_table_top',
  'oak_door_top', 'oak_door_bottom', 'glass', 'white_wool', 'oak_leaves', 'water_still', 'sandstone', 'sandstone_top',
  'sandstone_bottom', 'torch', 'spruce_planks',
]);
const has = (n: string) => NAMES.has(n);

describe('textura de cada face', () => {
  it('blocos com topo e lateral diferentes', () => {
    expect(resolveFaces('grass_block', {}, has)).toMatchObject({ top: 'grass_block_top', side: 'grass_block_side', bottom: 'dirt', tintTopOnly: true });
    expect(resolveFaces('oak_log', { axis: 'y' }, has)).toMatchObject({ top: 'oak_log_top', side: 'oak_log' });
    expect(resolveFaces('furnace', { facing: 'south' }, has)).toMatchObject({ front: 'furnace_front', side: 'furnace_side', top: 'furnace_top' });
  });

  it('derivados usam o material de origem', () => {
    expect(resolveFaces('stone_brick_stairs', {}, has)?.side).toBe('stone_bricks');
    expect(resolveFaces('cobblestone_wall', {}, has)?.side).toBe('cobblestone');
    expect(resolveFaces('oak_fence', {}, has)?.side).toBe('oak_planks');
    expect(resolveFaces('sandstone_slab', {}, has)).toMatchObject({ side: 'sandstone', top: 'sandstone_top' });
    expect(resolveFaces('spruce_wall_sign', {}, has)?.side).toBe('spruce_planks');
  });

  it('casos especiais', () => {
    expect(resolveFaces('oak_door', { half: 'upper' }, has)?.side).toBe('oak_door_top');
    expect(resolveFaces('glass_pane', {}, has)?.side).toBe('glass');
    expect(resolveFaces('white_carpet', {}, has)?.side).toBe('white_wool');
    expect(resolveFaces('oak_leaves', {}, has)?.tint).toBe(0x48b518);
    expect(resolveFaces('water', {}, has)).toMatchObject({ side: 'water_still', tint: 0x3f76e4 });
    expect(resolveFaces('oak_wood', {}, has)?.side).toBe('oak_log');
  });

  it('sem textura de bloco: fica com a cor', () => {
    expect(resolveFaces('chest', {}, has)).toBeUndefined();
    expect(resolveFaces('red_bed', { part: 'foot' }, has)).toBeUndefined();
    expect(resolveFaces('bloco_que_nao_existe', {}, has)).toBeUndefined();
  });
});
