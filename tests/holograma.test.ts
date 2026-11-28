import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { blockTexture, buildHolograma, gameProjectFromText, rawItemsOf, toGameProject } from '../src/mods/holograma';
import { buildHologramModel } from '../src/mods/hologramModel';
import { decodeTga, type Img, type TextureSource } from '../src/mods/bedrockTextures';
import { zipPack } from '../src/mods/packs';
import { compile } from '../src/blueprint/compile';
import { parseBlueprint } from '../src/blueprint/parse';
import { emptyProject, exportProject, setPart } from '../src/project/project';
import { encodeProject } from '../src/project/share';

const bp = () =>
  parseBlueprint(JSON.stringify({ meta: { name: 'Casinha' }, size: { x: 3, y: 2, z: 2 }, operations: [
    { op: 'fill', from: [0, 0, 0], to: [2, 0, 1], block: 'stone' },
    { op: 'set', at: [1, 1, 0], block: 'oak_slab[type=bottom]' },
    { op: 'set', at: [0, 1, 1], block: 'poppy' },
  ] })).blueprint!;

/** Fonte de textura falsa: cada bloco devolve um quadrado de uma cor; "poppy" não tem textura. */
const fakeTex: TextureSource = {
  async faces(name) {
    const tile = (v: number): Img => ({ w: 16, h: 16, data: new Uint8ClampedArray(16 * 16 * 4).fill(v) });
    const img = name.includes('poppy') ? null : tile(name.length * 7);
    return { up: img, down: img, north: img, south: img, east: img, west: img };
  },
};

describe('Fizzi Holograma', () => {
  it('projeto compacto: paleta com nome do Bedrock, cor e estado do Java', () => {
    const g = toGameProject(compile(bp()), 'Casinha');
    expect(g.id).toBe('casinha');
    expect(g.tam).toEqual([3, 2, 2]);
    expect(g.b.length).toBe(8 * 4);
    expect(g.pal.map((p) => p[0])).toEqual(['minecraft:stone', 'minecraft:oak_slab', 'minecraft:poppy']);
    expect(g.pal[1][4]).toBe('oak_slab[type=bottom]');
  });

  it('modelo 3D: osso por camada, X invertido e centro no meio, faces encostadas escondidas, laje pela metade, planta cruzada', async () => {
    const m = await buildHologramModel(toGameProject(compile(bp()), 'Casinha'), 'geometry.fizzi.p0', fakeTex);
    const geo = (m.geometry as any)['minecraft:geometry'][0];
    expect(geo.bones.map((b: any) => b.name)).toEqual(['raiz', 'c0', 'c1']);
    expect(m.layers).toEqual([0, 1]);
    const c0 = geo.bones[1].cubes;
    expect(c0).toHaveLength(6);
    // bloco (0,0,0) numa construção 3×2, encolhido a 90%: x do mundo 0.8..15.2 vira -(15.2-24)=8.8; z 0.8 vira -15.2
    expect(c0[0].origin).toEqual([8.8, 0.8, -15.2]);
    expect(c0[0].size).toEqual([14.4, 14.4, 14.4]);
    // vizinho a leste (x+1) é pedra: a face leste some; a oeste (borda) fica
    expect(c0[0].uv.east).toBeUndefined();
    expect(c0[0].uv.west).toBeDefined();
    const c1 = geo.bones[2].cubes;
    const slab = c1.find((c: any) => c.size[1] === 7.2);
    expect(slab.size).toEqual([14.4, 7.2, 14.4]);
    expect(c1.filter((c: any) => c.rotation)).toHaveLength(2);
    // sem textura (poppy) vira um quadrado da cor do bloco no atlas
    expect(m.atlasSize[0]).toBeGreaterThanOrEqual(16);
    expect([...m.atlas.subarray(0, 4)]).toEqual([137, 80, 78, 71]);
  });

  it('pacotes: bloco, receita, entidade com propriedades, modelos e atlas por projeto', async () => {
    const { packs } = await buildHolograma([toGameProject(compile(bp()), 'Casinha')], fakeTex);
    const [bpPack, rp] = packs;
    const b = unzipSync(zipPack(bpPack));
    const r = unzipSync(zipPack(rp));
    const recipe = JSON.parse(strFromU8(b['recipes/holograma.json']))['minecraft:recipe_shaped'];
    expect(recipe.pattern).toEqual(['ODO', 'DPD', 'ODO']);
    expect(recipe.key).toEqual({ O: { item: 'minecraft:obsidian' }, D: { item: 'minecraft:diamond' }, P: { item: 'minecraft:paper' } });
    expect(recipe.result).toEqual({ item: 'fizzi:holograma' });
    const blk = JSON.parse(strFromU8(b['blocks/holograma.json']))['minecraft:block'];
    expect(blk.description.identifier).toBe('fizzi:holograma');
    expect(blk.components['minecraft:geometry']).toBe('minecraft:geometry.full_block');
    const ent = JSON.parse(strFromU8(b['entities/fizzi_projecao.json']))['minecraft:entity'];
    expect(Object.keys(ent.description.properties)).toEqual(['fizzi:projeto', 'fizzi:camada', 'fizzi:giro', 'fizzi:ligado']);
    expect(strFromU8(b['scripts/projetos.js'])).toContain('"camadas":[0,1]');
    const m = JSON.parse(strFromU8(b['manifest.json']));
    const rm = JSON.parse(strFromU8(r['manifest.json']));
    expect(m.dependencies).toContainEqual({ uuid: rm.header.uuid, version: rm.header.version });
    expect(Object.keys(r)).toEqual(expect.arrayContaining([
      'models/entity/fizzi_p0.geo.json', 'textures/entity/fizzi/p0.png', 'entity/fizzi_projecao.entity.json',
      'render_controllers/fizzi_projecao.render_controllers.json',
      'textures/blocks/fizzi_holograma_topo.png', 'textures/terrain_texture.json', 'blocks.json',
    ]));
    const rc = JSON.parse(strFromU8(r['render_controllers/fizzi_projecao.render_controllers.json'])).render_controllers['controller.render.fizzi.projecao'];
    expect(rc.part_visibility).toHaveLength(3); // "*" + 2 camadas
    expect(rc.ignore_lighting).toBe(true);
    expect(r['materials/entity.material']).toBeUndefined();
    expect([...blockTexture('lado').subarray(0, 4)]).toEqual([137, 80, 78, 71]);
  });

  it('itens brutos do projeto vão no pacote (id do Bedrock, quantidade, nome)', async () => {
    const g = toGameProject(compile(bp()), 'Casinha');
    const mat = rawItemsOf(g);
    // 6 pedras = 6 pedregulhos (fornalha); 1 laje de carvalho = 1 receita de 3 tábuas = 1 tronco; 1 papoula
    expect(mat).toContainEqual(['minecraft:cobblestone', 6, expect.any(String)]);
    expect(mat).toContainEqual(['minecraft:oak_log', 1, expect.any(String)]);
    expect(mat.map((m) => m[0])).toContain('minecraft:poppy');
    const { packs } = await buildHolograma([g], fakeTex);
    expect(strFromU8(unzipSync(zipPack(packs[0]))['scripts/projetos.js'])).toContain('"mat":[[');
  });

  it('TGA: lê 32 bits sem compressão (de baixo para cima)', () => {
    const h = new Uint8Array(18);
    h[2] = 2; h[12] = 1; h[14] = 2; h[16] = 32;
    const img = decodeTga(new Uint8Array([...h, 0, 0, 255, 255, 255, 0, 0, 255]))!;
    expect([...img.data]).toEqual([0, 0, 255, 255, 255, 0, 0, 255]); // linha de cima = azul (2ª no arquivo)
  });

  it('projeto de amigo: arquivo de projeto, link e blueprint', () => {
    const p = emptyProject('Torre', 'livre');
    setPart(p, 'livre', 1, JSON.stringify({ size: { x: 1, y: 3, z: 1 }, operations: [{ op: 'fill', from: [0, 0, 0], to: [0, 2, 0], block: 'stone' }] }));
    const fromFile = gameProjectFromText(exportProject(p), 'x');
    expect(typeof fromFile === 'object' && fromFile.nome).toBe('Torre');
    const fromLink = gameProjectFromText('https://exemplo/fizzi-mine/#p=' + encodeProject(exportProject(p)), 'x');
    expect(typeof fromLink === 'object' && fromLink.b.length).toBe(12);
    const fromBp = gameProjectFromText(JSON.stringify({ meta: { name: 'Bloco' }, size: { x: 1, y: 1, z: 1 }, operations: [{ op: 'set', at: [0, 0, 0], block: 'stone' }] }), 'x');
    expect(typeof fromBp === 'object' && fromBp.nome).toBe('Bloco');
    expect(typeof gameProjectFromText('lixo', 'x')).toBe('string');
  });
});
