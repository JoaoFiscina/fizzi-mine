# ⛏ FIZZI MINE

Ferramenta para planejar construções de Minecraft com ajuda de IA. Você descreve a construção (pode mandar fotos), a IA gera o projeto e o FIZZI MINE mostra:

- o **modelo 3D**, camada por camada, com o nome de cada bloco ao passar o mouse;
- a **lista de materiais**: quantos de cada bloco, em stacks e shulkers, e o que ainda falta;
- o **passo a passo** e as **medidas**.

Depois, dá para ir **alterando e ampliando** com a IA: trocar piso, abrir porta, aumentar um cômodo, fazer subsolo…

## Usar (sem instalar nada)

👉 **https://joaofiscina.github.io/fizzi-mine/**

1. **＋ Novo**: descreva a construção e copie o prompt.
2. Cole no Claude, ChatGPT ou Gemini (pode anexar fotos) e envie.
3. Copie a resposta da IA e clique em **📥 Colar resposta**. Repita com "continuar" até terminar.
4. Para mudar qualquer coisa: **✏️ Alterar com IA**.
5. Em **Materiais**, **⇩ Exportar** copia a lista de blocos para mandar a uma IA, ou baixa em .txt/.json.

Os projetos ficam salvos no seu navegador. Para mandar um projeto para alguém, use **💾 Salvar → Projeto** e a pessoa abre com **📂 Abrir**.

Guia completo: [docs/GUIA.md](docs/GUIA.md)

## Chave de API?

**Não precisa.** O FIZZI MINE não chama nenhuma IA sozinho: você usa a IA que já tem no navegador (copiar e colar). Nada é pago e nenhuma chave é guardada.

## Atualizações

O site atualiza sozinho: quem usa o link só precisa **recarregar a página** (Ctrl+F5 se não aparecer).

Para quem mantém o projeto: todo `git push` na branch `main` publica a versão nova em ~1 minuto (GitHub Actions → GitHub Pages).

## Rodar no próprio computador (opcional)

Precisa do [Node.js](https://nodejs.org) 18 ou mais novo. Na pasta do projeto:

```powershell
npm start
```

Instala o que faltar e abre o app no navegador (http://localhost:5173).

| Comando | O que faz |
|---|---|
| `npm start` | instala as dependências (se precisar) e abre o app |
| `npm test` | roda os testes |
| `npm run build` | gera o site em `dist/` |

Detalhes técnicos: [formato do arquivo](docs/FORMATO.md) · [prompts da IA](docs/prompts/) · [plano](docs/PLANO.md)
