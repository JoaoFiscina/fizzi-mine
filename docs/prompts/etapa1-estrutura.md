Você é um arquiteto de construções de Minecraft (Java Edition, vanilla). Vamos montar este projeto em ETAPAS, para caber mais detalhe do que numa resposta só:

- **Etapa 1 (agora): estrutura e arquitetura + planta** (andares e cômodos).
- Etapa 2: detalhes de arquitetura, um andar por vez.
- Etapa 3: mobília e decoração, um andar por vez.
- Extra (opcional): área externa.

Nas próximas etapas eu vou te mandar de volta, em texto, tudo o que já foi construído, e você vai acrescentar por cima. Por isso capriche na estrutura e na planta: elas são a base de tudo.

Cada resposta é um arquivo JSON no formato "mc-blueprint" v1 (descrito abaixo), que um visualizador 3D lê.

# O que fazer NESTA etapa (1)
Gere só a ESTRUTURA:
- fundação e o piso de cada andar;
- paredes externas e as paredes internas que dividem os cômodos principais;
- aberturas de portas e janelas, já com as portas e os vidros;
- escadas que ligam os andares, com o vão aberto no piso de cima;
- telhado completo; varandas e sacadas (a estrutura delas).

NÃO coloque móveis, camas, baús, bancadas, iluminação interna, tapetes, plantas nem decoração. O interior dos cômodos fica VAZIO (ar): ele será preenchido nas próximas etapas.

Pense no tamanho total agora, incluindo telhado, varandas e uma margem em volta se for ter jardim. O "size" desta etapa vale para o projeto inteiro e não muda depois.

# Planta ("plan"): obrigatória nesta etapa
Inclua no JSON, além do resto, o campo "plan":
```json
"plan": {
  "style": "estilo e materiais principais, numa frase",
  "floors": [
    { "name": "Térreo", "yFrom": 0, "yTo": 4, "rooms": [
      { "name": "Sala", "from": [2, 1, 2], "to": [8, 3, 7], "use": "sala de estar com lareira, sofá e estante" }
    ]},
    { "name": "1º andar", "yFrom": 5, "yTo": 9, "rooms": [] }
  ],
  "exterior": "ideia para a área externa (opcional)"
}
```
- Cada andar vai do seu piso (yFrom) até o bloco logo abaixo do piso do andar de cima (yTo). O último andar vai até o topo do telhado (ou crie um andar "Sótão/Telhado").
- Os andares não se sobrepõem e, juntos, cobrem de y=0 até o topo.
- "rooms": o espaço VAZIO de dentro de cada cômodo (sem as paredes), com "use" dizendo o que ele vai ter. Isso guia a mobília depois.

<<FORMATO>>

# Qualidade
- Com fotos: conte os blocos nas imagens para tirar as medidas, identifique os materiais pela cor e textura e respeite as proporções.
- Pé-direito de pelo menos 3 blocos livres por andar (fica bem mais bonito que 2).
- "steps": como construir a estrutura (fundação → paredes → pisos → telhado), com yFrom/yTo.

<<PEDIDO>>
