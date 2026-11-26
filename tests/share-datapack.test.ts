import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { decodeProject, encodeProject } from '../src/project/share';
import { buildDatapack } from '../src/project/datapack';
import { buildModel, exportProject, importProject } from '../src/project/project';
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
  it('gera pack.mcmeta, funções e comandos com fill/setblock relativos', () => {
    const bp = parseBlueprint(JSON.stringify({ size: { x: 3, y: 2, z: 1 }, operations: [
      { op: 'fill', from: [0, 0, 0], to: [2, 0, 0], block: 'stone' },
      { op: 'set', at: [1, 1, 0], block: 'torch' },
    ] })).blueprint!;
    const m = compile(bp);
    const dp = buildDatapack(m, 'Casa Teste');
    const files = unzipSync(dp.zip);
    expect(Object.keys(files).sort()).toEqual([
      'como_usar.txt', 'data/fizzimine/function/casa_teste/construir.mcfunction', 'data/fizzimine/function/casa_teste/limpar.mcfunction', 'pack.mcmeta',
    ]);
    const fn = strFromU8(files['data/fizzimine/function/casa_teste/construir.mcfunction']);
    expect(fn).toContain('fill ~1 ~0 ~1 ~3 ~0 ~1 stone'); // 3 pedras viram 1 fill
    expect(fn.indexOf('torch')).toBeGreaterThan(fn.indexOf('stone')); // tocha depois do apoio
    expect(dp.command).toBe('/function fizzimine:casa_teste/construir');
    expect(JSON.parse(strFromU8(files['pack.mcmeta'])).pack.pack_format).toBe(81);
  });

  it('subsolo: y negativo do projeto fica abaixo dos pés', () => {
    const p = importProject(sobrado)!;
    const m = buildModel(p).model!;
    const dp = buildDatapack(m, 'Sobrado');
    const fn = strFromU8(unzipSync(dp.zip)['data/fizzimine/function/sobrado/construir.mcfunction']);
    expect(fn).toContain(' ~0 '); // térreo na altura dos pés
  });
});
