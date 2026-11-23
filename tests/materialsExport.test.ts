import { describe, expect, it } from 'vitest';
import { buildExportItems, materialsJson, materialsText, stacksText } from '../src/blueprint/materialsExport';
import type { MaterialLine } from '../src/blueprint/materials';

const lines: MaterialLine[] = [
  { item: 'cobblestone', count: 150, stackSize: 64, stacks: 2, remainder: 22 },
  { item: 'oak_sign', count: 20, stackSize: 16, stacks: 1, remainder: 4 },
  { item: 'red_bed', count: 2, stackSize: 1, stacks: 2, remainder: 0 },
  { item: 'glass_pane', count: 128, stackSize: 64, stacks: 2, remainder: 0 },
];
const info = { name: 'Casa teste', description: 'Casinha de pedra', dimensions: '9×6×7', totalBlocks: 300, scope: 'construção inteira' };

describe('exportar lista de materiais', () => {
  it('stacks no formato pedido', () => {
    expect(stacksText(150, 64)).toBe('2 stacks + 22');
    expect(stacksText(64, 64)).toBe('1 stack');
    expect(stacksText(22, 64)).toBe('22');
    expect(stacksText(20, 16)).toBe('1 stack de 16 + 4');
    expect(stacksText(2, 1)).toBe('2 un. (não empilha)');
  });

  it('texto para IA: cabeçalho, linhas e totais; sem "tenho" quando nada foi preenchido', () => {
    const t = materialsText(info, buildExportItems(lines, { have: {}, complete: new Set() }));
    expect(t.split('\n')[0]).toBe('# Lista de materiais · Casa teste');
    expect(t).toContain('Construção: Casinha de pedra');
    expect(t).toContain('- Pedregulho (cobblestone): 150 = 2 stacks + 22');
    expect(t).toContain('Total: 300 itens de 4 tipos');
    expect(t).not.toContain('falta');
  });

  it('com "tenho": mostra o que falta; checkbox conta como tudo', () => {
    const items = buildExportItems(lines, { have: { cobblestone: 100 }, complete: new Set(['glass_pane']) });
    const t = materialsText(info, items);
    expect(t).toContain('- Pedregulho (cobblestone): 150 = 2 stacks + 22 | tenho 100 | falta 50');
    expect(t).toContain('| tenho 128 | falta 0 ✓');
    expect(t).toContain('- Cama vermelha (red_bed): 2 = 2 un. (não empilha) | tenho 0 | falta 2 = 2 un. (não empilha)');
    expect(t).toContain('Falta: 72 itens');
    const j = JSON.parse(materialsJson(info, items));
    expect(j.items[0]).toMatchObject({ id: 'cobblestone', count: 150, stacks: 2, remainder: 22, have: 100, missing: 50 });
    expect(j.totals).toMatchObject({ items: 300, types: 4, missing: 72 });
  });
});
