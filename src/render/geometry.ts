// Formas dos blocos. Cada bloco vira uma ou mais "peças" (geometrias com a origem no canto do bloco).
// Ex.: cerca = poste + braços para os lados onde há vizinho para conectar.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Voxel } from '../blueprint/compile';
import { isSolidCube, lookFor, type BlockLook } from './blocks';

const P = 1 / 16;

function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

const merge = (...gs: THREE.BufferGeometry[]) => mergeGeometries(gs)!;

type Dir = 'n' | 's' | 'e' | 'w';
const DIRS: [Dir, number, number][] = [['n', 0, -1], ['s', 0, 1], ['e', 1, 0], ['w', -1, 0]];
const FACING: Record<string, Dir> = { north: 'n', south: 's', east: 'e', west: 'w' };
const OPP: Record<Dir, Dir> = { n: 's', s: 'n', e: 'w', w: 'e' };

/** Placa fina encostada numa borda do bloco. */
function edge(d: Dir, t = 3 * P, y0 = 0, y1 = 1) {
  switch (d) {
    case 'n': return box(0, y0, 0, 1, y1, t);
    case 's': return box(0, y0, 1 - t, 1, y1, 1);
    case 'e': return box(1 - t, y0, 0, 1, y1, 1);
    case 'w': return box(0, y0, 0, t, y1, 1);
  }
}

/** Braço que vai do centro até a borda d (largura w, de y0 a y1). */
function arm(d: Dir, w: number, y0: number, y1: number, inner: number) {
  const a = 0.5 - w / 2, b = 0.5 + w / 2;
  switch (d) {
    case 'n': return box(a, y0, 0, b, y1, inner);
    case 's': return box(a, y0, 1 - inner, b, y1, 1);
    case 'e': return box(1 - inner, y0, a, 1, y1, b);
    case 'w': return box(0, y0, a, inner, y1, b);
  }
}

function cross() {
  const mk = (rot: number) => {
    const g = new THREE.BoxGeometry(0.9, 0.85, 0.05);
    g.rotateY(rot);
    g.translate(0.5, 0.425, 0.5);
    return g;
  };
  return merge(mk(Math.PI / 4), mk(-Math.PI / 4));
}

function build(key: string): THREE.BufferGeometry {
  const [kind, a, b] = key.split(':');
  switch (kind) {
    case 'full': return box(0, 0, 0, 1, 1, 1);
    case 'slab_bottom': return box(0, 0, 0, 1, 0.5, 1);
    case 'slab_top': return box(0, 0.5, 0, 1, 1, 1);
    case 'carpet': return box(0, 0, 0, 1, P, 1);
    case 'small': return box(0.375, 0, 0.375, 0.625, 0.625, 0.625);
    case 'cross': return cross();
    case 'rod': return box(7 * P, 0, 7 * P, 9 * P, 1, 9 * P);
    case 'lantern_bottom': return box(5 * P, 0, 5 * P, 11 * P, 9 * P, 11 * P);
    case 'lantern_top': return merge(box(5 * P, 6 * P, 5 * P, 11 * P, 14 * P, 11 * P), box(7.5 * P, 14 * P, 7.5 * P, 8.5 * P, 1, 8.5 * P));
    case 'bed': return box(0, 0, 0, 1, 9 * P, 1);
    case 'chest': return box(P, 0, P, 15 * P, 14 * P, 15 * P);
    case 'trap_bottom': return box(0, 0, 0, 1, 3 * P, 1);
    case 'trap_top': return box(0, 13 * P, 0, 1, 1, 1);
    case 'edge': return edge(a as Dir);
    case 'stairs': {
      // a = top|bottom, b = direção do lado alto (facing)
      const d = b as Dir;
      const top = a === 'top';
      const slab = top ? box(0, 0.5, 0, 1, 1, 1) : box(0, 0, 0, 1, 0.5, 1);
      const [y0, y1] = top ? [0, 0.5] : [0.5, 1];
      const step =
        d === 'n' ? box(0, y0, 0, 1, y1, 0.5)
        : d === 's' ? box(0, y0, 0.5, 1, y1, 1)
        : d === 'e' ? box(0.5, y0, 0, 1, y1, 1)
        : box(0, y0, 0, 0.5, y1, 1);
      return merge(slab, step);
    }
    case 'fence_post': return box(6 * P, 0, 6 * P, 10 * P, 1, 10 * P);
    case 'fence_arm': return merge(arm(a as Dir, 2 * P, 6 * P, 9 * P, 6 * P), arm(a as Dir, 2 * P, 12 * P, 15 * P, 6 * P));
    case 'pane_post': return box(7 * P, 0, 7 * P, 9 * P, 1, 9 * P);
    case 'pane_arm': return arm(a as Dir, 2 * P, 0, 1, 7 * P);
    case 'wall_post': return box(4 * P, 0, 4 * P, 12 * P, 1, 12 * P);
    case 'wall_arm': return arm(a as Dir, 6 * P, 0, 14 * P, 4 * P);
    case 'gate_x': return merge(box(0, 5 * P, 7 * P, 1, 15 * P, 9 * P));
    case 'gate_z': return merge(box(7 * P, 5 * P, 0, 9 * P, 15 * P, 1));
    default: return box(0, 0, 0, 1, 1, 1);
  }
}

const cache = new Map<string, THREE.BufferGeometry>();
export function geometryFor(key: string): THREE.BufferGeometry {
  let g = cache.get(key);
  if (!g) cache.set(key, (g = build(key)));
  return g;
}

type Neighbor = (dx: number, dz: number) => Voxel | undefined;

function connects(kind: BlockLook['kind'], other: Voxel | undefined): boolean {
  if (!other) return false;
  const ol = lookFor(other.id, other.props);
  if (isSolidCube(ol)) return true;
  switch (kind) {
    case 'fence': return ol.kind === 'fence' || ol.kind === 'fence_gate';
    case 'pane': return ol.kind === 'pane' || ol.kind === 'wall';
    case 'wall': return ol.kind === 'wall' || ol.kind === 'pane' || ol.kind === 'fence_gate';
    default: return false;
  }
}

/** Peças (chaves de geometria) que formam este bloco. */
export function partsFor(v: Voxel, look: BlockLook, neighbor: Neighbor): string[] {
  const p = v.props;
  const facing = FACING[p.facing] ?? 'n';
  switch (look.kind) {
    case 'full': return ['full'];
    case 'slab': return [p.type === 'top' ? 'slab_top' : 'slab_bottom'];
    case 'carpet': return ['carpet'];
    case 'small': return ['small'];
    case 'cross': return ['cross'];
    case 'rod': return ['rod'];
    case 'bed': return ['bed'];
    case 'chest': return ['chest'];
    case 'lantern': return [p.hanging === 'true' ? 'lantern_top' : 'lantern_bottom'];
    case 'stairs': return [`stairs:${p.half === 'top' ? 'top' : 'bottom'}:${facing}`];
    // Porta fechada fica na borda oposta à direção para onde está virada
    case 'door': return [`edge:${OPP[facing]}`];
    case 'plate': {
      if (v.id === 'vine') {
        const side = DIRS.find(([d]) => p[{ n: 'north', s: 'south', e: 'east', w: 'west' }[d]] === 'true');
        return [`edge:${side ? side[0] : 'n'}`];
      }
      return [`edge:${OPP[facing]}`];
    }
    case 'trapdoor':
      if (p.open === 'true') return [`edge:${OPP[facing]}`];
      return [p.half === 'top' ? 'trap_top' : 'trap_bottom'];
    case 'fence_gate': return [facing === 'n' || facing === 's' ? 'gate_x' : 'gate_z'];
    case 'fence':
    case 'pane':
    case 'wall': {
      const prefix = look.kind;
      const parts = [`${prefix}_post`];
      for (const [d, dx, dz] of DIRS) if (connects(look.kind, neighbor(dx, dz))) parts.push(`${prefix}_arm:${d}`);
      return parts;
    }
  }
}
