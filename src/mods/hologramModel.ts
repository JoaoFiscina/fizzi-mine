// Modelo 3D do holograma (geometria de entidade do Bedrock) + atlas de texturas, a partir de um projeto.
// Mesma ideia do HoloPrint: cada bloco vira um cubo (ou formato aproximado: laje, escada, cerca, planta…)
// com UV por face apontando para o atlas; um "osso" por camada para mostrar camada por camada.
//
// Coordenadas: 16 unidades por bloco; o X do modelo é invertido em relação ao mundo (como no HoloPrint),
// assim os nomes das faces do modelo batem com as direções do mundo. O ponto (0,0,0) do modelo é o MEIO
// da construção no chão: girar não tira os blocos da grade.

import { parseState } from '../blueprint/compile';
import { encodePng } from './png';
import { FACES, type Face, type Img, type TextureSource } from './bedrockTextures';
import type { GameProject } from './holograma';

/** Transparência do holograma (1 = sólido). */
export const OPACITY = 0.8;
/** Tamanho de cada bloco do holograma (1 = bloco inteiro). Menor que 1: o bloco de verdade, quando colocado, cobre o holograma e dá para ver o que já foi preenchido. */
export const SCALE = 0.9;
const enc = (v: number) => Math.round((8 + (v - 8) * SCALE) * 1000) / 1000;

type Box = { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number; rot?: number; faces?: Face[] };
type Shape = { boxes: Box[]; full: boolean };

const FULL: Box = { x0: 0, y0: 0, z0: 0, x1: 16, y1: 16, z1: 16 };
const PLANT = /sapling|flower|tulip|poppy|dandelion|orchid|allium|bluet|daisy|cornflower|lily_of|short_grass|tallgrass|^fern$|dead_?bush|mushroom$|reeds|sugar_cane|wheat|carrots|potatoes|beetroot|sweet_berry|torchflower|pitcher|wither_rose|fungus|roots$|sprouts|kelp|seagrass|cobweb|^web$/;
const TRANSPARENT = /glass|leaves|ice$|slime|honey_block|barrier|spawner|beacon|^water|^lava/;

function shapeOf(javaState: string | undefined, name: string): Shape {
  const { id, props } = parseState(javaState || name.replace(/^minecraft:/, ''));
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Box => ({ x0, y0, z0, x1, y1, z1 });
  if (id.endsWith('_slab')) {
    if (props.type === 'double') return { boxes: [FULL], full: true };
    return { boxes: [props.type === 'top' ? box(0, 8, 0, 16, 16, 16) : box(0, 0, 0, 16, 8, 16)], full: false };
  }
  if (id.endsWith('_stairs')) {
    const top = props.half === 'top';
    const base = top ? box(0, 8, 0, 16, 16, 16) : box(0, 0, 0, 16, 8, 16);
    const [ya, yb] = top ? [0, 8] : [8, 16];
    const step = { north: box(0, ya, 0, 16, yb, 8), south: box(0, ya, 8, 16, yb, 16), east: box(8, ya, 0, 16, yb, 16), west: box(0, ya, 0, 8, yb, 16) }[props.facing as 'north'] ?? box(0, ya, 0, 16, yb, 8);
    return { boxes: [base, step], full: false };
  }
  if (/carpet$|pressure_plate$|^rail$|_rail$|redstone_wire|^snow$|moss_carpet/.test(id)) {
    const h = id === 'snow' ? Math.max(1, Number(props.layers ?? 1)) * 2 : 1;
    return { boxes: [box(0, 0, 0, 16, h, 16)], full: false };
  }
  if (/pane$|iron_bars/.test(id)) return { boxes: [box(7, 0, 7, 9, 16, 9)], full: false };
  if (/fence$|_wall$|^chain$/.test(id) && !id.endsWith('gate')) return { boxes: [box(6, 0, 6, 10, 16, 10)], full: false };
  if (/torch$/.test(id)) return { boxes: [box(7, 0, 7, 9, 10, 9)], full: false };
  if (/lantern$/.test(id) && id !== 'sea_lantern') return { boxes: [box(5, props.hanging === 'true' ? 7 : 0, 5, 11, props.hanging === 'true' ? 16 : 9, 11)], full: false };
  if (/door$/.test(id) && !id.endsWith('trapdoor')) {
    const f = props.facing;
    const b = f === 'north' ? box(0, 0, 13, 16, 16, 16) : f === 'south' ? box(0, 0, 0, 16, 16, 3) : f === 'west' ? box(13, 0, 0, 16, 16, 16) : box(0, 0, 0, 3, 16, 16);
    return { boxes: [b], full: false };
  }
  if (/trapdoor$/.test(id)) return { boxes: [props.half === 'top' ? box(0, 13, 0, 16, 16, 16) : box(0, 0, 0, 16, 3, 16)], full: false };
  if (/ladder|vine$/.test(id)) {
    const f = props.facing;
    const b = f === 'north' ? box(0, 0, 15, 16, 16, 16) : f === 'south' ? box(0, 0, 0, 16, 16, 1) : f === 'west' ? box(15, 0, 0, 16, 16, 16) : box(0, 0, 0, 1, 16, 16);
    return { boxes: [b], full: false };
  }
  if (PLANT.test(id)) {
    // duas placas cruzadas (como as plantas do jogo)
    return { boxes: [{ ...box(0, 0, 8, 16, 16, 8), rot: 45, faces: ['north', 'south'] }, { ...box(0, 0, 8, 16, 16, 8), rot: -45, faces: ['north', 'south'] }], full: false };
  }
  if (/button$|lever$|candle|_head$|_skull$|flower_pot|^bell$/.test(id)) return { boxes: [box(5, 0, 5, 11, 6, 11)], full: false };
  return { boxes: [FULL], full: true };
}

// ---------- atlas ----------

function hashImg(img: Img): string {
  let h = 2166136261;
  for (let i = 0; i < img.data.length; i++) h = Math.imul(h ^ img.data[i], 16777619);
  return (h >>> 0).toString(36);
}

function colorTile(r: number, g: number, b: number): Img {
  const data = new Uint8ClampedArray(16 * 16 * 4);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const edge = x === 0 || y === 0 || x === 15 || y === 15 ? 0.8 : 1;
      data.set([r * edge, g * edge, b * edge, 255], (y * 16 + x) * 4);
    }
  return { w: 16, h: 16, data };
}

export interface HologramModel {
  geometry: object;
  atlas: Uint8Array;
  atlasSize: [number, number];
  /** y de cada camada (índice = número do osso "c<i>") */
  layers: number[];
  cubes: number;
}

/** Monta geometria + atlas. `identifier` ex.: "geometry.fizzi.p0". */
export async function buildHologramModel(p: GameProject, identifier: string, tex: TextureSource): Promise<HologramModel> {
  const [W, , D] = p.tam;
  // texturas de cada entrada da paleta
  const tiles: Img[] = [];
  const tileIndex = new Map<string, number>();
  const addTile = (img: Img) => {
    const k = hashImg(img);
    let i = tileIndex.get(k);
    if (i === undefined) {
      i = tiles.length;
      tileIndex.set(k, i);
      tiles.push(img);
    }
    return i;
  };
  const palFaces: Record<Face, number>[] = [];
  const shapes: Shape[] = [];
  for (const entry of p.pal) {
    const [name, r, g, b, java] = entry as [string, number, number, number, string?];
    const props = java ? parseState(java).props : {};
    let faces: Record<Face, Img | null>;
    try {
      faces = await tex.faces(name, props);
    } catch {
      faces = { up: null, down: null, north: null, south: null, east: null, west: null };
    }
    const fallback = colorTile(r, g, b);
    const m = {} as Record<Face, number>;
    for (const f of FACES) m[f] = addTile(faces[f] ?? fallback);
    palFaces.push(m);
    shapes.push(shapeOf(java, name));
  }

  // atlas em grade de 16×16
  const cols = Math.max(1, Math.ceil(Math.sqrt(tiles.length)));
  const rows = Math.max(1, Math.ceil(tiles.length / cols));
  const aw = cols * 16, ah = rows * 16;
  const px = new Uint8Array(aw * ah * 4);
  tiles.forEach((t, i) => {
    const ox = (i % cols) * 16, oy = Math.floor(i / cols) * 16;
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const s = (y * 16 + x) * 4, d = ((oy + y) * aw + ox + x) * 4;
        px[d] = t.data[s];
        px[d + 1] = t.data[s + 1];
        px[d + 2] = t.data[s + 2];
        px[d + 3] = Math.round(t.data[s + 3] * OPACITY);
      }
  });
  const tileUv = (i: number) => [(i % cols) * 16, Math.floor(i / cols) * 16];

  // vizinhos para esconder faces encostadas (só na mesma camada, para a visão por camada continuar certa)
  const at = new Map<string, number>();
  for (let i = 0; i + 3 < p.b.length; i += 4) at.set(`${p.b[i]},${p.b[i + 1]},${p.b[i + 2]}`, p.b[i + 3]);
  const solidAt = (x: number, y: number, z: number) => {
    const k = at.get(`${x},${y},${z}`);
    return k !== undefined && shapes[k].full && !TRANSPARENT.test(String(p.pal[k][0]));
  };

  const ys = [...new Set(Array.from({ length: p.b.length / 4 }, (_, i) => p.b[i * 4 + 1]))].sort((a, b) => a - b);
  const bones = new Map<number, object[]>(ys.map((y) => [y, []]));
  let cubes = 0;

  for (let i = 0; i + 3 < p.b.length; i += 4) {
    const [x, y, z, k] = [p.b[i], p.b[i + 1], p.b[i + 2], p.b[i + 3]];
    const shape = shapes[k];
    const hidden: Partial<Record<Face, boolean>> = shape.full
      ? { east: solidAt(x + 1, y, z), west: solidAt(x - 1, y, z), south: solidAt(x, y, z + 1), north: solidAt(x, y, z - 1) }
      : {};
    for (const bx of shape.boxes) {
      const uv: Record<string, { uv: number[]; uv_size: number[] }> = {};
      for (const f of bx.faces ?? FACES) {
        if (hidden[f]) continue;
        const [u, v] = tileUv(palFaces[k][f]);
        // recorte da textura para formatos menores que um bloco (como o jogo faz)
        let r: number[];
        if (f === 'up' || f === 'down') r = [bx.x0, bx.z0, bx.x1 - bx.x0, bx.z1 - bx.z0];
        else if (f === 'north' || f === 'south') r = [bx.x0, 16 - bx.y1, bx.x1 - bx.x0, bx.y1 - bx.y0];
        else r = [bx.z0, 16 - bx.y1, bx.z1 - bx.z0, bx.y1 - bx.y0];
        uv[f] = { uv: [u + r[0], v + r[1]], uv_size: [Math.max(r[2], 0.01), Math.max(r[3], 0.01)] };
      }
      if (!Object.keys(uv).length) continue;
      // encolhe em direção ao centro do bloco (SCALE)
      const [x0, y0, z0, x1, y1, z1] = [bx.x0, bx.y0, bx.z0, bx.x1, bx.y1, bx.z1].map(enc);
      const wx1 = x * 16 + x1;
      const cube: Record<string, unknown> = {
        origin: [-(wx1 - W * 8), y * 16 + y0, z * 16 + z0 - D * 8],
        size: [x1 - x0, y1 - y0, z1 - z0].map((n) => Math.round(n * 1000) / 1000),
        uv,
      };
      if (bx.rot) {
        cube.pivot = [-(x * 16 + 8 - W * 8), y * 16 + 8, z * 16 + 8 - D * 8];
        cube.rotation = [0, bx.rot, 0];
      }
      bones.get(y)!.push(cube);
      cubes++;
    }
  }

  const H = p.tam[1];
  const geometry = {
    format_version: '1.12.0',
    'minecraft:geometry': [
      {
        description: {
          identifier,
          texture_width: aw,
          texture_height: ah,
          visible_bounds_width: Math.max(W, D) * 1.5 + 4,
          visible_bounds_height: H + Math.abs(Math.min(0, ys[0] ?? 0)) + 4,
          visible_bounds_offset: [0, H / 2, 0],
        },
        bones: [{ name: 'raiz', pivot: [0, 0, 0] }, ...ys.map((y, li) => ({ name: `c${li}`, parent: 'raiz', pivot: [0, 0, 0], cubes: bones.get(y) }))],
      },
    ],
  };
  return { geometry, atlas: encodePng(aw, ah, px), atlasSize: [aw, ah], layers: ys, cubes };
}
