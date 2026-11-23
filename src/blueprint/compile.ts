import type { Blueprint, Operation, Vec3 } from './types';

export interface Voxel {
  x: number;
  y: number;
  z: number;
  /** Texto completo, ex.: "oak_stairs[facing=north]" */
  state: string;
  /** Só o id, ex.: "oak_stairs" */
  id: string;
  props: Record<string, string>;
  /** De qual parte/etapa do projeto veio este bloco. */
  part?: string;
}

export interface CompiledModel {
  /** Tamanho efetivo (o declarado, aumentado se havia blocos fora dele). */
  size: { x: number; y: number; z: number };
  min: Vec3;
  max: Vec3;
  /** Quanto tudo foi deslocado para tirar coordenadas negativas. */
  offset: Vec3;
  voxels: Voxel[];
  byLayer: Map<number, Voxel[]>;
  /** "x,y,z" → voxel */
  index: Map<string, Voxel>;
  /** Avisos gerais (não ligados a uma parte específica). */
  warnings: string[];
  /** Avisos de cada parte, pelo id da parte. */
  partWarnings: Map<string, string[]>;
}

/** Uma parte do projeto (ex.: estrutura, detalhes do térreo, mobília do térreo). */
export interface PartInput {
  id: string;
  bp: Blueprint;
  sizeInferred?: boolean;
  /** Não deixa esta parte apagar ou trocar blocos que já existem (mobília/decoração/exterior). */
  protectExisting?: boolean;
  /** Faixa de y esperada (andar): blocos fora dela geram aviso. */
  yRange?: [number, number];
}

const AIR = new Set(['air', 'cave_air', 'void_air']);
const MAX_PUTS = 12_000_000;

export function parseState(state: string): { id: string; props: Record<string, string> } {
  const s = state.trim().toLowerCase();
  const m = s.match(/^([a-z0-9_:.\-]+)(?:\[(.*)\])?$/);
  const id = (m ? m[1] : s).replace(/^minecraft:/, '');
  const props: Record<string, string> = {};
  if (m?.[2]) {
    for (const pair of m[2].split(',')) {
      const [k, v] = pair.split('=').map((t) => t.trim());
      if (k && v !== undefined) props[k] = v;
    }
  }
  return { id, props };
}

type Put = (x: number, y: number, z: number, state: string) => void;

/** Um blueprint só (modo rápido). */
export function compile(bp: Blueprint, opts: { sizeInferred?: boolean } = {}): CompiledModel {
  const m = compileParts([{ id: 'main', bp, sizeInferred: opts.sizeInferred }]);
  return { ...m, warnings: [...(m.partWarnings.get('main') ?? []), ...m.warnings] };
}

/**
 * Junta várias partes no mesmo espaço, na ordem (a última vence), com as mesmas coordenadas.
 * Cada bloco guarda a parte de onde veio.
 */
/**
 * opts.freeCoords: projeto que cresce por alterações — coordenadas negativas (subsolo, ampliar para o
 * norte/oeste) e blocos fora do size são normais, sem aviso. O visualizador desloca por dentro, mas
 * mostra sempre as coordenadas do projeto (interno − offset).
 */
export function compileParts(parts: PartInput[], opts: { freeCoords?: boolean } = {}): CompiledModel {
  const warnings: string[] = [];
  const partWarnings = new Map<string, string[]>();
  const grid = new Map<string, { state: string; part: string }>();
  let puts = 0;
  let aborted = false;

  for (const part of parts) {
    const pw: string[] = [];
    partWarnings.set(part.id, pw);
    const { bp } = part;
    let blocked = 0;
    let outside = 0;

    const put: Put = (x, y, z, state) => {
      if (aborted) return;
      if (++puts > MAX_PUTS) {
        aborted = true;
        warnings.push('Construção grande demais: parei de processar no meio. Divida em partes menores.');
        return;
      }
      const key = `${x},${y},${z}`;
      if (part.yRange && (y < part.yRange[0] || y > part.yRange[1])) outside++;
      if (part.protectExisting && grid.has(key) && grid.get(key)!.part !== part.id) {
        blocked++;
        return;
      }
      if (AIR.has(parseState(state).id)) grid.delete(key);
      else grid.set(key, { state, part: part.id });
    };

    // 1) Camadas desenhadas em texto
    const palette = bp.palette ?? {};
    const unknown = new Set<string>();
    for (const layer of bp.layers ?? []) {
      const label = `Camada y=${layer.y}${layer.name ? ` (${layer.name})` : ''}`;
      if (!part.sizeInferred && layer.rows.length !== bp.size.z)
        pw.push(`${label}: tem ${layer.rows.length} linhas, mas size.z é ${bp.size.z}.`);
      const reps = Math.max(1, layer.repeat ?? 1);
      layer.rows.forEach((row, z) => {
        const chars = [...row];
        if (!part.sizeInferred && chars.length !== bp.size.x)
          pw.push(`${label}, linha ${z + 1} (z=${z}): tem ${chars.length} caracteres, mas size.x é ${bp.size.x}.`);
        chars.forEach((ch, x) => {
          if (ch === '.' || ch === ' ') return;
          const st = palette[ch];
          if (!st) unknown.add(ch);
          else for (let r = 0; r < reps; r++) put(x, layer.y + r, z, st);
        });
      });
    }
    if (unknown.size) pw.push(`Caracteres usados nas camadas que não estão na paleta (ignorados): ${[...unknown].map((c) => `"${c}"`).join(', ')}`);

    // 2) Operações, na ordem (a última vence)
    for (const op of bp.operations ?? []) applyOp(op, put, [0, 0, 0], pw);

    if (blocked)
      pw.push(`${blocked} bloco(s) foram colocados em cima de blocos que já existiam (paredes, piso, portas…) e foram ignorados. Nesta etapa só se usa espaço vazio ("." na estrutura atual).`);
    if (outside && part.yRange)
      pw.push(`${outside} bloco(s) ficaram fora do andar (y ${part.yRange[0]} a ${part.yRange[1]}). Confira se o y está certo.`);
  }

  // 3) Limites reais, deslocamento de negativos e tamanho efetivo
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const key of grid.keys()) {
    const p = key.split(',').map(Number);
    for (let i = 0; i < 3; i++) {
      if (p[i] < min[i]) min[i] = p[i];
      if (p[i] > max[i]) max[i] = p[i];
    }
  }
  if (!grid.size) {
    min.fill(0);
    max.fill(0);
  }
  const offset: Vec3 = [Math.max(0, -min[0]), Math.max(0, -min[1]), Math.max(0, -min[2])];
  if (offset.some((o) => o > 0)) {
    if (!opts.freeCoords)
      warnings.push(
      `Havia coordenadas negativas (menor ponto: [${min.join(', ')}]). Desloquei tudo em [${offset.join(', ')}] para começar do 0. A origem [0,0,0] deve ser o canto noroeste de baixo.`,
    );
    for (let i = 0; i < 3; i++) {
      min[i] += offset[i];
      max[i] += offset[i];
    }
  }

  const declaredParts = parts.filter((p) => !p.sizeInferred);
  const declared = declaredParts.length
    ? {
        x: Math.max(...declaredParts.map((p) => p.bp.size.x)),
        y: Math.max(...declaredParts.map((p) => p.bp.size.y)),
        z: Math.max(...declaredParts.map((p) => p.bp.size.z)),
      }
    : undefined;
  const size = declared
    ? { x: Math.max(declared.x, max[0] + 1), y: Math.max(declared.y, max[1] + 1), z: Math.max(declared.z, max[2] + 1) }
    : { x: max[0] + 1, y: max[1] + 1, z: max[2] + 1 };
  if (!opts.freeCoords && declared && (size.x !== declared.x || size.y !== declared.y || size.z !== declared.z)) {
    warnings.push(
      `Há blocos fora do tamanho declarado: size era ${declared.x}×${declared.y}×${declared.z}, mas os blocos vão até ${size.x}×${size.y}×${size.z}. Ajustei o tamanho.`,
    );
  }

  // 4) Lista final
  const voxels: Voxel[] = [];
  const byLayer = new Map<number, Voxel[]>();
  const index = new Map<string, Voxel>();
  for (const [key, { state, part }] of grid) {
    const [px, py, pz] = key.split(',').map(Number);
    const x = px + offset[0], y = py + offset[1], z = pz + offset[2];
    const { id, props } = parseState(state);
    const v: Voxel = { x, y, z, state, id, props, part };
    voxels.push(v);
    index.set(`${x},${y},${z}`, v);
    let layer = byLayer.get(y);
    if (!layer) byLayer.set(y, (layer = []));
    layer.push(v);
  }

  for (const [k, list] of partWarnings) partWarnings.set(k, list.slice(0, 40));
  return { size, min, max, offset, voxels, byLayer, index, warnings: warnings.slice(0, 20), partWarnings };
}

function range(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.push(i);
  return out;
}

const baseId = (state: string) => state.split('[')[0];

function applyOp(op: Operation, put: Put, off: Vec3, warnings: string[]) {
  const P: Put = (x, y, z, s) => put(x + off[0], y + off[1], z + off[2], s);

  switch (op.op) {
    case 'set':
      P(op.at[0], op.at[1], op.at[2], op.block);
      return;

    case 'repeat':
      for (let t = 0; t < op.times; t++) {
        const o: Vec3 = [off[0] + op.offset[0] * t, off[1] + op.offset[1] * t, off[2] + op.offset[2] * t];
        for (const inner of op.operations) applyOp(inner, put, o, warnings);
      }
      return;

    case 'line': {
      const [x1, y1, z1] = op.from;
      const [x2, y2, z2] = op.to;
      const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), Math.abs(z2 - z1));
      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        P(Math.round(x1 + (x2 - x1) * t), Math.round(y1 + (y2 - y1) * t), Math.round(z1 + (z2 - z1) * t), op.block);
      }
      return;
    }

    case 'roof':
      roof(op, P);
      return;
  }

  const [x1, y1, z1] = op.from;
  const [x2, y2, z2] = op.to;
  const [lx, hx] = [Math.min(x1, x2), Math.max(x1, x2)];
  const [ly, hy] = [Math.min(y1, y2), Math.max(y1, y2)];
  const [lz, hz] = [Math.min(z1, z2), Math.max(z1, z2)];

  for (let x = lx; x <= hx; x++)
    for (let y = ly; y <= hy; y++)
      for (let z = lz; z <= hz; z++) {
        const sideX = x === lx || x === hx;
        const sideZ = z === lz || z === hz;
        const sideY = y === ly || y === hy;
        switch (op.op) {
          case 'fill':
            P(x, y, z, op.block);
            break;
          case 'clear':
            P(x, y, z, 'air');
            break;
          case 'hollow': // casca: paredes + piso + teto, interior vira ar
            P(x, y, z, sideX || sideZ || sideY ? op.block : 'air');
            break;
          case 'walls': // só as 4 paredes laterais, não mexe no interior
            if (sideX || sideZ) P(x, y, z, op.block);
            break;
        }
      }
  void warnings;
}

/**
 * Telhado de duas águas. A área from/to é a base do telhado (a altura vem do menor y).
 * Cada nível sobe 1 bloco e entra 1 bloco de cada lado, com as escadas viradas para a cumeeira.
 * Uso típico: y = topo das paredes e a área 1 bloco maior que as paredes nos lados das águas
 * (beiral). A 1ª fileira fica encostada por fora no topo da parede, a 2ª já fica em cima dela.
 * Os oitões (gable) começam no 2º nível para não sobrescrever o topo das paredes.
 */
function roof(op: Extract<Operation, { op: 'roof' }>, P: Put) {
  const [x1, y1, z1] = op.from;
  const [x2, y2, z2] = op.to;
  const [lx, hx] = [Math.min(x1, x2), Math.max(x1, x2)];
  const [lz, hz] = [Math.min(z1, z2), Math.max(z1, z2)];
  const y0 = Math.min(y1, y2);
  const axis = op.axis ?? (hx - lx >= hz - lz ? 'x' : 'z');
  const stairs = baseId(op.block);
  const ridge = op.ridge ?? (stairs.endsWith('_stairs') ? `${stairs.replace(/_stairs$/, '_slab')}[type=bottom]` : stairs);

  if (axis === 'x') {
    // cumeeira de leste a oeste: as águas descem para norte e sul
    for (let k = 0; ; k++) {
      const zn = lz + k;
      const zs = hz - k;
      if (zn > zs) break;
      for (const x of range(lx, hx)) {
        if (zn === zs) P(x, y0 + k, zn, ridge);
        else {
          P(x, y0 + k, zn, `${stairs}[facing=south,half=bottom]`);
          P(x, y0 + k, zs, `${stairs}[facing=north,half=bottom]`);
        }
      }
      if (op.gable && k >= 1) for (let z = zn + 1; z < zs; z++) for (const x of [lx, hx]) P(x, y0 + k, z, op.gable);
    }
  } else {
    // cumeeira de norte a sul: as águas descem para oeste e leste
    for (let k = 0; ; k++) {
      const xw = lx + k;
      const xe = hx - k;
      if (xw > xe) break;
      for (const z of range(lz, hz)) {
        if (xw === xe) P(xw, y0 + k, z, ridge);
        else {
          P(xw, y0 + k, z, `${stairs}[facing=east,half=bottom]`);
          P(xe, y0 + k, z, `${stairs}[facing=west,half=bottom]`);
        }
      }
      if (op.gable && k >= 1) for (let x = xw + 1; x < xe; x++) for (const z of [lz, hz]) P(x, y0 + k, z, op.gable);
    }
  }
}
