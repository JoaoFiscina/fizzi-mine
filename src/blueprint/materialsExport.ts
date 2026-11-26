// Exportar a lista de materiais: texto para colar numa IA, .txt e .json.

import type { MaterialLine } from './materials';
import { itemName } from './names';
import type { RawResult } from './recipes';

export interface ExportInfo {
  name: string;
  description?: string;
  minecraftVersion?: string;
  /** Ex.: "41×20×31" */
  dimensions?: string;
  totalBlocks?: number;
  /** Qual parte da construção a lista cobre (tudo, até a camada y, só a camada y). */
  scope: string;
}

/** Quanto já tem de cada item. Item marcado como "já tenho" (checkbox) conta como tudo. */
export interface HaveInfo {
  have: Record<string, number>;
  complete: Set<string>;
}

export interface ExportItem {
  id: string;
  name: string;
  count: number;
  stackSize: number;
  stacks: number;
  remainder: number;
  /** Texto: "2 stacks + 22" */
  inStacks: string;
  have: number;
  missing: number;
  missingInStacks: string;
}

/** "150 = 2 stacks + 22" → devolve "2 stacks + 22" (ou "22", "3 stacks", "5 un. (não empilha)"). */
export function stacksText(count: number, stackSize: number): string {
  if (count <= 0) return '0';
  if (stackSize === 1) return `${count} un. (não empilha)`;
  const s = Math.floor(count / stackSize);
  const r = count % stackSize;
  const unit = stackSize === 64 ? 'stack' : `stack de ${stackSize}`;
  const unitP = stackSize === 64 ? 'stacks' : `stacks de ${stackSize}`;
  if (!s) return `${r}`;
  const st = `${s} ${s === 1 ? unit : unitP}`;
  return r ? `${st} + ${r}` : st;
}

export function buildExportItems(lines: MaterialLine[], h: HaveInfo): ExportItem[] {
  return lines.map((l) => {
    const have = h.complete.has(l.item) ? l.count : Math.min(l.count, Math.max(0, Math.floor(h.have[l.item] ?? 0)));
    const missing = l.count - have;
    return {
      id: l.item,
      name: itemName(l.item),
      count: l.count,
      stackSize: l.stackSize,
      stacks: l.stacks,
      remainder: l.remainder,
      inStacks: stacksText(l.count, l.stackSize),
      have,
      missing,
      missingInStacks: stacksText(missing, l.stackSize),
    };
  });
}

const shulkers = (items: ExportItem[], key: 'count' | 'missing') =>
  Math.ceil(items.reduce((a, i) => a + Math.ceil(i[key] / i.stackSize), 0) / 27);

/** Texto pronto para colar numa IA. */
export function materialsText(info: ExportInfo, items: ExportItem[], raw?: RawResult): string {
  const total = items.reduce((a, i) => a + i.count, 0);
  const missing = items.reduce((a, i) => a + i.missing, 0);
  const anyHave = items.some((i) => i.have > 0);
  const lines = [
    `# Lista de materiais · ${info.name}`,
    info.description ? `Construção: ${info.description}` : '',
    `Minecraft Java ${info.minecraftVersion ?? '1.21'}${info.dimensions ? ` · tamanho ${info.dimensions} (L-O × altura × N-S)` : ''}${info.totalBlocks ? ` · ${info.totalBlocks.toLocaleString('pt-BR')} blocos` : ''} · lista de: ${info.scope}.`,
    `Stacks de 64 (placas/estandartes: 16; camas/baldes: não empilham). 1 shulker = 27 stacks.`,
    '',
    anyHave ? 'Bloco (id): total = em stacks | já tenho | falta' : 'Bloco (id): total = em stacks',
  ];
  // "150 = 2 stacks + 22"; abaixo de 1 stack fica só o número
  const qty = (n: number, s: string) => (s === String(n) ? `${n}` : `${n} = ${s}`);
  for (const i of items) {
    const base = `- ${i.name} (${i.id}): ${qty(i.count, i.inStacks)}`;
    lines.push(anyHave ? `${base} | tenho ${i.have} | falta ${i.missing ? qty(i.missing, i.missingInStacks) : '0 ✓'}` : base);
  }
  lines.push('');
  lines.push(`Total: ${total.toLocaleString('pt-BR')} itens de ${items.length} tipos (~${shulkers(items, 'count')} shulker(s)).`);
  if (anyHave) lines.push(`Falta: ${missing.toLocaleString('pt-BR')} itens (~${shulkers(items, 'missing')} shulker(s)).`);
  if (raw && raw.raw.size) {
    lines.push('', `## Itens brutos para coletar${anyHave ? ' (só para o que falta)' : ''}`);
    for (const [item, n] of [...raw.raw.entries()].sort((a, b) => b[1] - a[1])) lines.push(`- ${itemName(item)} (${item}): ${qty(n, stacksText(n, 64))}`);
    if (raw.smelts) lines.push(`- Carvão para a fornalha: ${raw.fuelCoal} (${raw.smelts} itens para queimar)`);
    lines.push('', '## Crafting / fornalha (na ordem)');
    for (const s of raw.steps) {
      const ins = Object.entries(s.in).map(([k, v]) => `${v} ${itemName(k).toLowerCase()}`).join(' + ');
      lines.push(`- ${s.how === 'smelt' ? 'Fornalha' : s.how === 'stonecutter' ? 'Cortador' : s.how === 'other' ? 'Ferramenta' : 'Bancada'}: ${s.times}× → ${s.produced} ${itemName(s.item).toLowerCase()} (usa ${ins})`);
    }
  }
  lines.push('', 'Me ajude com essa lista: planejar a coleta (onde e como conseguir cada bloco, em que ordem), sugerir substituições mais fáceis que combinem com o estilo e conferir as contas de stacks e shulkers.');
  return lines.filter((l, idx) => l !== '' || lines[idx - 1] !== '').join('\n').replace(/^\n+/, '');
}

export function materialsJson(info: ExportInfo, items: ExportItem[], raw?: RawResult): string {
  return JSON.stringify(
    {
      format: 'mc-materials',
      version: 1,
      name: info.name,
      description: info.description,
      minecraftVersion: info.minecraftVersion,
      dimensions: info.dimensions,
      totalBlocks: info.totalBlocks,
      scope: info.scope,
      generatedAt: new Date().toISOString(),
      totals: {
        items: items.reduce((a, i) => a + i.count, 0),
        types: items.length,
        missing: items.reduce((a, i) => a + i.missing, 0),
        shulkers: shulkers(items, 'count'),
      },
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        count: i.count,
        stackSize: i.stackSize,
        stacks: i.stacks,
        remainder: i.remainder,
        inStacks: i.inStacks,
        have: i.have,
        missing: i.missing,
      })),
      ...(raw
        ? {
            raw: [...raw.raw.entries()].map(([id, count]) => ({ id, name: itemName(id), count })),
            fuelCoal: raw.fuelCoal,
            craftSteps: raw.steps.map((s) => ({ item: s.item, how: s.how, times: s.times, produced: s.produced, uses: s.in })),
          }
        : {}),
    },
    null,
    2,
  );
}
