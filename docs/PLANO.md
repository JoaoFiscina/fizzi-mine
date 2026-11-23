# Plano do projeto: Blueprint de construções de Minecraft com IA

## A ideia em uma frase

Você descreve uma construção para uma IA (texto, fotos, prints, links). A IA devolve um **arquivo de blueprint**. A ferramenta transforma esse arquivo num **modelo 3D navegável**, com **lista de materiais**, **camada por camada**, **medidas** e **passo a passo**.

**Sem custo:** nada de API paga. Você usa a IA que já tem no navegador (Claude, ChatGPT, Gemini…). A ferramenta monta o prompt e lê a resposta.

## Fluxo

```
 ┌──────────────────┐   copia    ┌──────────────┐   copia    ┌──────────────────────┐
 │ ① Gerar prompt   │ ─────────► │  IA no chat  │ ─────────► │ ② Colar resposta     │
 │ (formulário com  │            │ (+ fotos)    │            │ 3D · camadas · mapa  │
 │  a sua ideia)    │            └──────────────┘            │ materiais · medidas  │
 └──────────────────┘                   ▲                    └──────────┬───────────┘
                                        │   "Copiar pedido de correção" │
                                        └───────────────────────────────┘
                                          (só se aparecerem avisos)
```

## Como evitamos erro na "transcrição" IA → arquivo

São três camadas de proteção:

0. **Dividir o trabalho em etapas** (modo em etapas): 1 · estrutura + planta → 2 · detalhes de cada andar → 3 · mobília de cada andar → extra · área externa. Cada resposta é curta e focada, e a IA recebe de volta, em texto, o que já foi construído naquele andar. Mobília não pode sobrescrever a estrutura (o visualizador protege e avisa).
1. **Prompt bem amarrado** ([docs/prompts](prompts/)): explica coordenadas, regras e IDs de bloco, traz um exemplo completo (testado: abre sem nenhum aviso) e uma checklist para a IA conferir antes de responder.
2. **Formato que facilita acertar**: `fill`/`walls`/`hollow` para as partes grandes, `roof` para telhados (as escadas já saem viradas certo, que é onde a IA mais erra), `repeat` para andares e módulos iguais, e camadas em texto com `repeat`. Arquivo menor = menos chance de erro e de resposta cortada.
3. **Leitura tolerante + correção guiada** ([parse.ts](../src/blueprint/parse.ts)):
   - conserta sozinho o que é inequívoco (texto em volta, comentários, vírgula sobrando, nomes de campo diferentes, IDs com erro de digitação, coordenadas negativas…) e lista o que mudou;
   - o que pode estar errado de verdade vira **aviso**, com o botão **Copiar pedido de correção para a IA**, que gera uma mensagem pronta para colar na mesma conversa;
   - se a resposta veio **cortada no meio**, detecta e gera um pedido específico ("refaça mais compacto").
   - Tudo isso é coberto por testes automáticos (`npm test`).

## Decisões principais

| Decisão | Escolha | Por quê |
|---|---|---|
| Plataforma | **Web app** (abre no navegador) | Seus amigos usam sem instalar nada; dá para hospedar de graça. |
| Linguagem | **TypeScript** | JavaScript com tipos, pega erro cedo. |
| 3D | **Three.js** com `InstancedMesh` | Aguenta dezenas de milhares de blocos. |
| Build | **Vite** | Rápido, zero configuração. |
| IA | **Manual, pelo chat** | De graça, funciona com qualquer IA, aceita fotos. |

## Limitações

1. **A IA não "assiste" vídeo.** Mande prints dos momentos importantes (de cima, de lado, cada camada) e/ou descreva.
2. **IA é boa no macro e erra detalhe.** Dimensões, paredes, telhado, porta e janela ela acerta bem. Um detalhe ou outro pode sair torto; os avisos e o pedido de correção ajudam.
3. **Sem texturas do Minecraft** (são da Mojang). Os blocos usam cores sólidas com borda e formas reais (escada, laje, porta, cerca, painel, muro, tocha…).

---

## Fases

### Fase 0: Fundação ✅
- [x] Formato `mc-blueprint` v1 → [FORMATO.md](FORMATO.md) + [schema](../schema/blueprint.schema.json)
- [x] Prompt para a IA, com exemplo e checklist

### Fase 1: Visualizador ✅
- [x] Abrir arquivo, arrastar e soltar, colar (ou Ctrl+V na página)
- [x] Cena 3D com grid, bússola N/S/L/O, cores e formas por bloco
- [x] Slider de camadas ("até a camada" / "só a camada") + teclas `[` `]`
- [x] Vista 2D da camada com coordenadas e camada de baixo como referência
- [x] Materiais: pilhas, shulkers, "já tenho", filtro por camada, destacar item no 3D
- [x] Passo a passo clicável
- [x] **Legenda ao passar o mouse**: nome em português, ID, direção, coordenadas (no 3D e no 2D)
- [x] **Medir distância** entre 2 blocos
- [x] Salvar `.json` corrigido, baixar imagem, lembrar o último blueprint

### Fase 2: Fluxo com a IA, sem custo ✅
- [x] Formulário **Gerar prompt** (ideia, tipo, tamanho, materiais, versão, links, detalhe, fotos)
- [x] Leitura tolerante + correções automáticas
- [x] Avisos + **pedido de correção** pronto para colar
- [x] Detecção de resposta cortada
- [x] Operações `roof` e `repeat`, camadas com `repeat`
- [x] Testes automáticos

### Fase 3: Projeto em etapas ✅
- [x] Modo em etapas: estrutura + planta (`plan`) → detalhes por andar → mobília por andar → área externa
- [x] Prompts por etapa com o estado atual do andar em texto (a IA relê a arquitetura)
- [x] Partes somadas no mesmo espaço; mobília/exterior não sobrescrevem a estrutura; aviso se um detalhe sai do andar
- [x] Painel do projeto: próxima etapa destacada, mostrar/esconder etapa, refazer, correção por etapa, editar andares
- [x] Andares automáticos quando a IA não manda planta; projeto rápido pode virar projeto em etapas
- [x] Salvar/abrir projeto (`.projeto.json`) e exportar blueprint único
- [x] Exemplo: sobrado completo montado em 6 etapas

### Próximos passos possíveis (todos de graça)
- [ ] **Testar com construções reais** de vocês e anotar onde a IA erra, para ajustar o prompt
- [ ] **Exportar `.litematic`**: com o mod Litematica (grátis), a construção aparece como holograma dentro do jogo, no lugar exato
- [ ] Importar `.litematic`/`.schem` baixados da internet, para ver e contar materiais
- [ ] Editor simples: clicar para trocar ou apagar um bloco e salvar
- [ ] Mais formas de telhado (quatro águas, plano com borda)
- [ ] Hospedar o site (GitHub Pages / Netlify, grátis) para os amigos abrirem pelo link
- [ ] Modo "explodido" (separa as camadas no 3D)

---

## Estrutura de pastas

```
FIZZI MINE/
├─ README.md                  como rodar e usar
├─ docs/
│  ├─ PLANO.md                este arquivo
│  ├─ FORMATO.md              especificação do blueprint
│  └─ prompts/                modelos dos prompts: formato (regras comuns), completo,
│                             etapa1-estrutura, etapa2-andar, etapa3-mobilia, exterior
├─ schema/blueprint.schema.json
├─ public/examples/           blueprints de exemplo (+ index.json)
├─ tests/pipeline.test.ts     testes automáticos
├─ index.html
└─ src/
   ├─ main.ts                 liga tudo
   ├─ style.css
   ├─ blueprint/
   │  ├─ types.ts             tipos do formato
   │  ├─ parse.ts             lê a resposta da IA, conserta e valida
   │  ├─ knownBlocks.ts       lista de blocos do jogo, apelidos, sugestões
   │  ├─ compile.ts           camadas + operações (roof, repeat…) → blocos
   │  ├─ materials.ts         contagem de itens, pilhas, shulkers
   │  └─ names.ts             nomes em português e estados traduzidos
   ├─ project/
   │  └─ project.ts           etapas, andares, montagem das partes, salvar/abrir projeto
   ├─ prompt/
   │  ├─ builder.ts           monta o prompt de cada etapa (pedido + estado atual)
   │  └─ correction.ts        mensagem de correção para a IA
   ├─ render/
   │  ├─ blocks.ts            cor, transparência e tipo de forma
   │  ├─ geometry.ts          formas (escada, porta, cerca conectada…)
   │  └─ viewer.ts            cena 3D, legenda, medição, destaque
   └─ ui/
      ├─ layerView.ts         vista 2D da camada
      ├─ panels.ts            painéis
      └─ tooltip.ts           legenda do bloco
```
