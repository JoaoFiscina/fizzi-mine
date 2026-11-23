# Formato `mc-blueprint` v1

É o "contrato" entre a IA e o visualizador. A IA gera esse JSON, o visualizador lê.
Schema formal: [`schema/blueprint.schema.json`](../schema/blueprint.schema.json).

## Sistema de coordenadas

```
        N (z = 0)
          ↑
 W (x=0) ←┼→ E (x cresce)
          ↓
        S (z cresce)

 y = 0 é a camada mais baixa; y cresce para cima.
```

- Origem `[0,0,0]` = canto **noroeste** da camada mais baixa.
- Tudo é inteiro, de `0` até `size - 1`.
- 1 unidade = 1 bloco.

## Estrutura

```jsonc
{
  "format": "mc-blueprint",
  "version": 1,
  "meta": {
    "name": "Casa de madeira",
    "description": "Casa inicial 9x7 com telhado de spruce",
    "category": "casa",              // casa | farm | decoracao | redstone | outro
    "minecraftVersion": "1.21",
    "sources": ["https://youtube.com/..."]
  },
  "size": { "x": 11, "y": 6, "z": 9 }, // largura (L-O), altura, profundidade (N-S)

  "palette": { "P": "oak_planks", "L": "oak_log", "G": "glass_pane" },
  "layers":     [ /* camadas desenhadas em texto */ ],
  "operations": [ /* formas: fill, hollow, walls, line, set, clear */ ],

  "steps": [ { "title": "Fundação", "description": "...", "yFrom": 0, "yTo": 0 } ],
  "notes": ["Suposições, dicas, avisos"]
}
```

Dá para usar só `layers`, só `operations`, ou as duas juntas.
**Ordem de aplicação:** primeiro todas as `layers`, depois as `operations` na ordem da lista. Se dois comandos caem no mesmo bloco, vale o último.

## `layers`: camadas em texto

Cada camada é um "corte" horizontal visto de cima. `rows[0]` é a linha mais ao norte (`z=0`) e o 1º caractere é `x=0`.

```json
"palette": { "B": "stone_bricks", "D": "sand", "W": "water" },
"layers": [
  { "y": 1, "name": "Canal", "rows": [
    "BBBBBBBBB",
    "BDDDDDDDB",
    "BWWWWWWWB",
    "BDDDDDDDB",
    "BBBBBBBBB"
  ]}
]
```

- `.` e espaço = ar (não coloca nada).
- Cada camada deve ter `size.z` linhas, e cada linha `size.x` caracteres. O visualizador avisa quando não bate.

- `"repeat": N` repete a mesma camada para cima (`y`, `y+1`, … N camadas). Ótimo para paredes iguais.

## `operations`: formas

| op       | campos                 | o que faz |
|----------|------------------------|-----------|
| `set`    | `at`, `block`          | 1 bloco |
| `fill`   | `from`, `to`, `block`  | caixa maciça |
| `hollow` | `from`, `to`, `block`  | casca (paredes, piso, teto) e interior vira ar |
| `walls`  | `from`, `to`, `block`  | só as 4 paredes laterais, não mexe no interior |
| `line`   | `from`, `to`, `block`  | linha reta (também diagonal) |
| `clear`  | `from`, `to`           | apaga tudo (ar) |
| `roof`   | `from`, `to`, `block` (escada), `axis`?, `gable`?, `ridge`? | telhado de duas águas com as escadas já viradas certo |
| `repeat` | `times`, `offset`, `operations` | repete as operações de dentro, deslocando `offset` a cada vez |

`from`/`to` são cantos opostos, em qualquer ordem. Todo campo `note` é opcional, para explicar a operação.

### `roof`

```json
{ "op": "roof", "from": [1, 3, 0], "to": [9, 3, 8], "block": "spruce_stairs", "axis": "x", "gable": "spruce_planks" }
```

- `axis`: direção da cumeeira (linha mais alta). `"x"` = leste-oeste, `"z"` = norte-sul. Se faltar, usa o lado mais comprido.
- Cada nível sobe 1 e entra 1 de cada lado. As escadas ficam viradas para a cumeeira (`facing` = para onde sobe).
- Use o **mesmo y do topo das paredes**. Na direção da cumeeira, `from`/`to` acompanha as paredes; na outra, vai 1 bloco além (beiral). A 1ª fileira fica encostada por fora no topo da parede e a 2ª já fica em cima dela.
- `gable`: fecha os triângulos das pontas, a partir do 2º nível.
- `ridge`: bloco do topo quando a largura é ímpar (padrão: a laje do mesmo material).
- Altura do telhado = metade da largura, arredondada para cima.

### `repeat`

```json
{ "op": "repeat", "times": 3, "offset": [0, 4, 0], "operations": [
  { "op": "fill", "from": [0, 0, 0], "to": [6, 0, 6], "block": "spruce_planks" }
]}
```
Faz 3 pisos, em y = 0, 4 e 8. Serve para andares iguais, módulos de farm, colunas.

## `plan`: planta (etapa 1 do modo em etapas)

```json
"plan": {
  "style": "térreo de pedra, andar de cima de carvalho",
  "floors": [
    { "name": "Térreo", "yFrom": 0, "yTo": 4, "rooms": [
      { "name": "Sala", "from": [7, 1, 2], "to": [10, 4, 8], "use": "sala com lareira e sofá" }
    ]},
    { "name": "1º andar", "yFrom": 5, "yTo": 14 }
  ],
  "exterior": "gramado e caminho até a porta"
}
```
- Cada andar vai do seu piso até logo abaixo do piso do andar de cima. Juntos, cobrem de y=0 até o topo.
- `rooms` é o espaço interno de cada cômodo, e `use` diz o que ele vai ter. Isso guia as etapas 2 e 3.

## Projeto em etapas (`mc-blueprint-project`)

Um projeto guarda várias respostas da IA (partes) que se somam **no mesmo espaço, com as mesmas coordenadas**:

```jsonc
{
  "format": "mc-blueprint-project",
  "version": 1,
  "name": "Sobrado",
  "mode": "etapas",                       // ou "rapido" (uma parte "completo")
  "floors": [ /* opcional: andares (se faltar, vêm do plan da estrutura) */ ],
  "parts": [
    { "stage": "estrutura", "blueprint": { /* mc-blueprint com plan */ } },
    { "stage": "andar", "floor": 0, "blueprint": { /* só blocos novos/trocados do andar 0 */ } },
    { "stage": "decoracao", "floor": 0, "blueprint": { /* só mobília, em espaço vazio */ } },
    { "stage": "exterior", "blueprint": { /* área externa */ } }
  ]
}
```

Ordem de montagem: estrutura → detalhes de cada andar → mobília de cada andar → exterior (a última vence).
Regras:
- `andar` e `decoracao` têm a faixa de y do andar; blocos fora dela geram aviso.
- `decoracao` e `exterior` **não substituem** blocos que já existem: são ignorados, com aviso.
- Cada parte pode ser escondida (`"visible": false`).

## O que o visualizador conserta sozinho

A ideia é que **a resposta da IA abra mesmo com pequenos erros**:

- texto antes ou depois, bloco ```json, comentários `//`, vírgula sobrando, aspas “curvas”;
- `size` como `[x, y, z]`, `"5x9x5"` ou `{ width, height, depth }`; sem `size`, calcula pelos blocos;
- coordenadas como texto (`"1,2,3"`) ou `{x, y, z}`, números com casas decimais;
- nomes de operação alternativos (`box`, `cube` → `fill`; `place` → `set`; `wall` → `walls`…) e de campo (`start`/`end`, `pos`, `material`…);
- IDs de bloco: maiúsculas, espaços, `minecraft:`, nomes antigos (`planks`, `stone_brick`, `grass`…) e erros de digitação pequenos (`spruce_plank` → `spruce_planks`);
- camadas escritas como um texto só com quebras de linha, `"y": "1-3"`, linhas `"P P P"`;
- coordenadas negativas (desloca tudo) e blocos fora do `size` (aumenta o tamanho).

O que é consertado aparece em **"Corrigido automaticamente"**. O que pode estar errado de verdade (bloco que não existe, linha com tamanho errado, caractere fora da paleta…) aparece em **Avisos**. Ali tem o botão **"Copiar pedido de correção para a IA"**, que gera uma mensagem pronta para colar na mesma conversa.

## Blocos

- IDs do Minecraft Java em inglês: `oak_planks`, `cobblestone`, `glass_pane`. O prefixo `minecraft:` é opcional.
- Estados entre colchetes: `oak_stairs[facing=north,half=bottom]`, `oak_slab[type=top]`.
- Blocos de 2 partes são escritos como 2 blocos, mas contam como 1 item:
  - porta: `oak_door[half=lower]` + `oak_door[half=upper]`
  - cama: `red_bed[part=foot]` + `red_bed[part=head]`
- `air` apaga.

## Como o visualizador conta materiais

- Laje dupla (`type=double`) = 2 lajes.
- Porta, cama e plantas altas = 1 item.
- `water`/`lava` = 1 balde por bloco de fonte. Na prática dá para usar menos (fonte infinita).
- Tocha/placa de parede vira o item normal (`wall_torch` → `torch`).
- Pilhas de 64, 16 (placas, banners) ou 1 (camas, baldes), e total de shulker boxes.
