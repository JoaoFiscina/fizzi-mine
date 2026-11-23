# Como responder
- Responda com UM único bloco ```json contendo o arquivo completo desta etapa. Não escreva nada antes nem depois.
- JSON puro: aspas duplas, sem comentários, sem vírgula sobrando no fim de listas.
- Se faltar informação, faça suposições razoáveis e explique cada uma em "notes" (em português).
- Se não conseguir abrir um link (vídeo, por exemplo), use o título, a descrição e o que eu escrevi, e diga isso em "notes".
- Mantenha o arquivo compacto: use "operations" para as partes grandes ou repetidas. Uma resposta longa demais pode ser cortada no meio.

# Sistema de coordenadas
- x cresce para o LESTE, y para CIMA, z para o SUL.
- Origem [0,0,0] = canto NOROESTE da camada mais baixa (normalmente o piso ou a fundação).
- Todas as coordenadas são inteiros entre 0 e size-1. 1 unidade = 1 bloco.
- "size" é a caixa que envolve TUDO, incluindo beiral do telhado e decorações externas.

# Estrutura do arquivo
{
  "format": "mc-blueprint",
  "version": 1,
  "meta": { "name": "...", "description": "...", "category": "casa | farm | decoracao | redstone | outro", "minecraftVersion": "1.21", "sources": ["links usados"] },
  "size": { "x": LARGURA_LESTE_OESTE, "y": ALTURA, "z": PROFUNDIDADE_NORTE_SUL },
  "palette": { "C": "bloco" },
  "layers": [ { "y": 0, "name": "...", "rows": ["...", "..."] } ],
  "operations": [ { "op": "fill", "from": [x,y,z], "to": [x,y,z], "block": "bloco", "note": "..." } ],
  "steps": [ { "title": "...", "description": "...", "yFrom": 0, "yTo": 0 } ],
  "notes": ["..."]
}

# Duas formas de colocar blocos (pode misturar)
Ordem: primeiro TODAS as "layers", depois as "operations" na ordem da lista. Se dois comandos caem no mesmo bloco, vale o último.

## 1. "layers": camadas desenhadas em texto (visão de cima)
- rows[0] é a linha mais ao NORTE (z=0); o 1º caractere de cada linha é x=0 (oeste).
- Cada caractere aponta para um bloco em "palette". "." = ar (não coloca nada).
- Cada camada tem EXATAMENTE size.z linhas, e cada linha EXATAMENTE size.x caracteres.
- "repeat": N repete a mesma camada para cima (y, y+1, ... N camadas). Ótimo para paredes iguais.
- Chaves da paleta: exatamente 1 caractere. Use letras diferentes para estados diferentes (ex.: "D" porta parte de baixo, "d" porta parte de cima).

## 2. "operations"
- set: { "op": "set", "at": [x,y,z], "block": "..." } → 1 bloco
- fill: { "op": "fill", "from": [x,y,z], "to": [x,y,z], "block": "..." } → caixa maciça (piso, parede inteira, pilar)
- hollow: from/to/block → caixa oca: paredes + piso + teto, interior vira ar
- walls: from/to/block → só as 4 paredes laterais (não mexe no interior)
- line: from/to/block → linha reta
- clear: from/to → apaga (vira ar), ótimo para abrir portas e janelas depois de um "walls"
- roof: { "op": "roof", "from": [x,y,z], "to": [x,y,z], "block": "spruce_stairs", "axis": "x", "gable": "spruce_planks" }
  → telhado de duas águas com as escadas já viradas do jeito certo. "axis" é a direção da cumeeira (linha mais alta): "x" = leste-oeste, "z" = norte-sul. A cada nível o telhado sobe 1 e entra 1 de cada lado.
  Como posicionar: use o MESMO y da última camada das paredes. Na direção da cumeeira, from/to acompanha as paredes; na outra direção, vai 1 bloco além das paredes de cada lado (beiral). Assim a 1ª fileira fica encostada por fora no topo da parede e a 2ª já fica em cima da parede, sem buraco.
  "gable" (opcional) fecha os triângulos das pontas (a partir do 2º nível). "ridge" (opcional) é o bloco do topo quando a largura é ímpar (padrão: laje do mesmo material). Altura total do telhado = metade da largura, arredondada para cima: some isso no size.y.
- repeat: { "op": "repeat", "times": 3, "offset": [0,4,0], "operations": [ ... ] } → repete as operações de dentro, deslocando "offset" a cada vez (andares iguais, módulos de farm, colunas).

# Blocos
- IDs exatos do Minecraft Java em inglês, minúsculos, sem "minecraft:". Atenção aos plurais: oak_planks, stone_bricks, bricks, deepslate_tiles; e glass_pane (sem "s").
- Coloque os estados quando importam: oak_stairs[facing=north,half=bottom], oak_slab[type=top], oak_log[axis=x], hopper[facing=south], observer[facing=up], piston[facing=east], chest[facing=south], wall_torch[facing=south], ladder[facing=north], lantern[hanging=true].
- facing de escadas = direção para onde a escada SOBE (o lado alto).
- Porta = 2 blocos: oak_door[half=lower,facing=south] e, em cima, oak_door[half=upper,facing=south].
- Cama = 2 blocos: red_bed[part=foot,facing=north] e, no lado para onde ela aponta, red_bed[part=head,facing=north].
- Só blocos vanilla que existem na versão pedida.

# Antes de responder, confira
1. Cada camada tem size.z linhas e cada linha tem size.x caracteres.
2. Todo caractere usado nas camadas existe na "palette".
3. Nenhuma coordenada é negativa ou passa de size-1 (inclusive o topo do telhado).
4. Todos os IDs de bloco existem no Minecraft Java.
5. Portas e camas têm as duas partes.
