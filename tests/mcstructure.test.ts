import { describe, expect, it } from 'vitest';
import { buildMcstructure, toBedrock } from '../src/project/mcstructure';
import { compile } from '../src/blueprint/compile';
import { parseBlueprint } from '../src/blueprint/parse';

// leitor NBT little-endian mínimo, só para conferir o arquivo
function readNbt(data: Uint8Array): any {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let p = 0;
  const str = () => { const n = dv.getInt16(p, true); p += 2; const s = new TextDecoder().decode(data.subarray(p, p + n)); p += n; return s; };
  const payload = (t: number): any => {
    switch (t) {
      case 1: return dv.getInt8(p++);
      case 3: { const v = dv.getInt32(p, true); p += 4; return v; }
      case 8: return str();
      case 9: { const of = dv.getUint8(p++); const n = dv.getInt32(p, true); p += 4; return Array.from({ length: n }, () => payload(of)); }
      case 10: { const o: any = {}; for (;;) { const ct = dv.getUint8(p++); if (!ct) return o; const name = str(); o[name] = payload(ct); } }
      default: throw new Error(`tag ${t}`);
    }
  };
  expect(dv.getUint8(p++)).toBe(10);
  expect(str()).toBe('');
  const root = payload(10);
  expect(p).toBe(data.length);
  return root;
}

describe('Bedrock .mcstructure', () => {
  const bp = parseBlueprint(JSON.stringify({ size: { x: 3, y: 2, z: 2 }, operations: [
    { op: 'fill', from: [0, 0, 0], to: [2, 0, 1], block: 'stone' },
    { op: 'set', at: [0, 1, 0], block: 'oak_stairs[facing=north,half=top]' },
    { op: 'set', at: [2, 1, 1], block: 'oak_log[axis=x]' },
  ] })).blueprint!;

  it('arquivo NBT válido: tamanho, paleta e índices na ordem do Bedrock (z, depois y, depois x)', () => {
    const r = buildMcstructure(compile(bp), 'Casa Teste');
    expect(r.fileName).toBe('casa_teste.mcstructure');
    expect(r.size).toEqual([3, 2, 2]);
    expect(r.blocks).toBe(8);
    const nbt = readNbt(r.data);
    expect(nbt.format_version).toBe(1);
    expect(nbt.size).toEqual([3, 2, 2]);
    const pal = nbt.structure.palette.default.block_palette;
    const [l0, l1] = nbt.structure.block_indices;
    expect(l0).toHaveLength(12);
    expect(l1.every((i: number) => i === -1)).toBe(true);
    const at = (x: number, y: number, z: number) => pal[l0[x * 2 * 2 + y * 2 + z]];
    expect(at(1, 0, 1).name).toBe('minecraft:stone');
    expect(at(0, 1, 0)).toMatchObject({ name: 'minecraft:oak_stairs', states: { weirdo_direction: 3, upside_down_bit: 1 } });
    expect(at(2, 1, 1)).toMatchObject({ name: 'minecraft:oak_log', states: { pillar_axis: 'x' } });
    expect(l0[1 * 2 * 2 + 1 * 2 + 0]).toBe(-1); // vazio fica -1 (não apaga o terreno)
  });

  it('converte nomes e estados do Java', () => {
    expect(toBedrock('terracotta', {})!.name).toBe('minecraft:hardened_clay');
    expect(toBedrock('cobblestone_stairs', { facing: 'east' })!).toMatchObject({ name: 'minecraft:stone_stairs', states: { weirdo_direction: 0 } });
    expect(toBedrock('oak_slab', { type: 'double' })!.name).toBe('minecraft:oak_double_slab');
    expect(toBedrock('wall_torch', { facing: 'south' })!).toMatchObject({ name: 'minecraft:torch', states: { torch_facing_direction: 'south' } });
    expect(toBedrock('nether_portal', {})).toBeNull();
  });
});
