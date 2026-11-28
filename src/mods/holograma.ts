// Mod "Fizzi Holograma": BLOCO Holograma (obsidiana + diamante + papel) que projeta os projetos do FIZZI MINE
// no mundo com as texturas de verdade (como o HoloPrint): pacote de comportamento (bloco, receita, entidade,
// script) + pacote de recursos (texturas do bloco, modelo 3D e atlas de cada projeto).
// Os projetos vão dentro do pacote: a lista fica salva no navegador (biblioteca do holograma).

import { strToU8 } from 'fflate';
import mainJs from '../../mods/holograma/scripts/main.js?raw';
import { compile, type CompiledModel } from '../blueprint/compile';
import { parseBlueprint } from '../blueprint/parse';
import { buildModel, importProject } from '../project/project';
import { decodeProject } from '../project/share';
import { lookFor } from '../render/blocks';
import { toBedrock } from '../project/mcstructure';
import { json, packVersion, stamp, type ModDef, type PackOut } from './packs';
import { encodePng } from './png';
import { onlineTextures, type TextureSource } from './bedrockTextures';
import { buildHologramModel, type HologramModel } from './hologramModel';

const BP_UUID = 'fc30f160-0f14-4ffa-82f2-7ccb1ba558ae';
const BP_DATA_UUID = '641b4566-f35a-466d-aab3-8dcc9af741c4';
const BP_SCRIPT_UUID = 'a8f50170-4676-408e-8b9b-ef998b96de10';
const RP_UUID = '8246e55b-1c76-46b5-a008-df9dd94df393';
const RP_MODULE_UUID = '4f7c1d2e-9b3a-4e8f-a6d5-2c1b0e9f8a7d';

// ---------- projetos no formato do jogo ----------

export interface GameProject {
  id: string;
  nome: string;
  tam: number[];
  /** [nome no Bedrock, r, g, b, estado do Java (formato/direção)] */
  pal: (string | number)[][];
  /** x, y, z, índice da paleta (y relativo ao chão do projeto) */
  b: number[];
}

function slugify(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'projeto';
}

/** Converte o modelo 3D do site para o formato compacto usado no pacote. */
export function toGameProject(model: CompiledModel, nome: string): GameProject {
  const pal: (string | number)[][] = [];
  const idx = new Map<string, number>();
  const b: number[] = [];
  const oy = model.offset[1];
  for (const v of model.voxels) {
    const bed = toBedrock(v.id, v.props);
    if (!bed) continue;
    let i = idx.get(v.state);
    if (i === undefined) {
      const c = lookFor(v.id, v.props).color;
      i = pal.length;
      idx.set(v.state, i);
      pal.push([bed.name, (c >> 16) & 255, (c >> 8) & 255, c & 255, v.state]);
    }
    b.push(v.x, v.y - oy, v.z, i);
  }
  return { id: slugify(nome), nome, tam: [model.size.x, model.size.y, model.size.z], pal, b };
}

// ---------- biblioteca (projetos que vão no pacote) ----------

const KEY = 'fizzi-mine:holograma';

export function loadLibrary(): GameProject[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function saveLibrary(list: GameProject[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** Adiciona (ou substitui, se já houver um com o mesmo nome). */
export function addToLibrary(p: GameProject): GameProject[] {
  const list = loadLibrary().filter((x) => x.id !== p.id);
  list.push(p);
  saveLibrary(list);
  return list;
}

export function removeFromLibrary(id: string): GameProject[] {
  const list = loadLibrary().filter((x) => x.id !== id);
  saveLibrary(list);
  return list;
}

// ---------- textura do bloco Holograma ----------

/** Obsidiana com detalhes de diamante e uma lente/tela holográfica ciano (16×16). */
export function blockTexture(face: 'topo' | 'lado' | 'baixo'): Uint8Array {
  const px = new Uint8Array(16 * 16 * 4);
  const set = (x: number, y: number, c: number[]) => px.set([c[0], c[1], c[2], 255], (y * 16 + x) * 4);
  const OBS = [[18, 10, 30], [30, 18, 50], [48, 28, 78], [70, 42, 108]];
  const D = [52, 214, 205], DL = [176, 252, 244], B = [16, 70, 120], C = [70, 205, 255], CL = [205, 248, 255];
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      // obsidiana com "ruído" fixo
      const h = ((x * 73856093) ^ (y * 19349663) ^ (face.length * 83492791)) >>> 0;
      const n = h % 17;
      set(x, y, OBS[n < 8 ? 0 : n < 13 ? 1 : n < 16 ? 2 : 3]);
      if ((x < 2 || x > 13) && (y < 2 || y > 13)) set(x, y, (x + y) % 3 === 0 ? DL : D);
      if (face === 'topo') {
        const r = Math.hypot(x - 7.5, y - 7.5);
        if (r < 5.4) set(x, y, r > 4.4 ? ((x + y) % 2 ? D : DL) : r > 3.5 ? B : r > 1.8 ? C : CL);
        if (x === 6 && y === 5) set(x, y, [255, 255, 255]);
      } else if (face === 'lado') {
        if (y === 0 || y === 15) set(x, y, x % 4 === 1 ? DL : D);
        if (x >= 3 && x <= 12 && y >= 4 && y <= 11) {
          const border = x === 3 || x === 12 || y === 4 || y === 11;
          set(x, y, border ? D : y % 2 ? C : B);
          if (!border && ((x === 6 && y >= 6 && y <= 9) || (y === 7 && x >= 5 && x <= 10))) set(x, y, CL);
        }
      }
    }
  return encodePng(16, 16, px);
}

// ---------- pacotes ----------

const block = {
  format_version: '1.21.80',
  'minecraft:block': {
    description: { identifier: 'fizzi:holograma', menu_category: { category: 'items' } },
    components: {
      'minecraft:destructible_by_mining': { seconds_to_destroy: 1.5 },
      'minecraft:destructible_by_explosion': { explosion_resistance: 30 },
      'minecraft:light_emission': 7,
      'minecraft:map_color': '#2bd0d0',
      // desde o 1.21.80, quem usa material_instances precisa dizer a geometria também (senão o bloco fica com cara de terra)
      'minecraft:geometry': 'minecraft:geometry.full_block',
      'minecraft:material_instances': {
        '*': { texture: 'fizzi_holograma_lado', render_method: 'opaque' },
        up: { texture: 'fizzi_holograma_topo', render_method: 'opaque' },
        down: { texture: 'fizzi_holograma_baixo', render_method: 'opaque' },
      },
    },
  },
};

const recipe = {
  format_version: '1.20.10',
  'minecraft:recipe_shaped': {
    description: { identifier: 'fizzi:holograma' },
    tags: ['crafting_table'],
    pattern: ['ODO', 'DPD', 'ODO'],
    key: { O: { item: 'minecraft:obsidian' }, D: { item: 'minecraft:diamond' }, P: { item: 'minecraft:paper' } },
    unlock: [{ item: 'minecraft:paper' }, { item: 'minecraft:diamond' }],
    result: { item: 'fizzi:holograma' },
  },
};

/** Entidade invisível que carrega o modelo 3D (sem colisão, não leva dano, não some). */
function entityBehavior(nProjects: number, maxLayers: number) {
  return {
    format_version: '1.21.40',
    'minecraft:entity': {
      description: {
        identifier: 'fizzi:projecao',
        is_spawnable: false,
        is_summonable: true,
        properties: {
          'fizzi:projeto': { type: 'int', range: [0, Math.max(1, nProjects - 1)], default: 0, client_sync: true },
          'fizzi:camada': { type: 'int', range: [-1, Math.max(1, maxLayers)], default: -1, client_sync: true },
          'fizzi:giro': { type: 'int', range: [0, 3], default: 0, client_sync: true },
          'fizzi:ligado': { type: 'bool', default: true, client_sync: true },
        },
      },
      components: {
        'minecraft:type_family': { family: ['fizzi_projecao', 'inanimate'] },
        'minecraft:collision_box': { width: 0.01, height: 0.01 },
        'minecraft:physics': { has_gravity: false, has_collision: false },
        'minecraft:pushable': { is_pushable: false, is_pushable_by_piston: false },
        'minecraft:damage_sensor': { triggers: [{ cause: 'all', deals_damage: 'no' }] },
        'minecraft:knockback_resistance': { value: 1 },
        'minecraft:fire_immune': {},
        'minecraft:persistent': {},
        'minecraft:body_rotation_blocked': {},
        'minecraft:health': { value: 1, max: 1 },
      },
    },
  };
}

export interface HologramBuild {
  packs: PackOut[];
  report: { nome: string; cubos: number; atlas: string }[];
}

/** Monta os dois pacotes (comportamento + recursos). As texturas do Bedrock vêm de `tex`. */
export async function buildHolograma(list: GameProject[], tex: TextureSource, onProgress?: (msg: string) => void): Promise<HologramBuild> {
  const now = new Date();
  const version = packVersion(1, now);
  const st = stamp(now);
  const models: HologramModel[] = [];
  for (const [i, p] of list.entries()) {
    onProgress?.(`Montando ${p.nome} (${i + 1} de ${list.length})…`);
    models.push(await buildHologramModel(p, `geometry.fizzi.p${i}`, tex));
  }
  const maxLayers = Math.max(1, ...models.map((m) => m.layers.length));
  const ids = list.map((_, i) => `p${i}`);
  const safeIds = ids.length ? ids : ['p0'];

  const clientEntity = {
    format_version: '1.10.0',
    'minecraft:client_entity': {
      description: {
        identifier: 'fizzi:projecao',
        materials: { holo: 'entity_alphablend' },
        textures: Object.fromEntries(ids.map((id) => [id, `textures/entity/fizzi/${id}`])),
        geometry: Object.fromEntries(ids.map((id, i) => [id, `geometry.fizzi.p${i}`])),
        animations: { giro: 'animation.fizzi.giro' },
        scripts: { animate: ['giro'], should_update_bones_and_effects_offscreen: '1' },
        render_controllers: ['controller.render.fizzi.projecao'],
      },
    },
  };
  const on = "q.property('fizzi:ligado')";
  const renderController = {
    format_version: '1.10.0',
    render_controllers: {
      'controller.render.fizzi.projecao': {
        arrays: {
          geometries: { 'Array.geos': safeIds.map((id) => `Geometry.${id}`) },
          textures: { 'Array.texs': safeIds.map((id) => `Texture.${id}`) },
        },
        geometry: "Array.geos[q.property('fizzi:projeto')]",
        materials: [{ '*': 'Material.holo' }],
        // sempre claro: sem isso, a construção fica escura à noite ou quando o centro cai dentro de um bloco
        ignore_lighting: true,
        textures: ["Array.texs[q.property('fizzi:projeto')]"],
        part_visibility: [
          { '*': on },
          ...Array.from({ length: maxLayers }, (_, li) => ({ [`c${li}`]: `${on} && (q.property('fizzi:camada') < 0 || q.property('fizzi:camada') == ${li})` })),
        ],
      },
    },
  };
  const animation = {
    format_version: '1.8.0',
    animations: { 'animation.fizzi.giro': { loop: true, bones: { raiz: { rotation: [0, "q.property('fizzi:giro') * 90", 0] } } } },
  };

  const meta = list.map((p, i) => ({ nome: p.nome, tam: p.tam, camadas: models[i].layers, blocos: p.b.length / 4 }));
  const projetosJs = `// Gerado pelo FIZZI MINE em ${new Date().toISOString()}\nexport const PROJETOS = ${JSON.stringify(meta)};\n`;

  const rpFiles: Record<string, Uint8Array> = {
    'manifest.json': json({
      format_version: 2,
      header: { name: `Fizzi Holograma (recursos) · ${st.label}`, description: `Bloco Holograma e modelos 3D dos projetos. Versão de ${st.label}.`, uuid: RP_UUID, version, min_engine_version: [1, 21, 90] },
      modules: [{ type: 'resources', uuid: RP_MODULE_UUID, version }],
    }),
    'blocks.json': json({ format_version: '1.21.40', 'fizzi:holograma': { sound: 'stone' } }),
    'textures/terrain_texture.json': json({
      resource_pack_name: 'fizzi',
      texture_name: 'atlas.terrain',
      texture_data: {
        fizzi_holograma_topo: { textures: 'textures/blocks/fizzi_holograma_topo' },
        fizzi_holograma_lado: { textures: 'textures/blocks/fizzi_holograma_lado' },
        fizzi_holograma_baixo: { textures: 'textures/blocks/fizzi_holograma_baixo' },
      },
    }),
    'textures/blocks/fizzi_holograma_topo.png': blockTexture('topo'),
    'textures/blocks/fizzi_holograma_lado.png': blockTexture('lado'),
    'textures/blocks/fizzi_holograma_baixo.png': blockTexture('baixo'),
    'entity/fizzi_projecao.entity.json': json(clientEntity),
    'render_controllers/fizzi_projecao.render_controllers.json': json(renderController),
    'animations/fizzi_projecao.animation.json': json(animation),
    'texts/pt_BR.lang': strToU8('tile.fizzi:holograma.name=Holograma\nentity.fizzi:projecao.name=Projeção\n'),
    'texts/en_US.lang': strToU8('tile.fizzi:holograma.name=Hologram\nentity.fizzi:projecao.name=Projection\n'),
    'texts/languages.json': json(['pt_BR', 'en_US']),
  };
  models.forEach((m, i) => {
    rpFiles[`models/entity/fizzi_p${i}.geo.json`] = strToU8(JSON.stringify(m.geometry));
    rpFiles[`textures/entity/fizzi/p${i}.png`] = m.atlas;
  });

  const bpManifest = {
    format_version: 2,
    header: { name: `Fizzi Holograma · ${st.label}`, description: `Bloco Holograma: projeta construções do FIZZI MINE. ${list.length} projeto(s). Versão de ${st.label}.`, uuid: BP_UUID, version, min_engine_version: [1, 21, 90] },
    modules: [
      { type: 'data', uuid: BP_DATA_UUID, version },
      { type: 'script', language: 'javascript', uuid: BP_SCRIPT_UUID, version, entry: 'scripts/main.js' },
    ],
    dependencies: [
      { module_name: '@minecraft/server', version: '2.0.0' },
      { module_name: '@minecraft/server-ui', version: '2.0.0' },
      { uuid: RP_UUID, version },
    ],
  };

  return {
    packs: [
      {
        name: `FizziHolograma_${st.file}.mcpack`,
        files: {
          'manifest.json': json(bpManifest),
          'blocks/holograma.json': json(block),
          'recipes/holograma.json': json(recipe),
          'entities/fizzi_projecao.json': json(entityBehavior(list.length, maxLayers)),
          'scripts/main.js': strToU8(mainJs),
          'scripts/projetos.js': strToU8(projetosJs),
        },
      },
      { name: `FizziHolograma_Recursos_${st.file}.mcpack`, files: rpFiles },
    ],
    report: list.map((p, i) => ({ nome: p.nome, cubos: models[i].cubes, atlas: models[i].atlasSize.join('×') })),
  };
}

export const holograma: ModDef = {
  id: 'holograma',
  icon: '🔮',
  name: 'Fizzi Holograma',
  description: 'Bloco Holograma que projeta os seus projetos do FIZZI MINE no jogo, com as texturas de verdade dos blocos.',
  features: [
    'Craft na bancada: obsidiana nos 4 cantos, diamante nos 4 lados, papel no meio. Sai um BLOCO.',
    'Coloque o bloco e clique nele: escolher projeto, ligar/desligar, mover, girar 90°, camada por camada.',
    'Holograma translúcido com as texturas dos blocos do jogo (todos veem).',
  ],
  options: [],
  ready: true,
  build: async () => (await buildHolograma(loadLibrary(), onlineTextures())).packs,
};

// ---------- adicionar projeto de um amigo (arquivo ou link) ----------

/**
 * Lê um projeto mandado por alguém: arquivo de projeto (.projeto.json), blueprint (.json) ou link do
 * FIZZI MINE (com #p=…). Devolve o projeto pronto, ou uma mensagem de erro.
 */
export function gameProjectFromText(text: string, fallbackName: string): GameProject | string {
  const t = text.trim();
  const code = t.match(/#p=([A-Za-z0-9_-]+)/)?.[1];
  const projJson = code ? decodeProject(code) : t;
  if (projJson) {
    const proj = importProject(projJson);
    if (proj) {
      const m = buildModel(proj).model;
      if (m?.voxels.length) return toGameProject(m, proj.name || fallbackName);
      return 'O projeto está vazio.';
    }
  }
  if (code) return 'Link inválido ou incompleto.';
  const r = parseBlueprint(t);
  if (!r.ok || !r.blueprint) return 'Não reconheci o arquivo (precisa ser um projeto ou blueprint do FIZZI MINE).';
  const m = compile(r.blueprint);
  if (!m.voxels.length) return 'O blueprint está vazio.';
  return toGameProject(m, r.blueprint.meta?.name || fallbackName);
}
