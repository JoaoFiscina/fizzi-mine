// Texturas do Minecraft do PRÓPRIO usuário.
//
// O usuário escolhe o .jar do jogo instalado (ou um resource pack .zip). Lemos só as imagens de
// assets/minecraft/textures/block/ — tudo no navegador, nada é enviado para lugar nenhum — e
// guardamos no IndexedDB para não precisar escolher de novo. Não distribuímos texturas da Mojang.

import * as THREE from 'three';
import { unzip } from 'fflate';

const PREFIX = 'assets/minecraft/textures/block/';

export interface TexturePack {
  /** Nome do arquivo escolhido (ex.: 1.21.8.jar) */
  name: string;
  /** nome da textura (sem .png) → bytes do PNG */
  files: Map<string, Uint8Array>;
}

/** Lê as texturas de bloco de um .jar do Minecraft ou de um resource pack .zip. */
export async function readPack(file: File): Promise<TexturePack> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const data = await new Promise<Record<string, Uint8Array>>((resolve, reject) =>
    unzip(
      buf,
      {
        filter: (f) => {
          const i = f.name.indexOf(PREFIX);
          return i >= 0 && f.name.endsWith('.png') && !f.name.slice(i + PREFIX.length).includes('/');
        },
      },
      (err, out) => (err ? reject(err) : resolve(out)),
    ),
  );
  const files = new Map<string, Uint8Array>();
  for (const [path, bytes] of Object.entries(data)) {
    const name = path.slice(path.indexOf(PREFIX) + PREFIX.length).replace(/\.png$/, '');
    files.set(name, bytes);
  }
  if (!files.size) throw new Error('Não achei texturas de bloco nesse arquivo. Escolha o .jar da versão do Minecraft (ou um resource pack .zip).');
  return { name: file.name, files };
}

// ---------------------------------------------------------------------------
// Guardar no navegador (IndexedDB)
// ---------------------------------------------------------------------------

const DB = 'fizzi-mine';
const STORE = 'texturas';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePack(p: TexturePack): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ name: p.name, files: [...p.files.entries()] }, 'pack');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* sem IndexedDB: só não lembra depois de recarregar */
  }
}

export async function loadSavedPack(): Promise<TexturePack | undefined> {
  try {
    const db = await openDb();
    const rec = await new Promise<any>((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get('pack');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return rec ? { name: rec.name, files: new Map(rec.files) } : undefined;
  } catch {
    return undefined;
  }
}

export async function forgetPack(): Promise<void> {
  try {
    const db = await openDb();
    db.transaction(STORE, 'readwrite').objectStore(STORE).delete('pack');
  } catch {
    /* nada */
  }
}

// ---------------------------------------------------------------------------
// Qual textura vai em cada face
// ---------------------------------------------------------------------------

export interface Faces {
  top: string;
  bottom: string;
  side: string;
  /** Frente (fornalha, bancada, abóbora…), virada para o "facing". */
  front?: string;
  /** Cor multiplicada nas texturas cinzas (grama, folhas, água). */
  tint?: number;
  /** Só o topo é tingido (bloco de grama). */
  tintTopOnly?: boolean;
}

const GRASS = 0x91bd59;
const FOLIAGE: Record<string, number> = { birch: 0x80a755, spruce: 0x619961, mangrove: 0x92c648 };
const WATER = 0x3f76e4;

const SPECIAL: Record<string, Partial<Faces> & { all?: string }> = {
  grass_block: { top: 'grass_block_top', bottom: 'dirt', side: 'grass_block_side', tint: GRASS, tintTopOnly: true },
  podzol: { top: 'podzol_top', bottom: 'dirt', side: 'podzol_side' },
  mycelium: { top: 'mycelium_top', bottom: 'dirt', side: 'mycelium_side' },
  dirt_path: { top: 'dirt_path_top', bottom: 'dirt', side: 'dirt_path_side' },
  farmland: { top: 'farmland', bottom: 'dirt', side: 'dirt' },
  water: { all: 'water_still', tint: WATER },
  lava: { all: 'lava_still' },
  crafting_table: { top: 'crafting_table_top', bottom: 'oak_planks', side: 'crafting_table_side', front: 'crafting_table_front' },
  bookshelf: { top: 'oak_planks', bottom: 'oak_planks', side: 'bookshelf' },
  snow_block: { all: 'snow' },
  smooth_quartz: { all: 'quartz_block_bottom' },
  smooth_sandstone: { all: 'sandstone_top' },
  smooth_red_sandstone: { all: 'red_sandstone_top' },
  smooth_stone_slab: { all: 'smooth_stone' },
  redstone_wire: { all: 'redstone_dust_dot', tint: 0xc00000 },
  campfire: { all: 'campfire_log' },
  soul_campfire: { all: 'campfire_log' },
  moss_carpet: { all: 'moss_block' },
  pale_moss_carpet: { all: 'pale_moss_block' },
  iron_chain: { all: 'chain' },
  lily_pad: { all: 'lily_pad', tint: 0x208030 },
  // sem textura de bloco (são entidades): ficam com cor
  chest: {}, trapped_chest: {}, ender_chest: {},
};

const WOODS = ['dark_oak', 'pale_oak', 'oak', 'spruce', 'birch', 'jungle', 'acacia', 'mangrove', 'cherry', 'bamboo', 'crimson', 'warped'];
const DERIVED = ['_stairs', '_slab', '_wall', '_fence_gate', '_fence', '_pressure_plate', '_button'];

function grayTint(id: string): number | undefined {
  if (id.endsWith('_leaves') && !/azalea|cherry|pale_oak/.test(id)) return FOLIAGE[id.replace('_leaves', '')] ?? 0x48b518;
  if (/^(short_grass|tall_grass|fern|large_fern|vine|attached_.*_stem|melon_stem|pumpkin_stem)$/.test(id)) return /vine|fern/.test(id) ? 0x48b518 : GRASS;
  return undefined;
}

/** Faces de um bloco "simples" pelo nome das texturas (id, id_top, id_side, id_front, id_bottom). */
function generic(id: string, has: (n: string) => boolean): Faces | undefined {
  const side = [id, `${id}_side`, `${id}_front`].find(has);
  if (!side) return undefined;
  const top = has(`${id}_top`) ? `${id}_top` : side;
  const bottom = has(`${id}_bottom`) ? `${id}_bottom` : top;
  const front = has(`${id}_front`) && side !== `${id}_front` ? `${id}_front` : undefined;
  return { top, bottom, side, front, tint: grayTint(id) };
}

/** Textura de cada face de um bloco. undefined = não achou (o bloco fica com a cor de sempre). */
export function resolveFaces(id: string, props: Record<string, string>, has: (n: string) => boolean): Faces | undefined {
  const sp = SPECIAL[id];
  if (sp) {
    if (!sp.all && !sp.side) return undefined;
    const all = sp.all;
    const f: Faces = { top: all ?? sp.top!, bottom: all ?? sp.bottom!, side: all ?? sp.side!, front: sp.front, tint: sp.tint, tintTopOnly: sp.tintTopOnly };
    return [f.top, f.bottom, f.side].every(has) ? f : undefined;
  }
  if (id.endsWith('_bed') || id.endsWith('_banner') || id.endsWith('_head') || id.endsWith('_skull')) return undefined;

  // portas: textura de cima/baixo conforme a metade
  if (id.endsWith('_door')) {
    const n = `${id}_${props.half === 'upper' ? 'top' : 'bottom'}`;
    return has(n) ? { top: n, bottom: n, side: n } : undefined;
  }
  // painéis de vidro: vidro
  if (id.endsWith('glass_pane')) {
    const n = id.replace(/_pane$/, '');
    return has(n) ? { top: n, bottom: n, side: n } : undefined;
  }
  // tapete → lã da mesma cor
  if (id.endsWith('_carpet') && has(id.replace(/_carpet$/, '_wool'))) {
    const n = id.replace(/_carpet$/, '_wool');
    return { top: n, bottom: n, side: n };
  }
  // tochas de parede, placas
  if (id.endsWith('wall_torch')) return generic(id.replace('wall_torch', 'torch'), has);
  for (const w of WOODS) {
    if (id === `${w}_sign` || id === `${w}_wall_sign` || id === `${w}_hanging_sign` || id === `${w}_wall_hanging_sign`) {
      const n = has(`${w}_planks`) ? `${w}_planks` : undefined;
      return n ? { top: n, bottom: n, side: n } : undefined;
    }
  }
  // madeira (casca dos 6 lados) e hifas
  if (id.endsWith('_wood') || id.endsWith('_hyphae')) {
    const n = id.replace(/_wood$/, '_log').replace(/_hyphae$/, '_stem');
    return has(n) ? { top: n, bottom: n, side: n } : undefined;
  }

  const g = generic(id, has);
  if (g) return g;

  // escadas, lajes, muros, cercas…: textura do material de origem
  for (const suf of DERIVED) {
    if (!id.endsWith(suf)) continue;
    const base = id.slice(0, -suf.length);
    for (const m of [base, `${base}s`, `${base}_planks`, `${base}_block`]) {
      const f = SPECIAL[m]?.all ? resolveFaces(m, {}, has) : generic(m, has);
      if (f) return { ...f, front: undefined };
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Biblioteca de texturas (THREE.Texture sob demanda)
// ---------------------------------------------------------------------------

const TRANSLUCENT = /glass|^ice$|water|nether_portal|slime|honey_block/;

export class TextureLibrary {
  readonly name: string;
  readonly count: number;
  private files: Map<string, Uint8Array>;
  private textures = new Map<string, THREE.Texture>();

  constructor(pack: TexturePack) {
    this.name = pack.name;
    this.files = pack.files;
    this.count = pack.files.size;
  }

  has = (name: string) => this.files.has(name);

  /** Textura pronta para usar (carrega a imagem na primeira vez). */
  get(name: string): THREE.Texture {
    let t = this.textures.get(name);
    if (t) return t;
    t = new THREE.Texture();
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestMipmapLinearFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    const bytes = this.files.get(name);
    if (bytes) {
      const img = new Image();
      const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/png' }));
      img.onload = () => {
        // texturas animadas (água, lava, portal…) são uma tira vertical: usa o 1º quadro
        if (img.height > img.width) {
          t!.repeat.set(1, img.width / img.height);
          t!.offset.set(0, 1 - img.width / img.height);
        }
        t!.image = img;
        t!.needsUpdate = true;
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
    this.textures.set(name, t);
    return t;
  }

  static isTranslucent(name: string) {
    return TRANSLUCENT.test(name);
  }
}
