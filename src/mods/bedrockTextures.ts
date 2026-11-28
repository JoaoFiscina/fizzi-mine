// Texturas oficiais do Minecraft Bedrock (repositório Mojang/bedrock-samples, via jsDelivr), como o HoloPrint faz.
// blocks.json diz quais texturas cada bloco usa em cada face; terrain_texture.json diz onde está cada arquivo.

export const SAMPLES_VERSION = '1.26.60.5';
const BASE = `https://cdn.jsdelivr.net/gh/Mojang/bedrock-samples@${SAMPLES_VERSION}/resource_pack/`;

export type Face = 'up' | 'down' | 'north' | 'south' | 'east' | 'west';
export const FACES: Face[] = ['up', 'down', 'north', 'south', 'east', 'west'];

export interface Img {
  w: number;
  h: number;
  /** RGBA */
  data: Uint8ClampedArray;
}

/** Fonte de texturas: para cada face do bloco, a imagem (16×16) ou null se não achou. */
export interface TextureSource {
  faces(bedrockName: string, props: Record<string, string>): Promise<Record<Face, Img | null>>;
}

// cores de bioma (planície), as mesmas da visualização "Texturas do jogo"
const GRASS = 0x91bd59, FOLIAGE = 0x48b518, WATER = 0x3f76e4;
const TINTS: [RegExp, number][] = [
  [/grass_top|tallgrass|double_plant_grass|fern|vine|waterlily|grass_carried/, GRASS],
  [/leaves_birch|birch_leaves/, 0x80a755],
  [/leaves_spruce|spruce_leaves/, 0x619961],
  [/mangrove_leaves/, 0x92c648],
  [/leaves|reeds/, FOLIAGE],
  [/water/, WATER],
];
// folhas de cerejeira, azaleia e as já coloridas não levam tinta
const NO_TINT = /cherry|azalea|pale_oak|carried|_opaque/;

/** Nomes do Bedrock que mudam no blocks.json. */
const ALIAS: Record<string, string> = { grass_block: 'grass', short_grass: 'tallgrass' };
/** Textura trocada por uma versão que já vem colorida. */
const PATH_SWAP: Record<string, string> = { 'textures/blocks/grass_side': 'textures/blocks/grass_side_carried' };

const stripComments = (s: string) => s.replace(/^\s*\/\/.*$/gm, '');

function tint(img: Img, color: number): Img {
  const r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
  const d = new Uint8ClampedArray(img.data);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = (d[i] * r) / 255;
    d[i + 1] = (d[i + 1] * g) / 255;
    d[i + 2] = (d[i + 2] * b) / 255;
  }
  return { ...img, data: d };
}

/** Recorta o primeiro quadro (texturas animadas são uma tira vertical) e garante 16×16. */
export function firstFrame(img: Img): Img {
  const size = img.w;
  if (size === 16 && img.h === 16) return img;
  const out = new Uint8ClampedArray(16 * 16 * 4);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const sx = Math.floor((x * size) / 16), sy = Math.floor((y * size) / 16);
      out.set(img.data.subarray((sy * img.w + sx) * 4, (sy * img.w + sx) * 4 + 4), (y * 16 + x) * 4);
    }
  return { w: 16, h: 16, data: out };
}

/** TGA sem compressão ou RLE, 24/32 bits (algumas texturas do Bedrock são .tga). */
export function decodeTga(buf: Uint8Array): Img | null {
  const idLen = buf[0], type = buf[2];
  const w = buf[12] | (buf[13] << 8), h = buf[14] | (buf[15] << 8), bpp = buf[16], desc = buf[17];
  if ((type !== 2 && type !== 10) || (bpp !== 24 && bpp !== 32)) return null;
  const px = bpp / 8;
  const data = new Uint8ClampedArray(w * h * 4);
  let p = 18 + idLen, i = 0;
  const put = (o: number) => {
    data[i * 4] = buf[o + 2];
    data[i * 4 + 1] = buf[o + 1];
    data[i * 4 + 2] = buf[o];
    data[i * 4 + 3] = px === 4 ? buf[o + 3] : 255;
    i++;
  };
  while (i < w * h && p < buf.length) {
    if (type === 2) {
      put(p);
      p += px;
    } else {
      const c = buf[p++], n = (c & 127) + 1;
      if (c & 128) {
        for (let k = 0; k < n; k++) put(p);
        p += px;
      } else for (let k = 0; k < n; k++, p += px) put(p);
    }
  }
  if (!(desc & 0x20)) {
    // origem embaixo: vira de cabeça para cima
    const row = w * 4, tmp = new Uint8ClampedArray(row);
    for (let y = 0; y < h / 2; y++) {
      const a = y * row, b = (h - 1 - y) * row;
      tmp.set(data.subarray(a, a + row));
      data.copyWithin(a, b, b + row);
      data.set(tmp, b);
    }
  }
  return { w, h, data };
}

async function decodePng(buf: ArrayBuffer): Promise<Img> {
  const bmp = await createImageBitmap(new Blob([buf], { type: 'image/png' }));
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  ctx.drawImage(bmp, 0, 0);
  const d = ctx.getImageData(0, 0, bmp.width, bmp.height);
  return { w: d.width, h: d.height, data: d.data };
}

type TexRef = string | { path: string } | (string | { path: string })[];

/** Fonte que baixa da internet (com cache na memória). */
export function onlineTextures(fetcher: typeof fetch = fetch.bind(globalThis)): TextureSource {
  let tables: Promise<{ blocks: Record<string, { textures?: string | Record<string, string> }>; terrain: Record<string, { textures: TexRef }> }> | null = null;
  const images = new Map<string, Promise<Img | null>>();

  const loadTables = () =>
    (tables ??= Promise.all([
      fetcher(BASE + 'blocks.json').then((r) => r.text()),
      fetcher(BASE + 'textures/terrain_texture.json').then((r) => r.text()),
    ]).then(([b, t]) => ({ blocks: JSON.parse(stripComments(b)), terrain: JSON.parse(stripComments(t)).texture_data })));

  const loadImage = (path: string) => {
    if (!images.has(path))
      images.set(
        path,
        (async () => {
          let r = await fetcher(BASE + path + '.png');
          if (r.ok) return firstFrame(await decodePng(await r.arrayBuffer()));
          r = await fetcher(BASE + path + '.tga');
          if (r.ok) {
            const img = decodeTga(new Uint8Array(await r.arrayBuffer()));
            return img && firstFrame(img);
          }
          return null;
        })().catch(() => null),
      );
    return images.get(path)!;
  };

  const pathOf = (terrain: Record<string, { textures: TexRef }>, key: string): string | null => {
    const t = terrain[key]?.textures;
    if (!t) return null;
    const first = Array.isArray(t) ? t[0] : t;
    return typeof first === 'string' ? first : first?.path ?? null;
  };

  return {
    async faces(bedrockName, props) {
      const { blocks, terrain } = await loadTables();
      const name = bedrockName.replace(/^minecraft:/, '');
      const entry = blocks[ALIAS[name] ?? name];
      let keys: Record<Face, string | undefined>;
      const tex = entry?.textures;
      if (typeof tex === 'string') keys = { up: tex, down: tex, north: tex, south: tex, east: tex, west: tex };
      else if (tex) {
        const side = tex.side;
        keys = { up: tex.up, down: tex.down, north: tex.north ?? side, south: tex.south ?? side, east: tex.east ?? side, west: tex.west ?? side };
      } else keys = { up: name, down: name, north: name, south: name, east: name, west: name }; // às vezes a chave é o próprio nome

      // troncos deitados: a "ponta" vai para os lados
      const axis = props.axis;
      if (axis === 'x') keys = { ...keys, east: keys.up, west: keys.up, up: keys.north, down: keys.north };
      if (axis === 'z') keys = { ...keys, north: keys.up, south: keys.up, up: keys.east, down: keys.east };
      // blocos com frente (fornalha, abóbora…): a face "south" do Bedrock é a frente
      const f = props.facing as Face | undefined;
      if (f && ['north', 'east', 'west'].includes(f) && keys.south !== keys.north) {
        const front = keys.south;
        keys = { ...keys, south: keys.north, [f]: front };
      }

      const out = {} as Record<Face, Img | null>;
      for (const face of FACES) {
        const key = keys[face];
        let path = key ? pathOf(terrain, key) : null;
        if (!path) {
          out[face] = null;
          continue;
        }
        path = PATH_SWAP[path] ?? path;
        let img = await loadImage(path);
        if (img && !NO_TINT.test(path)) {
          const t = TINTS.find(([re]) => re.test(path!));
          if (t) img = tint(img, t[1]);
        }
        out[face] = img;
      }
      return out;
    },
  };
}
