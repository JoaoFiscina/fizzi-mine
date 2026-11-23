import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileParts } from '../src/blueprint/compile';
import { parseBlueprint } from '../src/blueprint/parse';
import { flattenToBlueprint, regionToPromptText } from '../src/blueprint/serialize';
import { buildAutoPrompt, buildStagePrompt, continueMessage, editMessage, EMPTY_REQUEST, extraPartMessage } from '../src/prompt/builder';
import {
  autoFloors, buildModel, convertToAuto, convertToStages, emptyProject, exportProject, importProject, lastLivre, nextPartNumber, nextSlot, refreshFloors,
  setPart, slotsOf,
} from '../src/project/project';

const sobrado = readFileSync(join(__dirname, '..', 'public', 'examples', 'sobrado-etapas.projeto.json'), 'utf8');
const bp = (o: object) => JSON.stringify({ format: 'mc-blueprint', version: 1, meta: { name: 't' }, ...o });

describe('projeto de exemplo em etapas', () => {
  const p = importProject(sobrado)!;
  const built = buildModel(p);

  it('abre todas as etapas sem nenhum aviso', () => {
    expect(p.parts).toHaveLength(6);
    for (const [key, r] of built.results) {
      expect(r.errors, key).toEqual([]);
      expect(r.warnings, key).toEqual([]);
      expect(built.model!.partWarnings.get(key), key).toEqual([]);
    }
    expect(built.model!.warnings).toEqual([]);
  });

  it('lista as etapas na ordem e nada fica pendente', () => {
    expect(slotsOf(p).map((s) => s.num)).toEqual(['1', '2a', '2b', '3a', '3b', '4']);
    expect(nextSlot(p)).toBeUndefined();
  });

  it('cada bloco sabe de que etapa veio', () => {
    expect(built.model!.index.get('10,1,5')?.part).toBe('andar:0'); // fogueira da lareira
    expect(built.model!.index.get('9,6,3')?.part).toBe('decoracao:1'); // cama
  });

  it('esconder uma etapa tira os blocos dela', () => {
    const hidden = importProject(sobrado)!;
    hidden.parts.find((x) => x.stage === 'decoracao' && x.floor === 1)!.visible = false;
    const m = buildModel(hidden).model!;
    expect(m.index.get('9,6,3')).toBeUndefined();
    expect(m.voxels.length).toBeLessThan(built.model!.voxels.length);
  });

  it('exportar e importar o projeto dá o mesmo resultado', () => {
    const again = importProject(exportProject(p))!;
    expect(buildModel(again).model!.voxels.length).toBe(built.model!.voxels.length);
  });

  it('blueprint único exportado reabre idêntico', () => {
    const flat = flattenToBlueprint(built.model!, { name: p.name });
    const res = parseBlueprint(JSON.stringify(flat));
    expect(res.warnings).toEqual([]);
    const m = compileParts([{ id: 'x', bp: res.blueprint! }]);
    expect(m.partWarnings.get('x')).toEqual([]);
    expect(m.voxels.length).toBe(built.model!.voxels.length);
    for (const v of built.model!.voxels) expect(m.index.get(`${v.x},${v.y},${v.z}`)?.state).toBe(v.state);
  });

  it('prompts das etapas trazem o estado atual e não deixam marcadores', () => {
    const slots = slotsOf(p);
    for (const s of slots) {
      const before = buildModel(p, { upTo: s.key, onlyVisible: false }).model;
      const text = buildStagePrompt(p, s, { model: before, style: 'x' });
      expect(text, s.key).not.toMatch(/<<\w+>>/);
    }
    const s3a = slots.find((s) => s.key === 'decoracao:0')!;
    const ctx = buildModel(p, { upTo: s3a.key, onlyVisible: false }).model;
    const prompt = buildStagePrompt(p, s3a, { model: ctx });
    expect(prompt).toContain('ETAPA 3');
    expect(prompt).toContain('y=0 até y=4');
    expect(prompt).toContain('lareira'); // cômodo da planta
    // a mobília da própria etapa 3a não entra no contexto, mas a lareira da 2a entra
    expect(ctx!.index.get('8,1,5')).toBeUndefined();
    expect(ctx!.index.get('10,1,5')?.id).toBe('campfire');
  });
});

describe('modo automático (a IA divide)', () => {
  const part = (n: number, extra: object, ops: object[]) =>
    bp({ size: { x: 5, y: 4, z: 5 }, part: { number: n, of: 3, title: `Parte ${n}`, next: n < 3 ? `Parte ${n + 1}` : '', done: n === 3, ...extra }, operations: ops });

  it('soma as partes na ordem do número, protege mobília e sabe o que vem depois', () => {
    const p = emptyProject('t', 'livre');
    setPart(p, 'livre', 1, part(1, { kind: 'estrutura', title: 'Estrutura' }, [{ op: 'hollow', from: [0, 0, 0], to: [4, 3, 4], block: 'stone' }]));
    expect(lastLivre(p)).toMatchObject({ next: 'Parte 2', of: 3, done: false });
    expect(nextPartNumber(p)).toBe(2);
    setPart(p, 'livre', 2, part(2, { kind: 'mobilia', yFrom: 1, yTo: 2 }, [
      { op: 'set', at: [0, 1, 1], block: 'chest' }, // parede: ignorado
      { op: 'set', at: [2, 1, 2], block: 'red_bed[part=foot]' },
    ]));
    const m = buildModel(p).model!;
    expect(slotsOf(p).map((s) => s.title)).toEqual(['Estrutura', 'Parte 2']);
    expect(m.index.get('0,1,1')?.id).toBe('stone');
    expect(m.index.get('2,1,2')?.id).toBe('red_bed');
    expect(m.partWarnings.get('livre:2')!.join()).toMatch(/1 bloco/);
    setPart(p, 'livre', 3, part(3, { kind: 'detalhe' }, [{ op: 'set', at: [2, 3, 2], block: 'lantern' }]));
    expect(lastLivre(p).done).toBe(true);
  });

  it('prompt inicial e mensagens de continuar / parte extra', () => {
    const start = buildAutoPrompt({ ...EMPTY_REQUEST, idea: 'Casa da fazenda' });
    expect(start).toContain('VOCÊ decide como dividir');
    expect(start).toContain('Casa da fazenda');
    expect(start).not.toMatch(/<<\w+>>/);
    expect(continueMessage(4, 'Mobília do térreo', { x: 9, y: 9, z: 9 })).toContain('parte 4 (Mobília do térreo)');
    expect(extraPartMessage(7, 'uma torre', undefined)).toContain('number 7');
  });

  it('exporta e importa projeto automático', () => {
    const p = emptyProject('t', 'livre');
    setPart(p, 'livre', 1, part(1, {}, [{ op: 'set', at: [0, 0, 0], block: 'stone' }]));
    const again = importProject(exportProject(p))!;
    expect(again.mode).toBe('livre');
    expect(slotsOf(again)).toHaveLength(1);
  });
});

describe('alterar e ampliar (edição)', () => {
  const base = bp({ size: { x: 5, y: 4, z: 5 }, part: { number: 1, title: 'Casa' }, operations: [
    { op: 'fill', from: [0, 0, 0], to: [4, 0, 4], block: 'cobblestone' },
    { op: 'walls', from: [0, 1, 0], to: [4, 3, 4], block: 'oak_planks' },
  ] });

  it('parte de alteração troca e apaga blocos das anteriores e amplia para coordenadas negativas sem aviso', () => {
    const p = emptyProject('t', 'livre');
    setPart(p, 'livre', 1, base);
    setPart(p, 'livre', 2, bp({ part: { number: 2, title: 'Porão e porta', kind: 'alteracao' }, operations: [
      { op: 'fill', from: [1, 0, 1], to: [3, 0, 3], block: 'dark_oak_planks' }, // troca o piso
      { op: 'clear', from: [2, 1, 0], to: [2, 2, 0] }, // abre porta no norte
      { op: 'hollow', from: [0, -4, 0], to: [4, -1, 4], block: 'stone_bricks' }, // subsolo
      { op: 'fill', from: [0, 0, -3], to: [4, 0, -1], block: 'cobblestone' }, // amplia para o norte
    ] }));
    const b = buildModel(p);
    const m = b.model!;
    expect(m.warnings).toEqual([]);
    expect(m.partWarnings.get('livre:2')).toEqual([]);
    expect(m.offset).toEqual([0, 4, 3]);
    const at = (x: number, y: number, z: number) => m.index.get(`${x + m.offset[0]},${y + m.offset[1]},${z + m.offset[2]}`);
    expect(at(2, 0, 2)?.id).toBe('dark_oak_planks'); // trocado
    expect(at(0, 0, 0)?.id).toBe('cobblestone'); // borda não mexida
    expect(at(2, 1, 0)).toBeUndefined(); // apagado
    expect(at(0, -4, 0)?.id).toBe('stone_bricks'); // subsolo
    expect(at(2, 0, -2)?.id).toBe('cobblestone'); // ampliado
    // o texto do estado usa as coordenadas do projeto
    const t = regionToPromptText(m, -4, -4);
    expect(t).toContain('y=-4');
    expect(t).toContain('x de 0 a 4, y de -4 a 3, z de -3 a 4');
  });

  it('qualquer projeto vira automático mantendo as partes e a proteção da mobília', () => {
    const p = importProject(sobrado)!;
    const before = buildModel(p).model!.voxels.length;
    convertToAuto(p);
    expect(p.mode).toBe('livre');
    expect(slotsOf(p).map((s) => s.num)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(p.parts.find((x) => x.floor === 4)?.kind).toBe('mobilia');
    expect(buildModel(p).model!.voxels.length).toBe(before);
    expect(nextPartNumber(p)).toBe(7);
  });

  it('pedido de alteração: conversa nova manda regras e estado; mesma conversa é curto', () => {
    const novo = editMessage({ number: 3, request: 'fazer um porão', state: 'ESTADO', newChat: true, summary: 'RESUMO' });
    expect(novo).toContain('ALTERAR e AMPLIAR');
    expect(novo).toContain('ESTADO');
    expect(novo).toContain('"number": 3');
    expect(novo).not.toMatch(/<<\w+>>/);
    const curto = editMessage({ number: 4, request: 'trocar o piso', newChat: false });
    expect(curto).toContain('ALTERAÇÃO · parte 4: trocar o piso');
    expect(curto.length).toBeLessThan(800);
  });
});

describe('regras das etapas', () => {
  const structure = bp({
    size: { x: 5, y: 4, z: 5 },
    plan: { floors: [{ name: 'Térreo', yFrom: 0, yTo: 3, rooms: [{ name: 'Sala', from: [1, 1, 1], to: [3, 3, 3], use: 'sala' }] }] },
    operations: [{ op: 'hollow', from: [0, 0, 0], to: [4, 3, 4], block: 'stone' }],
  });

  it('a estrutura com plan define os andares', () => {
    const p = emptyProject('t', 'etapas');
    setPart(p, 'estrutura', undefined, structure);
    refreshFloors(p);
    expect(p.floors).toEqual([{ name: 'Térreo', yFrom: 0, yTo: 3, rooms: [{ name: 'Sala', from: [1, 1, 1], to: [3, 3, 3], use: 'sala' }] }]);
    expect(nextSlot(p)?.key).toBe('andar:0');
  });

  it('mobília não substitui parede e avisa', () => {
    const p = emptyProject('t', 'etapas');
    setPart(p, 'estrutura', undefined, structure);
    refreshFloors(p);
    setPart(p, 'decoracao', 0, bp({ size: { x: 5, y: 4, z: 5 }, operations: [
      { op: 'set', at: [0, 1, 2], block: 'bookshelf' }, // em cima da parede
      { op: 'set', at: [2, 1, 2], block: 'chest' }, // espaço vazio
    ] }));
    const m = buildModel(p).model!;
    expect(m.index.get('0,1,2')?.id).toBe('stone');
    expect(m.index.get('2,1,2')?.id).toBe('chest');
    expect(m.partWarnings.get('decoracao:0')!.join()).toMatch(/1 bloco/);
  });

  it('detalhe fora do andar gera aviso', () => {
    const p = emptyProject('t', 'etapas');
    setPart(p, 'estrutura', undefined, structure);
    refreshFloors(p);
    p.floors = [{ name: 'A', yFrom: 0, yTo: 1 }, { name: 'B', yFrom: 2, yTo: 3 }];
    setPart(p, 'andar', 0, bp({ size: { x: 5, y: 4, z: 5 }, operations: [{ op: 'set', at: [2, 3, 2], block: 'glass' }] }));
    expect(buildModel(p).model!.partWarnings.get('andar:0')!.join()).toMatch(/fora do andar/);
  });

  it('projeto rápido vira projeto em etapas', () => {
    const p = emptyProject('t', 'rapido');
    setPart(p, 'completo', undefined, structure);
    convertToStages(p);
    expect(p.mode).toBe('etapas');
    expect(slotsOf(p)[0].part).toBeDefined();
    expect(p.floors).toHaveLength(1);
  });

  it('sem plan, acha os andares pelos pisos', () => {
    const p = emptyProject('t', 'rapido');
    setPart(p, 'completo', undefined, bp({ operations: [
      { op: 'fill', from: [0, 0, 0], to: [6, 0, 6], block: 'stone' },
      { op: 'walls', from: [0, 1, 0], to: [6, 4, 6], block: 'stone' },
      { op: 'fill', from: [0, 5, 0], to: [6, 5, 6], block: 'oak_planks' },
      { op: 'walls', from: [0, 6, 0], to: [6, 9, 6], block: 'oak_planks' },
      { op: 'fill', from: [0, 10, 0], to: [6, 10, 6], block: 'oak_planks' },
    ] }));
    const floors = autoFloors(buildModel(p).model!);
    expect(floors.map((f) => [f.yFrom, f.yTo])).toEqual([[0, 4], [5, 10]]);
  });

  it('o prompt da etapa 1 pede a planta', () => {
    const p = emptyProject('Torre', 'etapas', { ...EMPTY_REQUEST, idea: 'Torre de mago' });
    const text = buildStagePrompt(p, slotsOf(p)[0], {});
    expect(text).toContain('"plan"');
    expect(text).toContain('Torre de mago');
    expect(text).not.toMatch(/<<\w+>>/);
  });

  it('o estado atual vira texto com paleta e camadas', () => {
    const m = compileParts([{ id: 'a', bp: parseBlueprint(structure).blueprint! }]);
    const t = regionToPromptText(m, 1, 1);
    expect(t).toContain('y=1');
    expect(t).toContain('A...A');
  });
});
