// Mensagem pronta para colar na mesma conversa com a IA quando o arquivo veio com problemas.

import type { Stage } from '../project/project';

const STAGE_HINT: Partial<Record<Stage, string>> = {
  estrutura: 'Lembre: esta é a ETAPA 1 (só estrutura, com o campo "plan" de andares e cômodos). Sem mobília.',
  andar: 'Lembre: esta é a ETAPA 2 de um andar: só blocos NOVOS ou trocados, dentro da faixa de y do andar, mesmas coordenadas e mesmo size do projeto.',
  decoracao: 'Lembre: esta é a ETAPA 3 de um andar: só mobília/decoração, colocada SÓ em espaço vazio (não troque paredes, pisos, portas), dentro da faixa de y do andar.',
  exterior: 'Lembre: esta é a etapa da área externa: só blocos novos em espaço vazio, dentro do size do projeto.',
  livre: 'Reenvie ESTA parte completa, com o MESMO número em "part". Depois eu peço a próxima.',
};

export function correctionMessage(opts: { errors: string[]; warnings: string[]; truncated?: boolean; stage?: Stage; stageLabel?: string }): string {
  const hint = opts.stage ? STAGE_HINT[opts.stage] : undefined;
  const which = opts.stageLabel ? ` (${opts.stageLabel})` : '';
  if (opts.truncated) {
    return [
      `Sua resposta${which} foi cortada no meio: o JSON começou mas não terminou.`,
      'Gere de novo o arquivo mc-blueprint COMPLETO desta etapa, do início ao fim, num único bloco ```json, e deixe ele mais curto:',
      '- use "operations" (fill, walls, hollow, roof, repeat) para as partes grandes e repetidas, em vez de desenhar camada por camada;',
      '- use "layers" com "repeat" quando várias camadas seguidas forem iguais;',
      '- só desenhe em "layers" o que tiver detalhe irregular.',
      hint ?? '',
      'Não escreva nada fora do bloco ```json.',
    ].filter(Boolean).join('\n');
  }

  const problems = [...opts.errors, ...opts.warnings];
  return [
    `O arquivo mc-blueprint que você gerou${which} tem os problemas abaixo (encontrados pelo visualizador).`,
    'Corrija TODOS e me devolva o arquivo JSON COMPLETO desta etapa (não só a parte alterada), no mesmo formato, num único bloco ```json, sem texto fora dele.',
    '',
    'Problemas:',
    ...problems.map((p) => `- ${p}`),
    '',
    'Lembretes do formato:',
    '- Coordenadas: x = leste, y = cima, z = sul; tudo inteiro de 0 até size-1. A origem [0,0,0] é o canto noroeste de baixo.',
    '- Cada camada de "layers" tem exatamente size.z linhas, e cada linha exatamente size.x caracteres ("." = ar).',
    '- Todo caractere usado nas camadas precisa estar na "palette".',
    '- IDs de bloco exatos do Minecraft Java em inglês (ex.: oak_planks, stone_bricks, glass_pane).',
    '- Operações válidas: set, fill, hollow, walls, line, clear, roof, repeat.',
    ...(hint ? ['', hint] : []),
  ].join('\n');
}
