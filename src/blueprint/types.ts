// Formato "mc-blueprint" v1 — o arquivo que a IA gera e o visualizador lê.
// Especificação completa em docs/FORMATO.md.
//
// Coordenadas: x → leste, y → cima, z → sul.
// Origem [0,0,0] = canto noroeste da camada mais baixa.

export type Vec3 = [number, number, number];

export interface BlueprintMeta {
  name: string;
  description?: string;
  /** casa, farm, decoracao, redstone, outro... */
  category?: string;
  author?: string;
  minecraftVersion?: string;
  /** Links de vídeos, posts, imagens usados como referência. */
  sources?: string[];
}

/** Uma camada horizontal desenhada em texto. rows[z][x] = caractere da paleta. */
export interface Layer {
  y: number;
  name?: string;
  rows: string[];
  /** Repete a mesma camada para cima: y, y+1, ... (repeat vezes no total). */
  repeat?: number;
}

interface Ranged {
  from: Vec3;
  to: Vec3;
}

export type Operation =
  | { op: 'set'; at: Vec3; block: string; note?: string }
  | ({ op: 'fill' | 'hollow' | 'walls' | 'line'; block: string; note?: string } & Ranged)
  | ({ op: 'clear'; note?: string } & Ranged)
  | ({
      op: 'roof';
      /** Bloco de escada do telhado, ex.: "spruce_stairs" */
      block: string;
      /** Direção da cumeeira (linha mais alta): "x" = leste-oeste, "z" = norte-sul. */
      axis?: 'x' | 'z';
      /** Bloco da cumeeira quando a largura é ímpar. Padrão: a laje da mesma madeira/pedra. */
      ridge?: string;
      /** Preenche os triângulos das pontas (oitões) com este bloco. */
      gable?: string;
      note?: string;
    } & Ranged)
  | { op: 'repeat'; times: number; offset: Vec3; operations: Operation[]; note?: string };

export interface Step {
  title: string;
  description?: string;
  /** Faixa de camadas que esse passo cobre (para o visualizador pular até lá). */
  yFrom?: number;
  yTo?: number;
}

/** Cômodo de um andar (vem da etapa 1, usado para guiar as etapas 2 e 3). */
export interface Room {
  name: string;
  from?: Vec3;
  to?: Vec3;
  /** Para que serve / o que deve ter (ex.: "quarto de casal com guarda-roupa"). */
  use?: string;
}

export interface Floor {
  name: string;
  /** Do piso deste andar até logo abaixo do piso do próximo. */
  yFrom: number;
  yTo: number;
  rooms?: Room[];
}

/** Planta da construção, gerada na etapa 1 (estrutura). */
export interface Plan {
  floors: Floor[];
  style?: string;
  exterior?: string;
}

/** Modo automático: a IA diz que parte é esta e qual vem depois. */
export interface PartInfo {
  number?: number;
  of?: number;
  title?: string;
  /** estrutura | detalhe | mobilia | exterior | outro. Mobília e exterior só usam espaço vazio. */
  kind?: string;
  yFrom?: number;
  yTo?: number;
  /** Título da próxima parte ("" na última). */
  next?: string;
  done?: boolean;
}

export interface Blueprint {
  /** Só na etapa 1: andares e cômodos. */
  plan?: Plan;
  /** Modo automático: informações desta parte. */
  part?: PartInfo;
  format: 'mc-blueprint';
  version: 1;
  meta: BlueprintMeta;
  size: { x: number; y: number; z: number };
  /** Caractere → bloco. "." e " " são sempre ar. */
  palette?: Record<string, string>;
  layers?: Layer[];
  operations?: Operation[];
  steps?: Step[];
  notes?: string[];
}
