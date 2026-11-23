import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseBlueprint } from '../src/blueprint/parse';
import { compile } from '../src/blueprint/compile';
import { computeMaterials } from '../src/blueprint/materials';
import { blockName } from '../src/blueprint/names';
import { correctionMessage } from '../src/prompt/correction';
import { buildPrompt, EMPTY_REQUEST } from '../src/prompt/builder';
import { partsFor } from '../src/render/geometry';
import { lookFor } from '../src/render/blocks';

/** Lê + compila e devolve tudo junto. */
function run(text: string) {
  const res = parseBlueprint(text);
  expect(res.errors).toEqual([]);
  expect(res.ok).toBe(true);
  const model = compile(res.blueprint!, { sizeInferred: res.sizeInferred });
  return { res, model, warnings: [...res.warnings, ...model.warnings] };
}

const at = (model: ReturnType<typeof compile>, x: number, y: number, z: number) => model.index.get(`${x},${y},${z}`)?.state;

describe('exemplos e prompt', () => {
  const dir = join(__dirname, '..', 'public', 'examples');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json' && !f.includes('.projeto.'))) {
    it(`${file} abre sem nenhum aviso`, () => {
      const { warnings, model } = run(readFileSync(join(dir, file), 'utf8'));
      expect(warnings).toEqual([]);
      expect(model.voxels.length).toBeGreaterThan(0);
    });
  }

  it('o exemplo dentro do prompt é válido e sem avisos', () => {
    const md = readFileSync(join(__dirname, '..', 'docs', 'prompts', 'completo.md'), 'utf8');
    const { warnings, res } = run(md.match(/```json\n([\s\S]*?)```/)![1]);
    expect(warnings).toEqual([]);
    expect(res.fixes).toEqual([]);
  });

  it('o prompt gerado inclui o pedido e não deixa o marcador', () => {
    const p = buildPrompt({ ...EMPTY_REQUEST, idea: 'Torre de vigia de pedra', photos: true });
    expect(p).toContain('Torre de vigia de pedra');
    expect(p).toContain('anexar fotos');
    expect(p).not.toMatch(/<<\w+>>/);
  });
});

describe('leitura tolerante da resposta da IA', () => {
  it('aceita texto em volta, comentários, vírgulas sobrando e formatos alternativos', () => {
    const reply = `Claro! Aqui está o blueprint da sua parede:

\`\`\`json
{
  // parede de teste
  "meta": { "name": "Parede" },
  "size": [3, 2, 1],
  "operations": [
    { "type": "box", "start": "0,0,0", "end": {"x": 2, "y": 1, "z": 0}, "material": "Stone Brick", },
    { "op": "place", "pos": [1, 1, 0], "block": "minecraft:Glass_Panes" },
  ],
}
\`\`\`

Espero que goste!`;
    const { res, model, warnings } = run(reply);
    expect(warnings).toEqual([]);
    expect(model.voxels).toHaveLength(6);
    expect(at(model, 0, 0, 0)).toBe('stone_bricks');
    expect(at(model, 1, 1, 0)).toBe('glass_pane');
    expect(res.fixes.length).toBeGreaterThan(3);
  });

  it('detecta resposta cortada no meio', () => {
    const res = parseBlueprint('```json\n{ "format": "mc-blueprint", "size": {"x": 2, "y": 1, "z": 2}, "layers": [ { "y": 0, "rows": ["AA", ');
    expect(res.ok).toBe(false);
    expect(res.truncated).toBe(true);
    expect(correctionMessage(res)).toMatch(/cortada/);
  });

  it('aponta a linha do erro de sintaxe', () => {
    const res = parseBlueprint('{ "size": {"x": 1 "y": 1, "z": 1} }');
    expect(res.ok).toBe(false);
    expect(res.errors[0]).toMatch(/sintaxe/);
  });

  it('corrige erro de digitação e avisa bloco inventado', () => {
    const { model, warnings, res } = run(
      JSON.stringify({ size: { x: 2, y: 1, z: 1 }, operations: [
        { op: 'set', at: [0, 0, 0], block: 'spruce_plank' },
        { op: 'set', at: [1, 0, 0], block: 'super_magic_block' },
      ] }),
    );
    expect(at(model, 0, 0, 0)).toBe('spruce_planks');
    expect(res.fixes.join()).toMatch(/spruce_plank/);
    expect(warnings.join()).toMatch(/super_magic_block/);
  });

  it('camadas: texto com quebras de linha, y em faixa e caracteres separados por espaço', () => {
    const { model, warnings } = run(
      JSON.stringify({
        size: { x: 3, y: 3, z: 2 },
        palette: { S: 'stone', G: 'glass' },
        layers: [
          { y: 0, rows: 'SSS\nSSS' },
          { y: '1-2', rows: ['S G S', 'S . S'] },
        ],
      }),
    );
    expect(warnings).toEqual([]);
    expect(at(model, 1, 2, 0)).toBe('glass');
    expect(at(model, 1, 2, 1)).toBeUndefined();
    expect(model.voxels).toHaveLength(6 + 5 * 2);
  });

  it('avisa linhas com tamanho errado e caractere fora da paleta', () => {
    const { warnings } = run(JSON.stringify({ size: { x: 3, y: 1, z: 2 }, palette: { A: 'stone' }, layers: [{ y: 0, rows: ['AAAA', 'AXA'] }] }));
    expect(warnings.join('\n')).toMatch(/4 caracteres/);
    expect(warnings.join('\n')).toMatch(/"X"/);
  });

  it('desloca coordenadas negativas e aumenta o tamanho quando há blocos fora', () => {
    const { model, warnings } = run(JSON.stringify({ size: { x: 2, y: 1, z: 2 }, operations: [{ op: 'fill', from: [-1, 0, 0], to: [3, 0, 0], block: 'stone' }] }));
    expect(model.offset).toEqual([1, 0, 0]);
    expect(model.size.x).toBe(5);
    expect(at(model, 0, 0, 0)).toBe('stone');
    expect(warnings.join()).toMatch(/negativas/);
  });

  it('sem size: calcula pelos blocos, sem avisar', () => {
    const { model, warnings } = run(JSON.stringify({ operations: [{ op: 'fill', from: [0, 0, 0], to: [4, 2, 1], block: 'dirt' }] }));
    expect(warnings).toEqual([]);
    expect(model.size).toEqual({ x: 5, y: 3, z: 2 });
  });

  it('operação desconhecida vira aviso, não quebra o resto', () => {
    const { model, warnings } = run(JSON.stringify({ size: { x: 1, y: 1, z: 1 }, operations: [{ op: 'explode', at: [0, 0, 0] }, { op: 'set', at: [0, 0, 0], block: 'stone' }] }));
    expect(model.voxels).toHaveLength(1);
    expect(warnings.join()).toMatch(/explode/);
  });
});

describe('operações especiais', () => {
  it('roof: escadas viradas para a cumeeira e laje no topo', () => {
    const { model } = run(JSON.stringify({ size: { x: 3, y: 3, z: 5 }, operations: [{ op: 'roof', from: [0, 0, 0], to: [2, 0, 4], block: 'oak_stairs', axis: 'x' }] }));
    expect(at(model, 1, 0, 0)).toBe('oak_stairs[facing=south,half=bottom]');
    expect(at(model, 1, 0, 4)).toBe('oak_stairs[facing=north,half=bottom]');
    expect(at(model, 1, 1, 1)).toBe('oak_stairs[facing=south,half=bottom]');
    expect(at(model, 1, 2, 2)).toBe('oak_slab[type=bottom]');
    expect(model.size.y).toBe(3);
  });

  it('roof com gable não sobrescreve o topo das paredes', () => {
    const { model } = run(JSON.stringify({ size: { x: 3, y: 3, z: 5 }, operations: [
      { op: 'set', at: [0, 0, 2], block: 'oak_log' },
      { op: 'roof', from: [0, 0, 0], to: [2, 0, 4], block: 'oak_stairs', axis: 'x', gable: 'oak_planks' },
    ] }));
    expect(at(model, 0, 0, 2)).toBe('oak_log');
    expect(at(model, 0, 1, 2)).toBe('oak_planks');
  });

  it('repeat: repete com deslocamento', () => {
    const { model } = run(JSON.stringify({ size: { x: 1, y: 9, z: 1 }, operations: [{ op: 'repeat', times: 3, offset: [0, 4, 0], operations: [{ op: 'set', at: [0, 0, 0], block: 'stone' }] }] }));
    expect(model.voxels.map((v) => v.y).sort()).toEqual([0, 4, 8]);
  });
});

describe('materiais e nomes', () => {
  it('porta e cama contam 1 item; laje dupla conta 2', () => {
    const { model } = run(JSON.stringify({ size: { x: 3, y: 2, z: 2 }, operations: [
      { op: 'set', at: [0, 0, 0], block: 'oak_door[half=lower]' },
      { op: 'set', at: [0, 1, 0], block: 'oak_door[half=upper]' },
      { op: 'set', at: [1, 0, 0], block: 'red_bed[part=foot]' },
      { op: 'set', at: [1, 0, 1], block: 'red_bed[part=head]' },
      { op: 'set', at: [2, 0, 0], block: 'oak_slab[type=double]' },
    ] }));
    const m = Object.fromEntries(computeMaterials(model.voxels).map((l) => [l.item, l.count]));
    expect(m).toEqual({ oak_door: 1, red_bed: 1, oak_slab: 2 });
  });

  it('nomes em português', () => {
    expect(blockName('stone_brick_stairs')).toBe('Escadas de tijolos de pedra');
    expect(blockName('light_blue_wool')).toBe('Lã azul-clara');
    expect(blockName('blue_wool')).toBe('Lã azul');
    expect(blockName('dark_oak_planks')).toBe('Tábuas de carvalho-escuro');
    expect(blockName('oak_planks')).toBe('Tábuas de carvalho');
    expect(blockName('cobblestone_wall')).toBe('Muro de pedregulho');
    expect(blockName('deepslate_diamond_ore')).toBe('Minério de diamante de ardósia');
  });
});

describe('formas', () => {
  it('cerca conecta com cerca vizinha e bloco sólido', () => {
    const fence = { x: 1, y: 0, z: 1, state: 'oak_fence', id: 'oak_fence', props: {} };
    const parts = partsFor(fence, lookFor('oak_fence', {}), (dx, dz) =>
      dx === 1 ? { x: 2, y: 0, z: 1, state: 'oak_fence', id: 'oak_fence', props: {} } : dz === -1 ? { x: 1, y: 0, z: 0, state: 'stone', id: 'stone', props: {} } : undefined,
    );
    expect(parts.sort()).toEqual(['fence_arm:e', 'fence_arm:n', 'fence_post']);
  });

  it('escada usa o facing e a metade', () => {
    const v = { x: 0, y: 0, z: 0, state: '', id: 'oak_stairs', props: { facing: 'east', half: 'top' } };
    expect(partsFor(v, lookFor('oak_stairs', {}), () => undefined)).toEqual(['stairs:top:e']);
  });
});
