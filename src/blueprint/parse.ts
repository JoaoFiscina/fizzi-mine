// Leitura tolerante da resposta da IA.
//
// A ideia: aceitar o que a IA mandar (texto antes/depois, ```json, comentários, vírgula sobrando,
// nomes de campo diferentes, coordenadas como texto, IDs de bloco escritos errado...) e
// consertar sozinho tudo que for inequívoco. O que não dá para consertar com segurança vira
// "aviso" — e os avisos viram uma mensagem pronta para mandar de volta para a IA corrigir.

import type { Blueprint, Floor, Layer, Operation, PartInfo, Plan, Room, Step, Vec3 } from './types';
import { BLOCK_ALIASES, KNOWN_BLOCKS, suggestBlock } from './knownBlocks';

export interface ParseResult {
  ok: boolean;
  /** Impedem de abrir o arquivo. */
  errors: string[];
  /** Provavelmente erro da IA: vão na mensagem de correção. */
  warnings: string[];
  /** O que foi consertado automaticamente (só informativo). */
  fixes: string[];
  /** A resposta da IA foi cortada no meio. */
  truncated?: boolean;
  blueprint?: Blueprint;
}

const MAX_VOLUME = 8_000_000;

// =====================================================================
// 1) Achar o JSON dentro do texto
// =====================================================================

/** Remove comentários (// e /* *\/) e vírgulas antes de } ou ], sem mexer no que está dentro de strings. */
export function cleanJsonish(src: string): string {
  let out = '';
  let inStr = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      out += c;
      if (c === '\\') out += src[++i] ?? '';
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      out += c;
    } else if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i++;
    } else out += c;
  }
  // vírgulas sobrando
  let res = '';
  inStr = false;
  for (let i = 0; i < out.length; i++) {
    const c = out[i];
    if (inStr) {
      res += c;
      if (c === '\\') res += out[++i] ?? '';
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    if (c === ',') {
      let j = i + 1;
      while (j < out.length && /\s/.test(out[j])) j++;
      if (out[j] === '}' || out[j] === ']') continue;
    }
    res += c;
  }
  return res;
}

function straightQuotes(s: string): string {
  return s.replace(/[“”„‟″]/g, '"').replace(/[‘’‚‛′]/g, "'");
}

function candidates(text: string): string[] {
  const list: string[] = [];
  const fence = /```[\w-]*[ \t]*\r?\n?([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(text))) list.push(m[1]);
  // bloco ``` aberto e nunca fechado (resposta cortada)
  if ((text.match(/```/g)?.length ?? 0) % 2 === 1) {
    const open = text.lastIndexOf('```');
    list.push(text.slice(open).replace(/^```[\w-]*/, ''));
  }
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0) list.push(last > first ? text.slice(first, last + 1) : text.slice(first));
  list.push(text);
  // maiores primeiro (o JSON costuma ser o maior bloco)
  return [...new Set(list.map((s) => s.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
}

const looksLikeBlueprint = (d: any) =>
  d && typeof d === 'object' && !Array.isArray(d) && ('size' in d || 'layers' in d || 'operations' in d || 'format' in d || 'blueprint' in d);

/** Conta { e [ abertos fora de strings: > 0 no fim = JSON cortado. */
function openDepth(s: string): number {
  let depth = 0;
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') depth--;
  }
  return depth;
}

function describeJsonError(src: string, err: Error): string {
  const msg = err.message;
  const pos = Number(msg.match(/position (\d+)/)?.[1]);
  let where = '';
  if (Number.isFinite(pos)) {
    const before = src.slice(0, pos);
    const line = before.split('\n').length;
    const col = pos - before.lastIndexOf('\n');
    const snippet = src.slice(Math.max(0, pos - 30), pos + 30).replace(/\s+/g, ' ');
    where = ` (linha ${line}, coluna ${col}, perto de: "…${snippet}…")`;
  }
  return `O JSON tem um erro de sintaxe${where}. Detalhe técnico: ${msg}`;
}

export function extractJson(text: string): { data?: any; fixes: string[]; error?: string; truncated?: boolean } {
  if (!text.trim()) return { fixes: [], error: 'Nada para ler: o texto está vazio.' };
  const cands = candidates(text);
  let fallback: { data: any; fixes: string[] } | undefined;

  for (const c of cands) {
    const variants: [string, string | null][] = [
      [c, null],
      [cleanJsonish(c), 'Removi comentários e vírgulas sobrando do JSON.'],
      [cleanJsonish(straightQuotes(c)), 'Troquei aspas “curvas” por aspas normais no JSON.'],
    ];
    for (const [v, fix] of variants) {
      try {
        let data = JSON.parse(v);
        if (Array.isArray(data) && data.length === 1) data = data[0];
        const fixes = fix ? [fix] : [];
        if (looksLikeBlueprint(data)) return { data, fixes };
        if (!fallback && data && typeof data === 'object') fallback = { data, fixes };
      } catch {
        /* tenta o próximo */
      }
    }
  }
  if (fallback) return fallback;

  const main = cands.find((c) => c.startsWith('{')) ?? cands[0];
  if (openDepth(cleanJsonish(main)) > 0) {
    return {
      fixes: [],
      truncated: true,
      error: 'A resposta da IA foi cortada no meio: o JSON começa mas não termina. Isso acontece quando a resposta fica longa demais.',
    };
  }
  try {
    JSON.parse(cleanJsonish(main));
  } catch (e) {
    return { fixes: [], error: describeJsonError(cleanJsonish(main), e as Error) };
  }
  return { fixes: [], error: 'Não encontrei um objeto JSON no texto.' };
}

// =====================================================================
// 2) Normalizar: consertar formatos alternativos e IDs de bloco
// =====================================================================

class Ctx {
  fixes = new Map<string, number>();
  warnings = new Map<string, number>();
  errors: string[] = [];
  blockCache = new Map<string, string | undefined>();
  fix(msg: string) {
    this.fixes.set(msg, (this.fixes.get(msg) ?? 0) + 1);
  }
  warn(msg: string) {
    this.warnings.set(msg, (this.warnings.get(msg) ?? 0) + 1);
  }
  static list(m: Map<string, number>, limit = 60): string[] {
    return [...m.entries()].slice(0, limit).map(([k, n]) => (n > 1 ? `${k} (×${n})` : k));
  }
}

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const pick = (o: Record<string, any>, ...keys: string[]) => {
  for (const k of keys) if (o[k] !== undefined) return o[k];
  return undefined;
};

function toInt(v: unknown, ctx: Ctx): number | undefined {
  let n: number;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) {
    n = Number(v);
    ctx.fix('Converti números escritos como texto ("5") em números.');
  } else return undefined;
  if (!Number.isFinite(n)) return undefined;
  if (!Number.isInteger(n)) {
    ctx.fix('Arredondei coordenadas com casas decimais para números inteiros.');
    n = Math.round(n);
  }
  return n;
}

function toVec(v: unknown, ctx: Ctx): Vec3 | undefined {
  let arr: unknown[] | undefined;
  if (Array.isArray(v)) arr = v;
  else if (typeof v === 'string') {
    arr = v.replace(/[()[\]]/g, '').split(/[\s,;]+/).filter(Boolean);
    ctx.fix('Converti coordenadas escritas como texto ("1,2,3") em [x, y, z].');
  } else if (isObj(v) && 'x' in v && 'y' in v && 'z' in v) {
    arr = [v.x, v.y, v.z];
    ctx.fix('Converti coordenadas {x, y, z} em [x, y, z].');
  }
  if (!arr || arr.length !== 3) return undefined;
  const out = arr.map((n) => toInt(n, ctx));
  return out.every((n) => n !== undefined) ? (out as Vec3) : undefined;
}

/** Normaliza um ID de bloco: minúsculas, sem "minecraft:", nomes alternativos, erros de digitação. */
export function normalizeBlock(raw: unknown, ctx: Ctx): string | undefined {
  if (isObj(raw)) {
    const id = pick(raw, 'id', 'name', 'block', 'type');
    const props = pick(raw, 'properties', 'props', 'state', 'states');
    if (typeof id !== 'string') return undefined;
    ctx.fix('Converti blocos escritos como objeto ({ "name": ... }) em texto.');
    raw = isObj(props) ? `${id}[${Object.entries(props).map(([k, v]) => `${k}=${v}`).join(',')}]` : id;
  }
  if (typeof raw !== 'string') return undefined;
  if (ctx.blockCache.has(raw)) return ctx.blockCache.get(raw);

  const m = raw.trim().match(/^([^[{]+?)\s*(?:[[{](.*)[\]}])?\s*$/);
  if (!m) {
    ctx.warn(`Bloco ilegível: "${raw}"`);
    ctx.blockCache.set(raw, undefined);
    return undefined;
  }
  const original = m[1].trim();
  let id = original.toLowerCase().replace(/^minecraft:/, '').replace(/[\s-]+/g, '_').replace(/grey/g, 'gray').replace(/^silver_/, 'light_gray_');

  let props = '';
  if (m[2]?.trim()) {
    props = m[2]
      .split(',')
      .map((p) => p.trim().toLowerCase().replace(/\s+/g, '').replace(/[:]/, '=').replace(/"/g, ''))
      .filter((p) => p.includes('='))
      .join(',');
  }

  if (BLOCK_ALIASES[id]) {
    ctx.fix(`Bloco "${original}" → "${BLOCK_ALIASES[id]}"`);
    id = BLOCK_ALIASES[id];
  } else if (id !== original && KNOWN_BLOCKS.has(id) && original.toLowerCase().replace(/^minecraft:/, '') !== id) {
    ctx.fix(`Bloco "${original}" → "${id}"`);
  }

  if (!KNOWN_BLOCKS.has(id)) {
    const s = suggestBlock(id);
    if (s && s.unique && s.distance <= 2 && id.length >= 5) {
      ctx.fix(`Bloco "${original}" → "${s.id}" (erro de digitação)`);
      id = s.id;
    } else {
      ctx.warn(`Bloco desconhecido "${id}"${s ? ` (será que é "${s.id}"?)` : ''}. Use o ID exato do Minecraft Java.`);
    }
  }
  const result = props ? `${id}[${props}]` : id;
  ctx.blockCache.set(raw, result);
  return result;
}

const OP_ALIASES: Record<string, Operation['op']> = {
  fill: 'fill', box: 'fill', cube: 'fill', cuboid: 'fill', fill_box: 'fill', solid: 'fill', rect: 'fill', rectangle: 'fill',
  floor: 'fill', platform: 'fill', slab_area: 'fill', area: 'fill',
  hollow: 'hollow', hollow_box: 'hollow', shell: 'hollow', room: 'hollow',
  walls: 'walls', wall: 'walls', outline: 'walls', perimeter: 'walls', ring: 'walls', frame: 'walls',
  line: 'line', pillar: 'line', column: 'line', beam: 'line', row: 'line',
  set: 'set', place: 'set', block: 'set', point: 'set', single: 'set', put: 'set', setblock: 'set',
  clear: 'clear', air: 'clear', remove: 'clear', delete: 'clear', empty: 'clear', erase: 'clear', carve: 'clear',
  roof: 'roof', gable: 'roof', gable_roof: 'roof', pitched_roof: 'roof',
  repeat: 'repeat', array: 'repeat', copy: 'repeat', loop: 'repeat', clone: 'repeat',
};

function normalizeOp(raw: unknown, i: string, ctx: Ctx): Operation | undefined {
  if (!isObj(raw)) {
    ctx.warn(`operations[${i}] não é um objeto e foi ignorada.`);
    return undefined;
  }
  let o = raw;
  // forma { "fill": { from, to, block } }
  const keys = Object.keys(o);
  if (keys.length === 1 && OP_ALIASES[keys[0].toLowerCase()] && isObj(o[keys[0]])) {
    o = { op: keys[0], ...o[keys[0]] };
    ctx.fix('Converti operações no formato { "fill": {...} } para { "op": "fill", ... }.');
  }

  let opName: unknown = pick(o, 'op', 'action', 'kind', 'shape', 'command');
  let typeUsedAsOp = false;
  if (opName === undefined && typeof o.type === 'string' && OP_ALIASES[o.type.toLowerCase()]) {
    opName = o.type;
    typeUsedAsOp = true;
  }
  const key = typeof opName === 'string' ? opName.toLowerCase().trim() : '';
  const op = OP_ALIASES[key];
  if (!op) {
    ctx.warn(`operations[${i}]: operação "${String(opName)}" não existe (use set, fill, hollow, walls, line, clear, roof ou repeat). Foi ignorada.`);
    return undefined;
  }
  if (key !== op) ctx.fix(`Operação "${key}" → "${op}"`);
  const note = typeof o.note === 'string' ? o.note : undefined;

  if (op === 'repeat') {
    const times = toInt(pick(o, 'times', 'count', 'repeat', 'n'), ctx);
    const offset = toVec(pick(o, 'offset', 'step', 'delta', 'shift'), ctx);
    const inner = pick(o, 'operations', 'ops', 'children', 'items');
    if (!times || times < 1 || !offset || !Array.isArray(inner)) {
      ctx.warn(`operations[${i}] (repeat): precisa de "times" (≥1), "offset" [dx,dy,dz] e "operations" [...]. Foi ignorada.`);
      return undefined;
    }
    const ops = inner.map((r, j) => normalizeOp(r, `${i}.${j}`, ctx)).filter((x): x is Operation => !!x);
    return { op, times: Math.min(times, 256), offset, operations: ops, note };
  }

  const blockRaw = pick(o, 'block', 'material', 'blockId', 'block_id', 'id', 'state', 'blockState', ...(typeUsedAsOp ? [] : ['type']));
  const block = op === 'clear' ? undefined : normalizeBlock(blockRaw, ctx);
  if (op !== 'clear' && !block) {
    ctx.warn(`operations[${i}] (${op}): falta o bloco ("block"). Foi ignorada.`);
    return undefined;
  }

  if (op === 'set') {
    const at = toVec(pick(o, 'at', 'pos', 'position', 'coords', 'coord', 'xyz', 'location', 'from'), ctx);
    if (!at) {
      ctx.warn(`operations[${i}] (set): "at" precisa ser [x, y, z]. Foi ignorada.`);
      return undefined;
    }
    return { op, at, block: block!, note };
  }

  let from = toVec(pick(o, 'from', 'start', 'p1', 'pos1', 'min', 'corner1', 'a'), ctx);
  let to = toVec(pick(o, 'to', 'end', 'p2', 'pos2', 'max', 'corner2', 'b'), ctx);
  if (!from && !to) {
    const at = toVec(pick(o, 'at', 'pos', 'position'), ctx);
    if (at) {
      from = to = at;
      ctx.fix(`Operação "${op}" com "at": usei como from = to.`);
    }
  }
  if (!from || !to) {
    ctx.warn(`operations[${i}] (${op}): "from" e "to" precisam ser [x, y, z]. Foi ignorada.`);
    return undefined;
  }

  if (op === 'clear') return { op, from, to, note };
  if (op === 'roof') {
    let axis: 'x' | 'z' | undefined;
    const ax = String(pick(o, 'axis', 'ridge_axis', 'direction', 'orientation') ?? '').toLowerCase();
    if (/^(x|ew|we|east|west|leste|oeste|e-w|east-west|leste-oeste)/.test(ax)) axis = 'x';
    else if (/^(z|ns|sn|north|south|norte|sul|n-s|north-south|norte-sul)/.test(ax)) axis = 'z';
    const ridge = pick(o, 'ridge', 'top', 'cap') !== undefined ? normalizeBlock(pick(o, 'ridge', 'top', 'cap'), ctx) : undefined;
    const gable = pick(o, 'gable', 'gable_block', 'fill', 'ends') !== undefined ? normalizeBlock(pick(o, 'gable', 'gable_block', 'fill', 'ends'), ctx) : undefined;
    if (!/_stairs$/.test(block!.split('[')[0])) ctx.warn(`operations[${i}] (roof): o bloco deveria ser uma escada (ex.: spruce_stairs), mas é "${block}".`);
    return { op, from, to, block: block!, axis, ridge, gable, note };
  }
  return { op, from, to, block: block!, note };
}

function normalizeRows(rows: unknown, ctx: Ctx): string[] | undefined {
  if (typeof rows === 'string') {
    ctx.fix('Separei camadas escritas como um texto só (com quebras de linha) em linhas.');
    const lines = rows.split(/\r?\n/);
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    return lines;
  }
  if (!Array.isArray(rows)) return undefined;
  return rows.map((r) => {
    if (typeof r === 'string') return r;
    if (Array.isArray(r)) {
      ctx.fix('Juntei linhas de camada escritas como lista (["A","B"]) em texto ("AB").');
      return r.map((c) => (c === null || c === undefined || c === '' ? '.' : String(c)[0])).join('');
    }
    return String(r ?? '');
  });
}

function normalizeLayers(raw: unknown, ctx: Ctx, sizeX: number | undefined): Layer[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (isObj(raw)) {
    list = Object.entries(raw).map(([k, v]) => (Array.isArray(v) || typeof v === 'string' ? { y: k, rows: v } : { y: k, ...(v as object) }));
    ctx.fix('Converti "layers" escrito como objeto { "0": [...] } em lista.');
  }
  const out: Layer[] = [];
  list.forEach((l, i) => {
    let obj: Record<string, any>;
    if (Array.isArray(l) || typeof l === 'string') {
      obj = { y: i, rows: l };
      ctx.fix('Camadas sem "y": usei a posição na lista (0, 1, 2...).');
    } else if (isObj(l)) obj = l;
    else {
      ctx.warn(`layers[${i}] inválida, ignorada.`);
      return;
    }

    let y: number | undefined;
    let repeat: number | undefined = toInt(pick(obj, 'repeat', 'times', 'count', 'height'), ctx);
    const yRaw = pick(obj, 'y', 'level', 'layer', 'yLevel', 'y_level');
    if (typeof yRaw === 'string' && /^\s*-?\d+\s*(-|a|to|até|\.\.)\s*-?\d+\s*$/.test(yRaw)) {
      const [a, b] = yRaw.split(/-(?=\d)|a|to|até|\.\./).map((s) => Number(s.trim()));
      y = Math.min(a, b);
      repeat = Math.abs(b - a) + 1;
      ctx.fix(`Camada com y "${yRaw}": virou y=${y} repetida ${repeat} vezes.`);
    } else if (Array.isArray(yRaw) && yRaw.length === 2) {
      const [a, b] = yRaw.map((n) => toInt(n, ctx) ?? 0);
      y = Math.min(a, b);
      repeat = Math.abs(b - a) + 1;
      ctx.fix(`Camada com y [${a}, ${b}]: virou y=${y} repetida ${repeat} vezes.`);
    } else y = toInt(yRaw, ctx);
    const ys = pick(obj, 'ys', 'yRange', 'y_range', 'levels');
    if (y === undefined && Array.isArray(ys) && ys.length) {
      const nums = ys.map((n) => toInt(n, ctx)).filter((n): n is number => n !== undefined);
      y = Math.min(...nums);
      repeat = Math.max(...nums) - y + 1;
    }
    if (y === undefined) {
      y = i;
      ctx.warn(`layers[${i}] sem "y": usei y=${i}. Confira se está na altura certa.`);
    }

    const rows = normalizeRows(pick(obj, 'rows', 'grid', 'map', 'pattern', 'data', 'lines', 'blocks'), ctx);
    if (!rows) {
      ctx.warn(`layers[${i}] (y=${y}) não tem "rows". Ignorada.`);
      return;
    }
    out.push({ y, name: typeof obj.name === 'string' ? obj.name : undefined, rows, repeat: repeat && repeat > 1 ? Math.min(repeat, 384) : undefined });
  });

  // "P P P" (caracteres separados por espaço) quando o tamanho declarado mostra que não era para ter espaço
  // (checado camada por camada)
  if (sizeX && sizeX > 1) {
    const spaced = (r: string) => r.length === sizeX * 2 - 1 && /^(\S )+\S$/.test(r);
    for (const l of out) {
      const rows = l.rows.filter((r) => r.length);
      if (rows.length && rows.every(spaced)) {
        l.rows = l.rows.map((r) => r.replace(/(\S) /g, '$1'));
        ctx.fix('Removi os espaços entre os caracteres das camadas ("P P P" → "PPP").');
      }
    }
  }
  return out;
}

function normalizeSteps(raw: unknown, ctx: Ctx): Step[] {
  const list = Array.isArray(raw) ? raw : isObj(raw) ? Object.values(raw) : [];
  const out: Step[] = [];
  for (const s of list) {
    if (typeof s === 'string') {
      out.push({ title: s });
      continue;
    }
    if (!isObj(s)) continue;
    const title = String(pick(s, 'title', 'name', 'step', 'label') ?? 'Passo');
    const description = pick(s, 'description', 'desc', 'text', 'details', 'instructions');
    let yFrom = toInt(pick(s, 'yFrom', 'y_from', 'fromY', 'from_y', 'yStart', 'start'), ctx);
    let yTo = toInt(pick(s, 'yTo', 'y_to', 'toY', 'to_y', 'yEnd', 'end'), ctx);
    const range = pick(s, 'layers', 'y', 'ys');
    if (Array.isArray(range) && range.length) {
      const nums = range.map((n) => toInt(n, ctx)).filter((n): n is number => n !== undefined);
      if (nums.length) {
        yFrom = Math.min(...nums);
        yTo = Math.max(...nums);
      }
    } else if (typeof range === 'number') yFrom = yTo = range;
    out.push({ title, description: description !== undefined ? String(description) : undefined, yFrom, yTo });
  }
  return out;
}

function normalizePlan(raw: unknown, ctx: Ctx): Plan | undefined {
  if (raw === undefined) return undefined;
  const obj = isObj(raw) ? raw : Array.isArray(raw) ? { floors: raw } : undefined;
  if (!obj) {
    ctx.warn('"plan" inválido, ignorado.');
    return undefined;
  }
  const floorsRaw = pick(obj, 'floors', 'levels', 'andares', 'stories');
  const floors: Floor[] = [];
  (Array.isArray(floorsRaw) ? floorsRaw : []).forEach((f, i) => {
    if (!isObj(f)) return;
    let yFrom = toInt(pick(f, 'yFrom', 'y_from', 'fromY', 'yStart', 'floorY', 'y'), ctx);
    let yTo = toInt(pick(f, 'yTo', 'y_to', 'toY', 'yEnd', 'ceilingY'), ctx);
    const range = pick(f, 'ys', 'yRange', 'layers');
    if (Array.isArray(range) && range.length === 2) [yFrom, yTo] = range.map((n) => toInt(n, ctx));
    if (yFrom === undefined || yTo === undefined) {
      ctx.warn(`plan.floors[${i}] sem yFrom/yTo: andar ignorado.`);
      return;
    }
    if (yFrom > yTo) [yFrom, yTo] = [yTo, yFrom];
    const roomsRaw = pick(f, 'rooms', 'comodos', 'cômodos', 'spaces');
    const rooms: Room[] = (Array.isArray(roomsRaw) ? roomsRaw : [])
      .map((r) => {
        if (typeof r === 'string') return { name: r };
        if (!isObj(r)) return undefined;
        const from = toVec(pick(r, 'from', 'start', 'min'), ctx);
        const to = toVec(pick(r, 'to', 'end', 'max'), ctx);
        const use = pick(r, 'use', 'description', 'desc', 'purpose', 'uso');
        return { name: String(pick(r, 'name', 'nome', 'title') ?? 'Cômodo'), from, to, use: use !== undefined ? String(use) : undefined };
      })
      .filter((r): r is Room => !!r);
    floors.push({ name: String(pick(f, 'name', 'nome', 'title') ?? `Andar ${i + 1}`), yFrom, yTo, rooms: rooms.length ? rooms : undefined });
  });
  floors.sort((a, b) => a.yFrom - b.yFrom);
  if (!floors.length) {
    ctx.warn('"plan" sem andares válidos (floors com name, yFrom, yTo).');
    return undefined;
  }
  const style = pick(obj, 'style', 'estilo');
  const exterior = pick(obj, 'exterior', 'outside', 'garden');
  return { floors, style: style !== undefined ? String(style) : undefined, exterior: exterior !== undefined ? String(exterior) : undefined };
}

function normalizePalette(raw: unknown, ctx: Ctx): Record<string, string> | undefined {
  if (raw === undefined) return undefined;
  let entries: [string, unknown][] = [];
  if (Array.isArray(raw)) {
    entries = raw.filter(isObj).map((e) => [String(pick(e, 'char', 'key', 'symbol', 'c') ?? ''), pick(e, 'block', 'id', 'name', 'value')]);
    ctx.fix('Converti a paleta escrita como lista em objeto { "C": "bloco" }.');
  } else if (isObj(raw)) entries = Object.entries(raw);
  else {
    ctx.warn('"palette" inválida, ignorada.');
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [k, v] of entries) {
    if ([...k].length !== 1) {
      ctx.warn(`Paleta: a chave "${k}" precisa ter exatamente 1 caractere. Ignorada.`);
      continue;
    }
    const b = normalizeBlock(isObj(v) ? (pick(v, 'block', 'id', 'name') ?? v) : v, ctx);
    if (!b) {
      ctx.warn(`Paleta: "${k}" não aponta para um bloco válido.`);
      continue;
    }
    if ((k === '.' || k === ' ') && b !== 'air') {
      ctx.warn(`Paleta: "${k}" é sempre ar e não pode ser "${b}". Use outro caractere.`);
      continue;
    }
    out[k] = b;
  }
  return out;
}

function normalizeSize(raw: unknown, ctx: Ctx): { x: number; y: number; z: number } | undefined {
  if (raw === undefined) return undefined;
  let x: unknown, y: unknown, z: unknown;
  if (Array.isArray(raw) && raw.length === 3) {
    [x, y, z] = raw;
    ctx.fix('Converti size [x, y, z] em { x, y, z }.');
  } else if (typeof raw === 'string') {
    const nums = raw.split(/[^\d]+/).filter(Boolean);
    if (nums.length === 3) {
      [x, y, z] = nums;
      ctx.fix(`Converti size "${raw}" em { x, y, z } (na ordem x, y, z).`);
    }
  } else if (isObj(raw)) {
    x = pick(raw, 'x', 'width', 'w');
    y = pick(raw, 'y', 'height', 'h');
    z = pick(raw, 'z', 'depth', 'length', 'd', 'l');
    if (raw.x === undefined) ctx.fix('Converti size { width, height, depth } em { x, y, z }.');
  }
  const [nx, ny, nz] = [toInt(x, ctx), toInt(y, ctx), toInt(z, ctx)];
  if (nx && ny && nz && nx > 0 && ny > 0 && nz > 0) return { x: nx, y: ny, z: nz };
  ctx.warn('"size" inválido: vou calcular o tamanho pelos blocos.');
  return undefined;
}

export function normalizeBlueprint(input: any, ctx = new Ctx()): { blueprint?: Blueprint; ctx: Ctx; sizeInferred: boolean } {
  let d = input;
  if (isObj(d) && isObj(d.blueprint) && !('size' in d)) {
    d = d.blueprint;
    ctx.fix('O JSON veio dentro de { "blueprint": ... }: usei o conteúdo.');
  }
  if (!isObj(d)) {
    ctx.errors.push('O arquivo precisa ser um objeto JSON { ... }.');
    return { ctx, sizeInferred: false };
  }

  if (d.format !== 'mc-blueprint' || d.version !== 1) ctx.fix('Ajustei "format"/"version" para "mc-blueprint" / 1.');

  const metaIn = isObj(d.meta) ? d.meta : {};
  const name = pick(metaIn, 'name', 'title') ?? pick(d, 'name', 'title');
  const sources = pick(metaIn, 'sources', 'source', 'references', 'links');
  const meta = {
    name: typeof name === 'string' && name.trim() ? name.trim() : 'Sem nome',
    description: (pick(metaIn, 'description', 'desc') ?? d.description) as string | undefined,
    category: pick(metaIn, 'category', 'type') as string | undefined,
    author: metaIn.author as string | undefined,
    minecraftVersion: String(pick(metaIn, 'minecraftVersion', 'version', 'mcVersion', 'minecraft_version') ?? '') || undefined,
    sources: Array.isArray(sources) ? sources.map(String) : typeof sources === 'string' ? [sources] : undefined,
  };

  const declared = normalizeSize(pick(d, 'size', 'dimensions', 'dims'), ctx);
  const palette = normalizePalette(pick(d, 'palette', 'legend', 'key', 'blocks_key'), ctx);
  const layers = normalizeLayers(pick(d, 'layers', 'levels', 'slices'), ctx, declared?.x);
  const opsRaw = pick(d, 'operations', 'ops', 'commands', 'actions');
  const operations = Array.isArray(opsRaw)
    ? opsRaw.map((o, i) => normalizeOp(o, String(i), ctx)).filter((x): x is Operation => !!x)
    : [];
  if (opsRaw !== undefined && !Array.isArray(opsRaw)) ctx.warn('"operations" precisa ser uma lista [ ... ].');
  const steps = normalizeSteps(pick(d, 'steps', 'instructions', 'build_steps'), ctx);
  const plan = normalizePlan(pick(d, 'plan', 'planta', 'floorPlan', 'floor_plan'), ctx);
  const partRaw = pick(d, 'part', 'parte', 'stage', 'etapa');
  const part: PartInfo | undefined = isObj(partRaw)
    ? {
        number: toInt(pick(partRaw, 'number', 'numero', 'n', 'index'), ctx),
        of: toInt(pick(partRaw, 'of', 'total', 'de'), ctx),
        title: pick(partRaw, 'title', 'titulo', 'name', 'nome') !== undefined ? String(pick(partRaw, 'title', 'titulo', 'name', 'nome')) : undefined,
        kind: pick(partRaw, 'kind', 'tipo', 'type') !== undefined ? String(pick(partRaw, 'kind', 'tipo', 'type')).toLowerCase() : undefined,
        yFrom: toInt(pick(partRaw, 'yFrom', 'y_from'), ctx),
        yTo: toInt(pick(partRaw, 'yTo', 'y_to'), ctx),
        next: pick(partRaw, 'next', 'proxima', 'próxima') !== undefined ? String(pick(partRaw, 'next', 'proxima', 'próxima')) : undefined,
        done: pick(partRaw, 'done', 'fim', 'last') === true,
      }
    : undefined;
  const notesRaw = pick(d, 'notes', 'note', 'comments');
  const notes = Array.isArray(notesRaw) ? notesRaw.map((n) => (typeof n === 'string' ? n : JSON.stringify(n))) : typeof notesRaw === 'string' ? [notesRaw] : [];

  if (!layers.length && !operations.length) {
    ctx.errors.push('O arquivo não tem "layers" nem "operations" com blocos — não há nada para mostrar.');
    return { ctx, sizeInferred: false };
  }
  if (declared && declared.x * declared.y * declared.z > MAX_VOLUME) {
    ctx.errors.push(`Construção grande demais (${declared.x}×${declared.y}×${declared.z}). Limite: ${MAX_VOLUME.toLocaleString('pt-BR')} blocos de volume.`);
    return { ctx, sizeInferred: false };
  }

  const blueprint: Blueprint = {
    format: 'mc-blueprint',
    version: 1,
    meta,
    size: declared ?? { x: 1, y: 1, z: 1 },
    ...(plan ? { plan } : {}),
    ...(part ? { part } : {}),
    ...(palette && Object.keys(palette).length ? { palette } : {}),
    ...(layers.length ? { layers } : {}),
    ...(operations.length ? { operations } : {}),
    ...(steps.length ? { steps } : {}),
    ...(notes.length ? { notes } : {}),
  };
  if (!declared) ctx.fix('Tamanho ("size") calculado pelos blocos.');
  return { blueprint, ctx, sizeInferred: !declared };
}

// =====================================================================
// 3) Tudo junto
// =====================================================================

export function parseBlueprint(text: string): ParseResult & { sizeInferred?: boolean } {
  const ex = extractJson(text);
  if (ex.error || ex.data === undefined) {
    return { ok: false, errors: [ex.error ?? 'Erro desconhecido.'], warnings: [], fixes: ex.fixes, truncated: ex.truncated };
  }
  const { blueprint, ctx, sizeInferred } = normalizeBlueprint(ex.data);
  return {
    ok: !!blueprint && ctx.errors.length === 0,
    errors: ctx.errors,
    warnings: Ctx.list(ctx.warnings),
    fixes: [...ex.fixes, ...Ctx.list(ctx.fixes)],
    blueprint,
    sizeInferred,
  };
}
