# Guia de uso do FIZZI MINE

## Fluxo em 3 botões

| Botão | Para quê |
|---|---|
| **＋ Novo** | começa uma construção do zero (a IA planeja e vai mandando as partes) |
| **📥 Colar resposta** | cola o que a IA respondeu; entra como parte nova, por cima do que já existe |
| **✏️ Alterar com IA** | muda qualquer coisa do projeto aberto: trocar piso, abrir porta, apagar parede, ampliar um cômodo para trás, fazer **subsolo**… A IA manda só as mudanças |

Funciona com qualquer projeto: um que você fez, um exemplo, ou um `.json` baixado (**📂 Abrir**). Na primeira alteração, deixe marcado "conversa nova": o pedido já leva as regras e o desenho atual da construção para a IA. Nas seguintes, na mesma conversa, escolha "nada (a IA já conhece)" para o pedido ficar curto.

As coordenadas são sempre as do projeto: ao ampliar para trás (norte) ou para baixo, a IA usa números negativos (ex.: porão em y = -1 a -5) e o app entende, sem avisos.

## Como usar (detalhes)

1. Clique em **＋ Novo**, descreva a construção (tipo, tamanho, materiais, links) e escolha o modo:
   - **Automático** (recomendado): a própria IA planeja e divide em partes. Você cola cada resposta e manda **"continuar"** (botão **📋 Copiar "continuar"**). Se uma parte vier com aviso, o painel mostra **🛠 Copiar correção**. Para mudar ou ampliar qualquer coisa, use **✏️ Alterar com IA**.
   - **Por andares**: etapas fixas (estrutura → detalhes de cada andar → mobília de cada andar);
   - **Rápido**: tudo num prompt só (bom para coisas pequenas e farms).
2. Clique em **Criar projeto e copiar prompt**, cole numa IA (pode anexar fotos) e envie.
3. Copie a resposta inteira, clique em **📥 Colar resposta** e cole. Também funciona com **Ctrl+V** na página ou arrastando um arquivo.
4. No modo em etapas, o painel **Projeto** (à esquerda) mostra a próxima etapa destacada: **📋 Prompt** → cola na IA → **📥 Colar** a resposta. Repita até o fim.
5. Se aparecerem **Avisos** numa etapa, clique em **🛠** (ou em "Copiar pedido de correção"), cole na mesma conversa e cole a nova resposta na mesma etapa.

### As etapas

| Etapa | O que a IA faz | O que ela recebe |
|---|---|---|
| **1 · Estrutura** | fundação, pisos, paredes, portas, janelas, escadas, telhado + a **planta** (andares e cômodos) | o seu pedido e as fotos |
| **2 · Detalhes** (uma por andar) | paredes internas, acabamentos, lareira, vigas, guarda-corpos | a planta + o andar já construído, em texto |
| **3 · Mobília** (uma por andar) | móveis, iluminação, decoração, só em espaço vazio | a planta (com o uso de cada cômodo) + o andar com os detalhes |
| **4 · Área externa** (opcional) | jardim, caminho, cercas, postes | a parte de baixo da construção |

Cada etapa é uma resposta curta e focada, então cabe muito mais detalhe do que num prompt só. A IA sempre "relê" o que já foi construído, porque o prompt leva o estado atual do andar em texto. Mobília colocada em cima de parede é ignorada e vira aviso. Um projeto rápido pode virar projeto em etapas com **➕ Detalhar em etapas**.

Pequenos erros da IA (nome de bloco escrito errado, vírgula sobrando, formato diferente) são consertados sozinhos e listados em "Corrigido automaticamente".

### Importar e exportar

- **💾 Salvar projeto**: arquivo `.projeto.json` com todas as etapas, para continuar depois (**Abrir**).
- **⇩ Blueprint único**: junta as etapas visíveis num `.json` só, que abre em qualquer lugar que leia o formato.
- **Abrir**: aceita projeto salvo, blueprint único ou a resposta da IA salva num arquivo.
- **👁** em cada etapa esconde ou mostra os blocos dela no 3D (ex.: ver a casa sem móveis). A lista de materiais acompanha.
- O projeto atual fica salvo no navegador.

## Na tela

- **3D:** passe o mouse num bloco para ver o nome em português, o ID do jogo, a direção e as coordenadas. Clique em 2 blocos para **medir a distância**. Arraste para girar, use a roda para zoom e o botão direito para mover.
- **Camadas:** slider embaixo ou teclas `[` e `]`. "Só esta camada" mostra uma de cada vez.
- **Vista 2D (direita):** mapa da camada atual com coordenadas. A camada de baixo aparece apagadinha como referência.
- **Materiais:** total, pilhas de 64 e shulkers. Dá para filtrar (tudo / até esta camada / só esta camada), marcar o que já tem e clicar num item para destacar onde ele vai no 3D.
- **💾 Salvar** tem: projeto, blueprint único e imagem do 3D. Em Materiais, **⇩ Exportar** gera a lista para colar numa IA (texto), .txt ou .json, com a coluna "tenho" mostrando o que falta.

