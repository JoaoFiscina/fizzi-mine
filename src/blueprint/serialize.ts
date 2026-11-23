// Transforma o modelo já montado de volta em texto:
//  - para mandar à IA como "estado atual" nas etapas 2 e 3 (ela relê a arquitetura);
//  - para exportar tudo como um blueprint único.

import type { CompiledModel, Voxel } from './compile';
import type { Blueprint, Layer, Plan, Step } from './types';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#$%&*+=?@^~!|/<>;:-_(){}';

export interface RegionText {
  palette: Record<string, string>;
  layers: Layer[];
}

/** Camadas (com paleta automática) de y0 até y1, só com os voxels aceitos pelo filtro. */
export function regionToLayers(model: CompiledModel, y0: number, y1: number, filter: (v: Voxel) => boolean = () => true): RegionText {
  const { size } = model;
  const counts = new Map<string, number>();
  for (let y = y0; y <= y1; y++)
    for (const v of model.byLayer.get(y) ?? []) if (filter(v)) counts.set(v.state, (counts.get(v.state) ?? 0) + 1);

  // estados mais usados ganham as primeiras letras; se faltar letra, junta pelo ID
  const states = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)!);
  const charOf = new Map<string, string>();
  const palette: Record<string, string> = {};
  const byId = new Map<string, string>();
  for (const st of states) {
    const id = st.split('[')[0];
    if (charOf.size < CHARS.length) {
      const c = CHARS[charOf.size];
      charOf.set(st, c);
      palette[c] = st;
      if (!byId.has(id)) byId.set(id, c);
    } else charOf.set(st, byId.get(id) ?? '?');
  }

  const layers: Layer[] = [];
  for (let y = y0; y <= y1; y++) {
    const rows = Array.from({ length: size.z }, () => Array(size.x).fill('.'));
    let any = false;
    for (const v of model.byLayer.get(y) ?? []) {
      if (!filter(v)) continue;
      rows[v.z][v.x] = charOf.get(v.state) ?? '?';
      any = true;
    }
    if (any) layers.push({ y, rows: rows.map((r) => r.join('')) });
  }
  return { palette, layers };
}

/** Área ocupada, nas coordenadas do projeto (podem ser negativas). */
export function boundsText(model: CompiledModel): string {
  const [ox, oy, oz] = model.offset;
  const { size } = model;
  return `x de ${-ox} a ${size.x - 1 - ox}, y de ${-oy} a ${size.y - 1 - oy}, z de ${-oz} a ${size.z - 1 - oz}`;
}

/**
 * Texto para colar no prompt: área, paleta e camadas de y0 a y1.
 * y0/y1 e tudo o que é escrito estão nas COORDENADAS DO PROJETO (as que a IA usa), não nas internas.
 */
export function regionToPromptText(model: CompiledModel, y0: number, y1: number): string {
  const [ox, oy, oz] = model.offset;
  const iy0 = Math.max(0, y0 + oy);
  const iy1 = Math.min(model.size.y - 1, y1 + oy);
  const { palette, layers } = regionToLayers(model, iy0, iy1);
  const lines = [
    `size do projeto: ${JSON.stringify(model.size)} · área ocupada: ${boundsText(model)}`,
    `Paleta do estado atual (só para você ler; na resposta use a sua própria paleta): ${JSON.stringify(palette)}`,
    `Camadas atuais de y=${iy0 - oy} até y=${iy1 - oy}. Em cada camada, a 1ª linha é z=${-oz} (norte) e o 1º caractere de cada linha é x=${-ox} (oeste); "." = vazio:`,
  ];
  if (!layers.length) lines.push('(nenhum bloco nessa faixa ainda)');
  for (const l of layers) lines.push(`y=${l.y - oy}`, ...l.rows);
  return lines.join('\n');
}

/** Tamanho aproximado (em caracteres) do texto de uma faixa, para avisar antes de copiar. */
export function regionTextSize(model: CompiledModel, y0: number, y1: number): number {
  const n = Math.max(0, Math.min(model.size.y - 1, y1 + model.offset[1]) - Math.max(0, y0 + model.offset[1]) + 1);
  return n * (model.size.z * (model.size.x + 1) + 6) + 400;
}

/** Tudo o que está visível vira um blueprint só (camadas com paleta automática). */
export function flattenToBlueprint(
  model: CompiledModel,
  info: { name: string; description?: string; category?: string; minecraftVersion?: string; plan?: Plan; steps?: Step[]; notes?: string[] },
): Blueprint {
  const { palette, layers } = regionToLayers(model, 0, model.size.y - 1);
  return {
    format: 'mc-blueprint',
    version: 1,
    meta: { name: info.name, description: info.description, category: info.category, minecraftVersion: info.minecraftVersion },
    size: { ...model.size },
    ...(info.plan ? { plan: info.plan } : {}),
    palette,
    layers,
    ...(info.steps?.length ? { steps: info.steps } : {}),
    ...(info.notes?.length ? { notes: info.notes } : {}),
  };
}
