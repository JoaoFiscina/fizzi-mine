import { describe, expect, it } from 'vitest';
import { dominantWood, rawMaterials, recipeFor } from '../src/blueprint/recipes';

const raw = (needs: Record<string, number>, opts = {}) => {
  const r = rawMaterials(new Map(Object.entries(needs)), opts);
  return { ...r, rawObj: Object.fromEntries(r.raw) };
};

describe('itens brutos', () => {
  it('madeira: escadas arredondam por receita até troncos', () => {
    // 10 escadas = 3 receitas (12) = 18 tábuas = 5 receitas de tábua = 5 troncos
    const r = raw({ spruce_stairs: 10 });
    expect(r.rawObj).toEqual({ spruce_log: 5 });
    expect(r.steps.map((s) => [s.item, s.times])).toEqual([['spruce_planks', 5], ['spruce_stairs', 3]]);
  });

  it('pedra: tijolos de pedra vêm de pedregulho queimado, com carvão', () => {
    const r = raw({ stone_bricks: 64 });
    expect(r.rawObj).toEqual({ cobblestone: 64 });
    expect(r.smelts).toBe(64);
    expect(r.fuelCoal).toBe(8);
  });

  it('cortador de pedras economiza', () => {
    expect(raw({ cobblestone_stairs: 12 }).rawObj).toEqual({ cobblestone: 18 });
    expect(raw({ cobblestone_stairs: 12 }, { stonecutter: true }).rawObj).toEqual({ cobblestone: 12 });
  });

  it('vidro, painel e lanterna', () => {
    const r = raw({ glass_pane: 16, lantern: 1 }, { stickWood: 'oak' });
    expect(r.rawObj.sand).toBe(6);
    expect(r.rawObj.iron_ingot).toBe(1); // 8 pepitas = 1 barra
    expect(r.rawObj.coal).toBe(1); // tocha da lanterna
    expect(r.rawObj.oak_log).toBe(1); // graveto
  });

  it('item compartilhado soma antes de arredondar', () => {
    // 1 cerca (4 tábuas + 2 gravetos) + 1 porta (6 tábuas → 3 portas)
    const r = raw({ oak_fence: 3, oak_door: 3 });
    // tábuas: 4 + 6 + 1 (2 gravetos = 1 receita = 2 tábuas → 4 gravetos) = 12 → 3 troncos
    expect(r.rawObj).toEqual({ oak_log: 3 });
  });

  it('desconhecido conta como bruto; madeira dominante', () => {
    expect(raw({ diamond_block: 2 }).rawObj).toEqual({ diamond_block: 2 });
    expect(recipeFor('oak_log')).toBeUndefined();
    expect(dominantWood(['spruce_planks', 'spruce_stairs', 'oak_door'])).toBe('spruce');
  });
});

describe('itens brutos: casos do app', () => {
  it('cama usa tábuas da madeira escolhida; lã branca é bruta', () => {
    const r = rawMaterials(new Map([['red_bed', 1]]), { stickWood: 'spruce' });
    const o = Object.fromEntries(r.raw);
    expect(o).toEqual({ white_wool: 3, red_dye: 3, spruce_log: 1 });
    expect(Object.keys(o).some((k) => k.startsWith('__'))).toBe(false);
  });
});
