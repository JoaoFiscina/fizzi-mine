import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { decodeProject, encodeProject } from '../src/project/share';
import { buildDatapack } from '../src/project/datapack';
import { buildModel, emptyProject, exportProject, importProject, setPart } from '../src/project/project';
import { compile } from '../src/blueprint/compile';
import { parseBlueprint } from '../src/blueprint/parse';

const sobrado = readFileSync(join(__dirname, '..', 'public', 'examples', 'sobrado-etapas.projeto.json'), 'utf8');

describe('link para compartilhar', () => {
  it('ida e volta dá o mesmo projeto, e o código é bem menor que o JSON', () => {
    const json = exportProject(importProject(sobrado)!);
    const code = encodeProject(json);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(code.length).toBeLessThan(json.length / 3);
    const back = importProject(decodeProject(code)!)!;
    expect(buildModel(back).model!.voxels.length).toBe(buildModel(importProject(json)!).model!.voxels.length);
  });

  it('código quebrado não derruba', () => {
    expect(decodeProject('isso-nao-e-um-projeto')).toBeUndefined();
  });
});

describe('datapack', () => {
  const small = () => {
    const bp = parseBlueprint(JSON.stringify({ size: { x: 3, y: 2, z: 1 }, operations: [
      { op: 'fill', from: [0, 0, 0], to: [2, 0, 0], block: 'stone' },
      { op: 'set', at: [1, 1, 0], block: 'torch' },
      { op: 'set', at: [0, 1, 0], block: 'oak_stairs[facing=north,half=bottom]' },
    ] })).blueprint!;
    return buildDatapack(compile(bp), 'Casa Teste');
  };
  const read = (dp: ReturnType<typeof buildDatapack>, f: string) => strFromU8(unzipSync(dp.zip)[`data/fizzimine/function/casa_teste/${f}.mcfunction`]);

  it('funções: âncora, construir, fantasma (tudo e por camada), conferir, limpar', () => {
    const dp = small();
    const names = Object.keys(unzipSync(dp.zip)).filter((k) => k.endsWith('.mcfunction')).map((k) => k.split('casa_teste/')[1].replace('.mcfunction', '')).sort();
    expect(names).toEqual([
      '_blocos', '_conferir', '_fantasma', '_fantasma_camada/y0', '_fantasma_camada/y1', '_limpar',
      'apagar_fantasma', 'aqui', 'conferir', 'construir', 'fantasma', 'fantasma/y0', 'fantasma/y1', 'limpar',
    ]);
    expect(dp.ns).toBe('fizzimine:casa_teste');
    expect(dp.layers).toEqual([0, 1]);
    expect(JSON.parse(strFromU8(unzipSync(dp.zip)['pack.mcmeta'])).pack.pack_format).toBe(81);
  });

  it('construir usa a âncora e junta blocos iguais em /fill, com a tocha depois do apoio', () => {
    const dp = small();
    expect(read(dp, 'construir')).toContain('execute at @e[type=marker,tag=fz_casa_teste,limit=1] run function fizzimine:casa_teste/_blocos');
    const b = read(dp, '_blocos');
    expect(b).toContain('fill ~1 ~0 ~1 ~3 ~0 ~1 stone');
    expect(b.indexOf('torch')).toBeGreaterThan(b.indexOf('stone'));
    expect(read(dp, 'aqui')).toContain('execute align xyz run summon marker ~ ~ ~');
  });

  it('fantasma: block_display menor, com estado e tags', () => {
    const g = read(small(), '_fantasma');
    expect(g).toContain('summon block_display ~1 ~1 ~1 {block_state:{Name:"minecraft:oak_stairs",Properties:{facing:"north",half:"bottom"}}');
    expect(g).toContain('scale:[0.875f,0.875f,0.875f]');
    expect(g).toContain('Tags:["fizzimine","fz_casa_teste","fz_casa_teste_y1"]');
    expect(read(small(), 'apagar_fantasma')).toContain('kill @e[type=block_display,tag=fz_casa_teste]');
  });

  it('conferir: partícula no centro do bloco que falta (inclusive em y negativo)', () => {
    const c = read(small(), '_conferir');
    expect(c).toContain('execute unless block ~1 ~0 ~1 minecraft:stone run particle minecraft:happy_villager ~1.5 ~0.5 ~1.5');
    const p = emptyProject('t', 'livre');
    setPart(p, 'livre', 1, JSON.stringify({ size: { x: 1, y: 1, z: 1 }, operations: [{ op: 'set', at: [0, 0, 0], block: 'stone' }] }));
    setPart(p, 'livre', 2, JSON.stringify({ part: { number: 2, kind: 'alteracao' }, operations: [{ op: 'set', at: [0, -3, 0], block: 'stone' }] }));
    const dp = buildDatapack(buildModel(p).model!, 'Casa Teste');
    expect(read(dp, '_conferir')).toContain('~-3 ~1 minecraft:stone run particle minecraft:happy_villager ~1.5 ~-2.5 ~1.5');
    expect(dp.layers[0]).toBe(-3);
  });
});
