// Mod "Fizzi Lenhador": machado derruba a árvore inteira; picareta (agachado) quebra o veio de minério.
// O código do jogo fica em mods/lenhador/scripts (esta é a cópia oficial; mude lá).

import { strToU8 } from 'fflate';
import mainJs from '../../mods/lenhador/scripts/main.js?raw';
import comumJs from '../../mods/lenhador/scripts/comum.js?raw';
import mineradorJs from '../../mods/lenhador/scripts/minerador.js?raw';
import { json, packVersion, setConst, stamp, type ModDef, type ModValues } from './packs';

// UUIDs fixos: são os mesmos do pacote que já está no Realm, para o novo substituir o antigo.
const HEADER_UUID = '919d6264-d809-4169-81b5-b4fbf168ff0c';
const SCRIPT_UUID = '23fcf7dc-d3a2-4cd1-97c7-6f25b3e7d459';

export const lenhador: ModDef = {
  id: 'lenhador',
  icon: '🪓',
  name: 'Fizzi Lenhador',
  description: 'Árvore cai inteira com o machado, e o veio de minério sai todo com a picareta.',
  features: [
    'Machado: derruba a árvore toda (só árvores naturais, com folhas; casas não caem).',
    'Gasta a durabilidade de cada tronco e respeita Inquebrável.',
    'Picareta agachado: quebra o veio de minério inteiro (com Fortuna).',
  ],
  ready: true,
  options: [
    { key: 'MAX_TRONCOS', label: 'Máximo de troncos por árvore', type: 'number', default: 200, min: 1, max: 1000 },
    { key: 'MIN_FOLHAS_NATURAIS', label: 'Folhas naturais mínimas para ser árvore', type: 'number', default: 3, min: 1, max: 50, help: 'Mais alto = mais seguro para construções.' },
    { key: 'AGACHAR_DESATIVA', label: 'Agachar desliga o lenhador', type: 'boolean', default: false, help: 'Para não derrubar construções encostadas em árvores.' },
    { key: 'MINERADOR_ATIVO', label: 'Minerador de veio ligado', type: 'boolean', default: true },
    { key: 'MAX_MINERIOS', label: 'Máximo de minérios por veio', type: 'number', default: 64, min: 1, max: 512 },
    { key: 'EXIGIR_AGACHADO', label: 'Minerador só funciona agachado', type: 'boolean', default: true },
  ],
  build(values: ModValues) {
    const v = (k: string) => values[k];
    let main = mainJs;
    for (const k of ['MAX_TRONCOS', 'MIN_FOLHAS_NATURAIS', 'AGACHAR_DESATIVA']) main = setConst(main, k, v(k));
    let minerador = mineradorJs;
    for (const k of ['MINERADOR_ATIVO', 'MAX_MINERIOS', 'EXIGIR_AGACHADO']) minerador = setConst(minerador, k, v(k));
    const now = new Date();
    const version = packVersion(2, now);
    const st = stamp(now);
    const manifest = {
      format_version: 2,
      header: {
        name: `Fizzi Lenhador · ${st.label}`,
        description: `Machado derruba a árvore inteira; agachado com picareta quebra o veio de minério todo. Feito no FIZZI MINE. Versão de ${st.label}.`,
        uuid: HEADER_UUID,
        version,
        min_engine_version: [1, 21, 90],
      },
      modules: [{ type: 'script', language: 'javascript', uuid: SCRIPT_UUID, version, entry: 'scripts/main.js' }],
      dependencies: [{ module_name: '@minecraft/server', version: '2.0.0' }],
    };
    return [
      {
        name: `FizziLenhador_${st.file}.mcpack`,
        files: {
          'manifest.json': json(manifest),
          'scripts/main.js': strToU8(main),
          'scripts/comum.js': strToU8(comumJs),
          'scripts/minerador.js': strToU8(minerador),
        },
      },
    ];
  },
};
