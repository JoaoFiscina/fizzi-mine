// Monta os prompts: o modelo de docs/prompts/*.md + o pedido do formulário
// + (nas etapas 2, 3 e extra) o que já foi construído, em texto, para a IA reler.

import formato from '../../docs/prompts/formato.md?raw';
import completo from '../../docs/prompts/completo.md?raw';
import etapa1 from '../../docs/prompts/etapa1-estrutura.md?raw';
import etapa2 from '../../docs/prompts/etapa2-andar.md?raw';
import etapa3 from '../../docs/prompts/etapa3-mobilia.md?raw';
import exterior from '../../docs/prompts/exterior.md?raw';
import automatico from '../../docs/prompts/automatico.md?raw';
import alteracao from '../../docs/prompts/alteracao.md?raw';
import type { CompiledModel } from '../blueprint/compile';
import { regionToPromptText } from '../blueprint/serialize';
import type { Floor } from '../blueprint/types';
import type { Project, Slot } from '../project/project';

export interface PromptRequest {
  idea: string;
  category: string;
  size: string;
  materials: string;
  version: string;
  refs: string;
  detail: 'simples' | 'medio' | 'detalhado';
  photos: boolean;
  mode?: 'livre' | 'etapas' | 'rapido';
}

export const EMPTY_REQUEST: PromptRequest = {
  idea: '',
  category: 'casa',
  size: '',
  materials: '',
  version: '1.21',
  refs: '',
  detail: 'medio',
  photos: false,
  mode: 'livre',
};

const DETAIL: Record<PromptRequest['detail'], string> = {
  simples: 'simples: só a estrutura principal (paredes, piso, telhado, portas e janelas). Nada de decoração.',
  medio: 'médio: estrutura bem feita + portas, janelas, telhado caprichado, iluminação e interior básico (cama, bancada, baús).',
  detalhado: 'detalhado: estrutura + decoração externa e interior completo. Mesmo assim, use operations para manter o arquivo compacto.',
};

function requestLines(r: PromptRequest, withDetail = true): string[] {
  const lines = [
    `**O que é:** ${r.idea.trim() || '(descreva aqui)'}`,
    `**Tipo:** ${r.category}`,
    `**Tamanho aproximado:** ${r.size.trim() || 'você decide, de um jeito proporcional e jogável'}`,
    `**Materiais / estilo:** ${r.materials.trim() || 'você escolhe, combinando com o estilo'}`,
    `**Versão do Minecraft:** ${r.version.trim() || '1.21'}`,
  ];
  if (withDetail) lines.push(`**Nível de detalhe:** ${DETAIL[r.detail]}`);
  if (r.refs.trim()) lines.push(`**Referências:**\n${r.refs.trim()}`);
  return lines;
}

const PHOTOS =
  '**Fotos:** vou anexar fotos/prints junto com esta mensagem. Analise cada imagem com cuidado: conte os blocos para tirar as medidas, identifique os materiais pela cor e textura e respeite as proporções. Se as imagens mostrarem algo diferente do texto, siga as imagens e avise em "notes".';

function fill(template: string, values: Record<string, string>): string {
  let out = template.replace('<<FORMATO>>', formato.trim());
  for (const [k, v] of Object.entries(values)) out = out.split(`<<${k}>>`).join(v);
  return out;
}

/** Modo rápido: tudo num prompt só. */
export function buildPrompt(r: PromptRequest): string {
  const lines = ['# A construção que eu quero', ...requestLines(r)];
  if (r.photos) lines.push(PHOTOS);
  lines.push('', 'Gere agora o arquivo mc-blueprint completo, num único bloco ```json.');
  return fill(completo, { PEDIDO: lines.join('\n') });
}

const FENCE = '```';
const sizeText = (size?: { x: number; y: number; z: number }) => (size ? `, mesmo size ${JSON.stringify(size)}` : '');

/** Modo automático: prompt inicial (a IA planeja e entrega a parte 1). */
export function buildAutoPrompt(r: PromptRequest): string {
  const lines = ['# A construção que eu quero', ...requestLines(r)];
  if (r.photos) lines.push(PHOTOS);
  lines.push('', `Planeje as partes e entregue agora a PARTE 1 (com "part" e "plan"), num único bloco ${FENCE}json.`);
  return fill(automatico, { PEDIDO: lines.join('\n') });
}

/** Modo automático: mensagem curta para pedir a próxima parte. */
export function continueMessage(nextNumber: number, nextTitle: string | undefined, size?: { x: number; y: number; z: number }): string {
  return [
    `continuar: parte ${nextNumber}${nextTitle ? ` (${nextTitle})` : ''}.`,
    `Só blocos novos ou trocados, com o campo "part"${sizeText(size)} e mesma origem. Um único bloco ${FENCE}json.`,
  ].join('\n');
}

/** Modo automático: pedir uma parte extra descrita pelo usuário. */
export function extraPartMessage(number: number, description: string, size?: { x: number; y: number; z: number }): string {
  return [
    `Quero uma PARTE EXTRA (número ${number}): ${description.trim()}`,
    `Siga as mesmas regras: só blocos novos ou trocados, campo "part" com number ${number}${sizeText(size)} e mesma origem. Releia o que já foi construído para encaixar. Um único bloco ${FENCE}json.`,
  ].join('\n');
}

export interface EditRequest {
  number: number;
  request: string;
  /** Texto do estado atual (regionToPromptText), ou vazio se a IA já conhece. */
  state?: string;
  /** Conversa nova: manda as regras completas do formato. */
  newChat: boolean;
  /** Resumo do projeto (nome, estilo, andares). */
  summary?: string;
}

/** Pedido de alteração/ampliação: só as mudanças, podendo trocar, apagar e ir para coordenadas negativas. */
export function editMessage(e: EditRequest): string {
  const pedido = e.request.trim();
  if (e.newChat) {
    const estado = [e.summary ?? '', e.state ?? '(estado não incluído)'].filter(Boolean).join('\n\n');
    return fill(alteracao, { N: String(e.number), ESTADO: estado, PEDIDO: pedido });
  }
  return [
    `ALTERAÇÃO · parte ${e.number}: ${pedido}`,
    '',
    `Mande só as mudanças, num único bloco ${FENCE}json, com "part": {"number": ${e.number}, "title": "...", "kind": "alteracao"}.`,
    'Pode trocar blocos (coloque o novo no lugar), apagar com "clear" e construir fora da área atual, inclusive em coordenadas negativas (subsolo em y < 0). Mesmas coordenadas do projeto. Ligue o novo ao antigo (portas, passagens, escadas).',
    ...(e.state ? ['', '# Estado atual (para você reler)', e.state] : []),
  ].join('\n');
}

/** Resumo do projeto para o pedido de alteração em conversa nova. */
export function projectSummary(p: Project, style?: string): string {
  const lines = [`**Projeto:** ${p.name}`];
  if (style) lines.push(`**Estilo:** ${style}`);
  if (p.floors.length) {
    lines.push('**Andares:**');
    for (const f of p.floors) {
      const rooms = f.rooms?.map((r) => r.name).join(', ');
      lines.push(`- ${f.name}: y ${f.yFrom} a ${f.yTo}${rooms ? ` (${rooms})` : ''}`);
    }
  }
  return lines.join('\n');
}

function floorText(f: Floor, i: number, total: number): string {
  const lines = [`**${f.name}** (andar ${i + 1} de ${total}): de y=${f.yFrom} até y=${f.yTo}.`];
  if (f.rooms?.length) {
    lines.push('Cômodos (espaço interno):');
    for (const r of f.rooms) {
      const box = r.from && r.to ? ` de [${r.from.join(', ')}] até [${r.to.join(', ')}]` : '';
      lines.push(`- ${r.name}${box}${r.use ? `: ${r.use}` : ''}`);
    }
  } else lines.push('(A planta não lista os cômodos deste andar: deduza pelo estado atual.)');
  return lines.join('\n');
}

function summary(p: Project, model: CompiledModel | undefined, style?: string): string {
  const r = p.request;
  const lines = [`**Nome:** ${p.name}`];
  if (r?.idea.trim()) lines.push(`**Pedido original:** ${r.idea.trim()}`);
  if (r?.materials.trim()) lines.push(`**Materiais / estilo pedidos:** ${r.materials.trim()}`);
  if (style) lines.push(`**Estilo definido na etapa 1:** ${style}`);
  if (r?.version.trim()) lines.push(`**Versão do Minecraft:** ${r.version.trim()}`);
  if (model) lines.push(`**size do projeto:** ${JSON.stringify(model.size)}`);
  if (p.floors.length) lines.push(`**Andares:** ${p.floors.map((f) => `${f.name} (y ${f.yFrom}–${f.yTo})`).join(' · ')}`);
  return lines.join('\n');
}

export interface StageContext {
  /** Modelo com as etapas ANTERIORES a esta (o que já está construído). */
  model?: CompiledModel;
  style?: string;
  exteriorIdea?: string;
}

/** Prompt de uma etapa do projeto. */
export function buildStagePrompt(p: Project, slot: Slot, ctx: StageContext): string {
  const r = p.request ?? EMPTY_REQUEST;
  const sizeText = ctx.model ? JSON.stringify(ctx.model.size) : '(o mesmo da etapa 1)';

  if (slot.stage === 'completo') return buildPrompt(r);
  if (slot.stage === 'livre') return buildAutoPrompt(r);

  if (slot.stage === 'estrutura') {
    const lines = ['# A construção que eu quero', ...requestLines(r, false)];
    if (r.photos) lines.push(PHOTOS);
    lines.push('', 'Gere agora o arquivo da ETAPA 1 (estrutura + "plan"), num único bloco ```json.');
    return fill(etapa1, { PEDIDO: lines.join('\n') });
  }

  const resumo = summary(p, ctx.model, ctx.style);

  if (slot.stage === 'exterior') {
    const top = ctx.model ? Math.min(ctx.model.size.y - 1, 2) : 2;
    const contexto = ctx.model ? regionToPromptText(ctx.model, 0, top) : '(nada construído ainda)';
    const pedido = [
      '# Pedido',
      ctx.exteriorIdea ? `Ideia para a área externa (da etapa 1): ${ctx.exteriorIdea}` : 'Faça uma área externa que combine com a construção.',
      r.photos ? 'Se eu anexar fotos, use como referência.' : '',
      '',
      'Gere agora o arquivo da área externa, num único bloco ```json.',
    ].filter(Boolean);
    return fill(exterior, { RESUMO: resumo, CONTEXTO: contexto, SIZE: sizeText, PEDIDO: pedido.join('\n') });
  }

  // andar ou decoração
  const f = p.floors[slot.floor ?? 0];
  const andar = floorText(f, slot.floor ?? 0, p.floors.length);
  const contexto = ctx.model ? regionToPromptText(ctx.model, f.yFrom, f.yTo) : '(nada construído ainda)';
  const etapa = slot.stage === 'andar' ? 'ETAPA 2 (detalhes de arquitetura)' : 'ETAPA 3 (mobília e decoração)';
  const pedido = [
    '# Pedido',
    `Gere agora o arquivo da ${etapa} do andar "${f.name}", só com os blocos novos, num único bloco \`\`\`json.`,
    r.photos ? 'Se eu anexar fotos, use como referência de estilo.' : '',
    `Nível de detalhe desejado: ${DETAIL[r.detail]}`,
  ].filter(Boolean);
  return fill(slot.stage === 'andar' ? etapa2 : etapa3, {
    RESUMO: resumo,
    ANDAR: andar,
    CONTEXTO: contexto,
    Y0: String(f.yFrom),
    Y1: String(f.yTo),
    SIZE: sizeText,
    PEDIDO: pedido.join('\n'),
  });
}

export function loadDraft(): PromptRequest {
  try {
    return { ...EMPTY_REQUEST, ...JSON.parse(localStorage.getItem('fizzi-mine:pedido') ?? '{}') };
  } catch {
    return { ...EMPTY_REQUEST };
  }
}

export function saveDraft(r: PromptRequest) {
  try {
    localStorage.setItem('fizzi-mine:pedido', JSON.stringify(r));
  } catch {
    /* sem armazenamento */
  }
}
