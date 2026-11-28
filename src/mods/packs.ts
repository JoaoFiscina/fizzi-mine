// Monta pacotes do Minecraft Bedrock (.mcpack / .mcaddon) no navegador.
// Cada "mod" do FIZZI MINE é um pacote de comportamento (e às vezes um de recursos) gerado aqui,
// com as opções que a pessoa escolheu no site.

import { strToU8, zipSync } from 'fflate';

export type Files = Record<string, Uint8Array>;

export interface ModOption {
  key: string;
  label: string;
  type: 'number' | 'boolean';
  default: number | boolean;
  min?: number;
  max?: number;
  help?: string;
}

export type ModValues = Record<string, number | boolean>;

export interface PackOut {
  /** Nome do arquivo .mcpack (sem pasta). */
  name: string;
  files: Files;
}

export interface ModDef {
  id: string;
  icon: string;
  name: string;
  description: string;
  /** Linhas curtas do que o mod faz (aparece no cartão). */
  features: string[];
  options: ModOption[];
  /** false = aparece como "em breve". */
  ready: boolean;
  build?: (values: ModValues) => PackOut[] | Promise<PackOut[]>;
}

/**
 * Versão do pacote que sempre sobe: [major, dia, minuto]. O Realm só atualiza um pacote quando a
 * versão aumenta; com isso, cada download novo substitui o anterior.
 */
export function packVersion(major: number, now = new Date()): [number, number, number] {
  const start = Date.UTC(2026, 0, 1);
  const day = Math.max(0, Math.floor((now.getTime() - start) / 86_400_000));
  const minute = now.getUTCHours() * 60 + now.getUTCMinutes();
  return [major, day, minute];
}

/**
 * Data e hora do download, para pôr no nome do pacote e do arquivo: assim dá para saber, na lista do
 * Minecraft e na pasta Downloads, qual é a versão nova e quais são as antigas.
 */
export function stamp(now = new Date()): { label: string; file: string } {
  const p = (n: number) => String(n).padStart(2, '0');
  const dia = `${p(now.getDate())}/${p(now.getMonth() + 1)}`;
  const hora = `${p(now.getHours())}h${p(now.getMinutes())}`;
  return { label: `${dia} ${hora}`, file: `${dia.replace('/', '-')}_${hora}` };
}

export const json =(o: unknown) => strToU8(JSON.stringify(o, null, 2));

/** Troca "const NOME = valor;" no topo de um script pelo valor escolhido no site. */
export function setConst(src: string, name: string, value: number | boolean): string {
  const re = new RegExp(`^(const ${name} = )[^;]+;`, 'm');
  if (!re.test(src)) throw new Error(`constante ${name} não encontrada`);
  return src.replace(re, `$1${String(value)};`);
}

export function defaults(mod: ModDef): ModValues {
  return Object.fromEntries(mod.options.map((o) => [o.key, o.default]));
}

/** Um .mcpack é um zip com o manifest.json na raiz. */
export function zipPack(p: PackOut): Uint8Array {
  return zipSync(p.files);
}

/** Um .mcaddon é um zip com vários .mcpack dentro: abre e instala todos de uma vez. */
export function zipAddon(packs: PackOut[]): Uint8Array {
  const files: Files = {};
  for (const p of packs) files[p.name] = zipPack(p);
  return zipSync(files);
}
