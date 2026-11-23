// Projeto em etapas: várias respostas da IA (partes) que se somam no mesmo espaço.
//
//   Etapa 1  Estrutura e arquitetura (+ planta com andares e cômodos)
//   Etapa 2  Detalhes de arquitetura, um andar por vez
//   Etapa 3  Mobília e decoração, um andar por vez
//   Extra    Área externa (opcional)
//
// No modo rápido há uma parte só ("completo").

import { compileParts, type CompiledModel, type PartInput } from '../blueprint/compile';
import { extractJson, parseBlueprint, type ParseResult } from '../blueprint/parse';
import type { Blueprint, Floor } from '../blueprint/types';
import type { PromptRequest } from '../prompt/builder';

export type Stage = 'completo' | 'estrutura' | 'andar' | 'decoracao' | 'exterior' | 'livre';
/** livre = automático: a própria IA divide em partes numeradas. */
export type Mode = 'rapido' | 'etapas' | 'livre';

export interface Part {
  stage: Stage;
  /** Índice do andar (etapas 2 e 3) ou número da parte (modo automático). */
  floor?: number;
  /** Resposta da IA (ou o blueprint em JSON). */
  text: string;
  visible: boolean;
  importedAt: number;
  /** Modo automático: tipo e título (quando a resposta não traz "part", ou após converter um projeto). */
  kind?: string;
  title?: string;
}

export interface Project {
  version: 1;
  name: string;
  mode: Mode;
  request?: PromptRequest;
  floors: Floor[];
  parts: Part[];
  /** Veio de um exemplo (trocar por outro não precisa confirmar). */
  fromExample?: boolean;
}

export interface Slot {
  key: string;
  stage: Stage;
  floor?: number;
  /** "1", "2a", "3b"... */
  num: string;
  title: string;
  part?: Part;
  /** As etapas de que esta depende já foram importadas. */
  ready: boolean;
  optional?: boolean;
}

export const STAGE_ORDER: Stage[] = ['completo', 'estrutura', 'andar', 'decoracao', 'exterior', 'livre'];
export const slotKey = (stage: Stage, floor?: number) => (floor === undefined ? stage : `${stage}:${floor}`);
const letter = (i: number) => String.fromCharCode(97 + (i % 26));

export function emptyProject(name = 'Novo projeto', mode: Mode = 'etapas', request?: PromptRequest): Project {
  return { version: 1, name, mode, request, floors: [], parts: [] };
}

export function findPart(p: Project, key: string): Part | undefined {
  return p.parts.find((x) => slotKey(x.stage, x.floor) === key);
}

/** Lista das etapas do projeto, na ordem em que são montadas. */
export function slotsOf(p: Project): Slot[] {
  if (p.mode === 'livre') {
    return p.parts
      .filter((x) => x.stage === 'livre')
      .sort((a, b) => (a.floor ?? 0) - (b.floor ?? 0))
      .map((part) => {
        const n = part.floor ?? 1;
        const info = parseCached(part.text).blueprint?.part;
        return { key: slotKey('livre', n), stage: 'livre' as Stage, floor: n, num: String(n), title: info?.title ?? part.title ?? `Parte ${n}`, part, ready: true };
      });
  }
  if (p.mode === 'rapido') {
    return [{ key: 'completo', stage: 'completo', num: '1', title: 'Construção completa', part: findPart(p, 'completo'), ready: true }];
  }
  const hasStructure = !!findPart(p, 'estrutura');
  const slots: Slot[] = [{ key: 'estrutura', stage: 'estrutura', num: '1', title: 'Estrutura e arquitetura', part: findPart(p, 'estrutura'), ready: true }];
  p.floors.forEach((f, i) => {
    const key = slotKey('andar', i);
    slots.push({ key, stage: 'andar', floor: i, num: `2${letter(i)}`, title: `Detalhes · ${f.name} (y ${f.yFrom}–${f.yTo})`, part: findPart(p, key), ready: hasStructure });
  });
  p.floors.forEach((f, i) => {
    const key = slotKey('decoracao', i);
    slots.push({ key, stage: 'decoracao', floor: i, num: `3${letter(i)}`, title: `Mobília e decoração · ${f.name}`, part: findPart(p, key), ready: hasStructure });
  });
  slots.push({ key: 'exterior', stage: 'exterior', num: '4', title: 'Área externa', part: findPart(p, 'exterior'), ready: hasStructure, optional: true });
  return slots;
}

/** Próxima etapa sem resposta (pulando a opcional). */
export function nextSlot(p: Project): Slot | undefined {
  if (p.mode === 'livre') return undefined;
  return slotsOf(p).find((s) => !s.part && s.ready && !s.optional);
}

/** Guarda a resposta da IA numa etapa (substitui se já havia). */
export function setPart(p: Project, stage: Stage, floor: number | undefined, text: string) {
  const key = slotKey(stage, floor);
  const old = findPart(p, key);
  p.parts = p.parts.filter((x) => slotKey(x.stage, x.floor) !== key);
  p.parts.push({ stage, floor, text, visible: old?.visible ?? true, importedAt: Date.now() });
  p.fromExample = false;
}

/** Modo automático: número da próxima parte. */
export function nextPartNumber(p: Project): number {
  return Math.max(0, ...p.parts.filter((x) => x.stage === 'livre').map((x) => x.floor ?? 0)) + 1;
}

/** Modo automático: a última parte e o que a IA disse que vem depois. */
export function lastLivre(p: Project): { slot?: Slot; next?: string; of?: number; done: boolean } {
  const slots = slotsOf(p);
  const slot = slots[slots.length - 1];
  const info = slot?.part ? parseCached(slot.part.text).blueprint?.part : undefined;
  return { slot, next: info?.next || undefined, of: info?.of, done: !!info?.done || (!!info?.of && !!info?.number && info.number >= info.of) };
}

export function removePart(p: Project, key: string) {
  p.parts = p.parts.filter((x) => slotKey(x.stage, x.floor) !== key);
}

// ---------------------------------------------------------------------------
// Montagem do modelo
// ---------------------------------------------------------------------------

const parseCache = new Map<string, ParseResult & { sizeInferred?: boolean }>();
export function parseCached(text: string) {
  let r = parseCache.get(text);
  if (!r) {
    r = parseBlueprint(text);
    if (parseCache.size > 50) parseCache.clear();
    parseCache.set(text, r);
  }
  return r;
}

export interface Built {
  model?: CompiledModel;
  /** Resultado da leitura de cada etapa, pela chave da etapa. */
  results: Map<string, ParseResult & { sizeInferred?: boolean }>;
  /** Blueprint de cada etapa (só as que abriram). */
  blueprints: Map<string, Blueprint>;
}

/** Junta as etapas visíveis num modelo só. `upTo` = só até esta etapa (para montar o contexto do prompt). */
export function buildModel(p: Project, opts: { upTo?: string; onlyVisible?: boolean; exclude?: string } = {}): Built {
  const results = new Map<string, ParseResult & { sizeInferred?: boolean }>();
  const blueprints = new Map<string, Blueprint>();
  const inputs: PartInput[] = [];
  const slots = slotsOf(p);
  for (const s of slots) {
    if (opts.upTo && s.key === opts.upTo) break;
    if (!s.part || s.key === opts.exclude) continue;
    const r = parseCached(s.part.text);
    results.set(s.key, r);
    if (!r.ok || !r.blueprint) continue;
    blueprints.set(s.key, r.blueprint);
    if (opts.onlyVisible !== false && !s.part.visible) continue;
    if (s.stage === 'livre') {
      const info = r.blueprint.part;
      const kind = info?.kind ?? s.part.kind ?? '';
      inputs.push({
        id: s.key,
        bp: r.blueprint,
        sizeInferred: r.sizeInferred,
        protectExisting: /mob|decor|exter|paisag/.test(kind),
        yRange: info?.yFrom !== undefined && info?.yTo !== undefined && !/estrut/.test(kind) ? [info.yFrom, info.yTo] : undefined,
      });
      continue;
    }
    const f = s.floor !== undefined ? p.floors[s.floor] : undefined;
    inputs.push({
      id: s.key,
      bp: r.blueprint,
      sizeInferred: r.sizeInferred,
      protectExisting: s.stage === 'decoracao' || s.stage === 'exterior',
      yRange: f && (s.stage === 'andar' || s.stage === 'decoracao') ? [f.yFrom, f.yTo] : undefined,
    });
  }
  return { model: inputs.length ? compileParts(inputs, { freeCoords: p.mode === 'livre' }) : undefined, results, blueprints };
}

// ---------------------------------------------------------------------------
// Andares
// ---------------------------------------------------------------------------

const FLOOR_NAMES = ['Térreo', '1º andar', '2º andar', '3º andar', '4º andar', '5º andar'];

/**
 * Sem planta da IA: acha os andares pelos pisos (camadas que cobrem boa parte da área da construção).
 */
export function autoFloors(model: CompiledModel): Floor[] {
  const footprint = new Set<string>();
  for (const v of model.voxels) footprint.add(`${v.x},${v.z}`);
  const area = footprint.size || 1;
  const top = model.size.y - 1;
  const slabs: number[] = [];
  for (let y = 0; y <= top; y++) {
    const cover = (model.byLayer.get(y)?.length ?? 0) / area;
    if (cover >= 0.55 && (slabs.length === 0 || y - slabs[slabs.length - 1] > 2)) slabs.push(y);
  }
  // o último "piso" muito perto do topo costuma ser o forro/telhado: junta com o andar de baixo
  while (slabs.length > 1 && top - slabs[slabs.length - 1] < 2) slabs.pop();
  // andares nas coordenadas do projeto (interno − offset)
  const oy = model.offset[1];
  if (slabs.length <= 1) return [{ name: 'Construção inteira', yFrom: -oy, yTo: top - oy }];
  const floors: Floor[] = [];
  slabs.forEach((y, i) => {
    const yFrom = i === 0 ? 0 : y;
    const yTo = i + 1 < slabs.length ? slabs[i + 1] - 1 : top;
    floors.push({ name: FLOOR_NAMES[i] ?? `${i}º andar`, yFrom: yFrom - oy, yTo: yTo - oy });
  });
  return floors;
}

/** Depois de importar a estrutura: pega os andares da planta (ou adivinha). */
export function refreshFloors(p: Project) {
  const key = p.mode === 'rapido' ? 'completo' : p.mode === 'livre' ? slotsOf(p)[0]?.key ?? '' : 'estrutura';
  const part = findPart(p, key);
  if (!part) return;
  const r = parseCached(part.text);
  if (!r.ok || !r.blueprint) return;
  if (r.blueprint.plan?.floors.length) p.floors = r.blueprint.plan.floors.map((f) => ({ ...f }));
  else {
    const structOnly = buildModel({ ...p, parts: [part] }, { onlyVisible: false }).model;
    p.floors = structOnly ? autoFloors(structOnly) : [];
  }
  if (r.blueprint.meta.name && r.blueprint.meta.name !== 'Sem nome' && (p.name === 'Novo projeto' || !p.name)) p.name = r.blueprint.meta.name;
}

/**
 * Qualquer projeto (rápido, por andares, aberto de arquivo) vira automático, mantendo as partes
 * na mesma ordem — assim dá para continuar alterando e ampliando com a IA.
 */
export function convertToAuto(p: Project) {
  if (p.mode === 'livre') return;
  const KIND: Record<Stage, string> = { completo: 'estrutura', estrutura: 'estrutura', andar: 'detalhe', decoracao: 'mobilia', exterior: 'exterior', livre: 'outro' };
  const ordered = slotsOf(p).filter((s) => s.part);
  p.parts = ordered.map((s, i) => ({ ...s.part!, stage: 'livre' as Stage, floor: i + 1, kind: KIND[s.stage], title: s.title }));
  p.mode = 'livre';
  p.fromExample = false;
}

/** Transforma um projeto rápido (1 parte) em projeto em etapas, usando a construção como estrutura. */
export function convertToStages(p: Project) {
  const part = findPart(p, 'completo');
  if (!part) return;
  p.mode = 'etapas';
  part.stage = 'estrutura';
  p.fromExample = false;
  refreshFloors(p);
}

// ---------------------------------------------------------------------------
// Arquivo de projeto (exportar / importar)
// ---------------------------------------------------------------------------

export const PROJECT_FORMAT = 'mc-blueprint-project';

export function exportProject(p: Project): string {
  const parts = p.parts.map((part) => {
    const r = parseCached(part.text);
    return {
      stage: part.stage,
      ...(part.floor !== undefined ? { floor: part.floor } : {}),
      visible: part.visible,
      ...(r.ok && r.blueprint ? { blueprint: r.blueprint } : { text: part.text }),
    };
  });
  const out = { format: PROJECT_FORMAT, version: 1, name: p.name, mode: p.mode, request: p.request, floors: p.floors, parts };
  return JSON.stringify(out, null, 2).replace(/\[\s+(-?\d+),\s+(-?\d+),\s+(-?\d+)\s+\]/g, '[$1, $2, $3]');
}

/** Se o texto for um arquivo de projeto, devolve o projeto. Senão, undefined. */
export function importProject(text: string): Project | undefined {
  const { data } = extractJson(text);
  if (!data || typeof data !== 'object' || data.format !== PROJECT_FORMAT || !Array.isArray(data.parts)) return undefined;
  const mode: Mode = data.mode === 'rapido' ? 'rapido' : data.mode === 'livre' ? 'livre' : 'etapas';
  const parts: Part[] = data.parts
    .filter((x: any) => x && STAGE_ORDER.includes(x.stage) && (x.blueprint || typeof x.text === 'string'))
    .map((x: any) => ({
      stage: x.stage as Stage,
      floor: typeof x.floor === 'number' ? x.floor : undefined,
      text: x.blueprint ? JSON.stringify(x.blueprint) : x.text,
      visible: x.visible !== false,
      importedAt: Date.now(),
    }));
  const p: Project = {
    version: 1,
    name: typeof data.name === 'string' ? data.name : 'Projeto',
    mode,
    request: data.request,
    floors: Array.isArray(data.floors) ? data.floors : [],
    parts,
  };
  // sem lista de andares salva: tira da planta da estrutura (com os cômodos)
  if (!p.floors.length) refreshFloors(p);
  return p;
}

// ---------------------------------------------------------------------------
// Guardar no navegador
// ---------------------------------------------------------------------------

const KEY = 'fizzi-mine:projeto';

export function saveProject(p: Project) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* sem armazenamento ou grande demais */
  }
}

export function loadProject(): Project | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    const p = JSON.parse(raw);
    return p && p.version === 1 && Array.isArray(p.parts) ? p : undefined;
  } catch {
    return undefined;
  }
}
