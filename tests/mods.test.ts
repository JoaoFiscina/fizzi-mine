import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { lenhador } from '../src/mods/lenhador';
import { defaults, packVersion, setConst, zipAddon, zipPack } from '../src/mods/packs';

describe('mods', () => {
  it('Lenhador: manifest com os UUIDs do pacote antigo, versão nova e scripts na raiz', () => {
    const [p] = lenhador.build!(defaults(lenhador));
    const files = unzipSync(zipPack(p));
    expect(Object.keys(files).sort()).toEqual(['manifest.json', 'scripts/comum.js', 'scripts/main.js', 'scripts/minerador.js']);
    const m = JSON.parse(strFromU8(files['manifest.json']));
    expect(m.header.uuid).toBe('919d6264-d809-4169-81b5-b4fbf168ff0c');
    expect(m.header.version[0]).toBe(2); // maior que o 1.1.0 que já está no Realm
    expect(m.dependencies[0]).toEqual({ module_name: '@minecraft/server', version: '2.0.0' });
  });

  it('opções do site entram no script', () => {
    const [p] = lenhador.build!({ ...defaults(lenhador), MAX_TRONCOS: 50, AGACHAR_DESATIVA: true, MINERADOR_ATIVO: false });
    const main = strFromU8(p.files['scripts/main.js']);
    expect(main).toContain('const MAX_TRONCOS = 50;');
    expect(main).toContain('const AGACHAR_DESATIVA = true;');
    expect(strFromU8(p.files['scripts/minerador.js'])).toContain('const MINERADOR_ATIVO = false;');
  });

  it('.mcaddon traz os .mcpack dentro; versão sempre sobe', () => {
    const packs = lenhador.build!(defaults(lenhador));
    expect(Object.keys(unzipSync(zipAddon(packs)))).toEqual(['FizziLenhador.mcpack']);
    const a = packVersion(2, new Date('2026-11-27T10:00:00Z'));
    const b = packVersion(2, new Date('2026-11-27T10:01:00Z'));
    const c = packVersion(2, new Date('2026-11-28T00:00:00Z'));
    expect(b[2]).toBeGreaterThan(a[2]);
    expect(c[1]).toBeGreaterThan(a[1]);
    expect(() => setConst('const X = 1;', 'Y', 2)).toThrow();
  });
});
