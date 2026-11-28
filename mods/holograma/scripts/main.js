// Fizzi Holograma — bloco que projeta os projetos do FIZZI MINE no mundo (Bedrock, só API estável; funciona no Realm).
//
// Coloque o bloco "Holograma" e clique nele (mão vazia ou qualquer item; agachado coloca blocos normalmente):
// abre o menu para escolher o projeto, ligar/desligar, mover, girar e ver camada por camada.
//
// A construção aparece com as texturas do jogo, translúcida, num modelo 3D preso a uma entidade invisível
// ("fizzi:projecao"). Cada bloco Holograma tem a sua projeção; quebrar o bloco apaga a projeção.

import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { PROJETOS } from "./projetos.js";

// ---------------------------------------------------------------------
// CONFIGURAÇÃO
// ---------------------------------------------------------------------

const BLOCO = "fizzi:holograma";
const ENTIDADE = "fizzi:projecao";
/** Espaço entre o bloco Holograma e a construção, quando ela aparece pela primeira vez. */
const DISTANCIA_INICIAL = 1;

/**
 * @typedef {{ nome: string, tam: number[], camadas: number[], blocos: number }} ProjetoInfo
 * @typedef {{ x: number, y: number, z: number }} V3
 * @typedef {import("@minecraft/server").Entity} Entity
 * @typedef {import("@minecraft/server").Player} Player
 * @typedef {import("@minecraft/server").Dimension} Dimension
 */

const lista = /** @type {ProjetoInfo[]} */ (PROJETOS);

// ---------------------------------------------------------------------
// PROJEÇÃO (entidade ligada a um bloco)
// ---------------------------------------------------------------------

/** Etiqueta que liga a projeção ao bloco. */
const etiqueta = (/** @type {V3} */ b) => `fizzi_b_${b.x}_${b.y}_${b.z}`;

/** @param {Dimension} dim @param {V3} bloco @returns {Entity | undefined} */
function projecaoDe(dim, bloco) {
  try {
    return dim.getEntities({ type: ENTIDADE, tags: [etiqueta(bloco)] })[0];
  } catch {
    return undefined;
  }
}

/** @param {Entity} e @param {string} nome @param {number} padrao */
function num(e, nome, padrao) {
  const v = e.getProperty(nome);
  return typeof v === "number" ? v : padrao;
}

/** Centro desejado (em blocos) guardado na entidade. @param {Entity} e @returns {V3} */
function centro(e) {
  try {
    const s = e.getDynamicProperty("fizzi:centro");
    if (typeof s === "string") return JSON.parse(s);
  } catch {
    /* sem centro salvo */
  }
  return { x: e.location.x, y: e.location.y, z: e.location.z };
}

/**
 * Leva a entidade para o centro, encaixando na grade: com o giro, a largura e o fundo trocam de lugar,
 * e o meio precisa cair em meio bloco ou bloco inteiro conforme o tamanho.
 * @param {Entity} e @param {V3} c
 */
function posicionar(e, c) {
  e.setDynamicProperty("fizzi:centro", JSON.stringify(c));
  const p = lista[num(e, "fizzi:projeto", 0)];
  if (!p) return;
  const giro = num(e, "fizzi:giro", 0);
  const largura = giro % 2 ? p.tam[2] : p.tam[0];
  const fundo = giro % 2 ? p.tam[0] : p.tam[2];
  const encaixar = (/** @type {number} */ v, /** @type {number} */ ext) => Math.round(v - ext / 2) + ext / 2;
  e.teleport({ x: encaixar(c.x, largura), y: Math.round(c.y), z: encaixar(c.z, fundo) }, { rotation: { x: 0, y: 0 } });
}

/** Direção (no chão) para onde o jogador olha. */
function frente(/** @type {Player} */ p) {
  const v = p.getViewDirection();
  if (Math.abs(v.x) > Math.abs(v.z)) return v.x > 0 ? [1, 0] : [-1, 0];
  return v.z > 0 ? [0, 1] : [0, -1];
}

/** Centro inicial: encostado no bloco, do lado para onde o jogador está olhando. */
function centroInicial(/** @type {Player} */ jogador, /** @type {V3} */ bloco, /** @type {ProjetoInfo} */ p) {
  const [fx, fz] = frente(jogador);
  const meio = (fx !== 0 ? p.tam[0] : p.tam[2]) / 2;
  const d = meio + 0.5 + DISTANCIA_INICIAL;
  return { x: bloco.x + 0.5 + fx * d, y: bloco.y, z: bloco.z + 0.5 + fz * d };
}

/** @param {Player} jogador @param {Dimension} dim @param {V3} bloco @param {number} indice */
function projetar(jogador, dim, bloco, indice) {
  const p = lista[indice];
  let e = projecaoDe(dim, bloco);
  const c = e ? centro(e) : centroInicial(jogador, bloco, p);
  if (!e) {
    e = dim.spawnEntity(ENTIDADE, { x: c.x, y: c.y, z: c.z });
    e.addTag(etiqueta(bloco));
    e.addTag("fizzi_projecao");
  }
  e.setProperty("fizzi:projeto", indice);
  e.setProperty("fizzi:camada", -1);
  e.setProperty("fizzi:ligado", true);
  posicionar(e, c);
  jogador.sendMessage(`§b🔮 ${p.nome}§r projetado. Clique no bloco Holograma para mover, girar ou ver por camada.`);
}

// ---------------------------------------------------------------------
// EVENTOS
// ---------------------------------------------------------------------

// clicar no bloco abre o menu (agachado: comportamento normal, para poder colocar blocos encostados)
world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
  if (ev.block.typeId !== BLOCO || ev.player.isSneaking) return;
  ev.cancel = true;
  if (!ev.isFirstEvent) return;
  const jogador = ev.player;
  const dim = ev.block.dimension;
  const bloco = { x: ev.block.location.x, y: ev.block.location.y, z: ev.block.location.z };
  system.run(() => menu(jogador, dim, bloco));
});

// quebrar o bloco apaga a projeção dele
world.afterEvents.playerBreakBlock.subscribe((ev) => {
  if (ev.brokenBlockPermutation.type.id !== BLOCO) return;
  projecaoDe(ev.dimension, ev.block.location)?.remove();
});

// ---------------------------------------------------------------------
// MENUS
// ---------------------------------------------------------------------

/** @param {Player} jogador @param {Dimension} dim @param {V3} bloco */
async function menu(jogador, dim, bloco) {
  const e = projecaoDe(dim, bloco);
  const p = e ? lista[num(e, "fizzi:projeto", 0)] : undefined;
  const ligado = e ? e.getProperty("fizzi:ligado") !== false : false;
  const camada = e ? num(e, "fizzi:camada", -1) : -1;
  const corpo = [
    `Projeto: §b${p ? p.nome : "nenhum"}§r`,
    e ? `Estado: ${ligado ? "§aligado§r" : "§7desligado§r"}` : "Escolha um projeto para projetar.",
    e && p ? `Camada: ${camada < 0 ? "todas" : `y=${p.camadas[camada]} (${camada + 1} de ${p.camadas.length})`}` : "",
    e ? `Giro: ${num(e, "fizzi:giro", 0) * 90}°` : "",
  ].filter(Boolean).join("\n");

  const f = new ActionFormData().title("🔮 Holograma").body(corpo);
  /** @type {(() => unknown)[]} */
  const acoes = [];
  const botao = (/** @type {string} */ txt, /** @type {() => unknown} */ fn) => {
    f.button(txt);
    acoes.push(fn);
  };
  botao("📁 Escolher projeto", () => escolher(jogador, dim, bloco));
  if (e && p) {
    botao(ligado ? "⏹ Desligar" : "▶ Ligar", () => e.setProperty("fizzi:ligado", !ligado));
    botao("↔ Mover", () => mover(jogador, e));
    botao("🔄 Girar 90°", () => {
      e.setProperty("fizzi:giro", (num(e, "fizzi:giro", 0) + 1) % 4);
      posicionar(e, centro(e));
    });
    botao("🧱 Camadas", () => camadas(jogador, e));
    botao("📍 Trazer para perto do bloco", () => posicionar(e, centroInicial(jogador, bloco, p)));
    botao("🗑 Apagar projeção", () => e.remove());
  }
  const r = await f.show(jogador);
  if (r.canceled || r.selection === undefined) return;
  await acoes[r.selection]();
}

/** @param {Player} jogador @param {Dimension} dim @param {V3} bloco */
async function escolher(jogador, dim, bloco) {
  if (!lista.length) {
    jogador.sendMessage("§eNenhum projeto no pacote. No site FIZZI MINE: 🧩 Mods → Holograma → adicione projetos e baixe de novo.");
    return;
  }
  const f = new ActionFormData().title("📁 Projetos").body("Escolha o que projetar:");
  for (const p of lista) f.button(`${p.nome}\n§8${p.tam.join("×")} · ${p.blocos} blocos`);
  const r = await f.show(jogador);
  if (r.canceled || r.selection === undefined) return;
  projetar(jogador, dim, bloco, r.selection);
}

/** Passo do "mover" (por jogador). @param {Player} j */
const passoDe = (j) => (j.getDynamicProperty("fizzi:passo") === 5 ? 5 : 1);

/** @param {Player} jogador @param {Entity} e */
async function mover(jogador, e) {
  if (!e.isValid) return;
  const n = passoDe(jogador);
  const f = new ActionFormData()
    .title("↔ Mover")
    .body(`Direções em relação a para onde você está olhando. Passo: ${n} bloco(s).`)
    .button("⬆ Para frente")
    .button("⬇ Para trás")
    .button("⬅ Para a esquerda")
    .button("➡ Para a direita")
    .button("🔼 Subir")
    .button("🔽 Descer")
    .button(`Passo: ${n} → ${n === 1 ? 5 : 1}`)
    .button("✔ Pronto");
  const r = await f.show(jogador);
  if (r.canceled || r.selection === undefined || r.selection === 7) return;
  if (r.selection === 6) jogador.setDynamicProperty("fizzi:passo", n === 1 ? 5 : 1);
  else {
    const [fx, fz] = frente(jogador);
    /** @type {number[][]} */
    const dirs = [[fx, 0, fz], [-fx, 0, -fz], [fz, 0, -fx], [-fz, 0, fx], [0, 1, 0], [0, -1, 0]];
    const [dx, dy, dz] = dirs[r.selection];
    const c = centro(e);
    posicionar(e, { x: c.x + dx * n, y: c.y + dy * n, z: c.z + dz * n });
  }
  return mover(jogador, e); // reabre para continuar ajustando
}

/** @param {Player} jogador @param {Entity} e */
async function camadas(jogador, e) {
  if (!e.isValid) return;
  const p = lista[num(e, "fizzi:projeto", 0)];
  if (!p) return;
  const total = p.camadas.length;
  const atual = num(e, "fizzi:camada", -1);
  const f = new ActionFormData()
    .title("🧱 Camadas")
    .body(`Mostrando: ${atual < 0 ? "todas" : `y=${p.camadas[atual]} (${atual + 1} de ${total})`}`)
    .button("🔼 Camada de cima")
    .button("🔽 Camada de baixo")
    .button("🧍 Camada onde estou")
    .button("🏠 Todas as camadas")
    .button("✔ Pronto");
  const r = await f.show(jogador);
  if (r.canceled || r.selection === undefined || r.selection === 4) return;
  let nova = atual;
  if (r.selection === 0) nova = Math.min(total - 1, atual + 1);
  else if (r.selection === 1) nova = atual < 0 ? total - 1 : Math.max(0, atual - 1);
  else if (r.selection === 2) {
    const y = Math.floor(jogador.location.y) - Math.round(centro(e).y);
    nova = p.camadas.reduce((best, v, i) => (Math.abs(v - y) < Math.abs(p.camadas[best] - y) ? i : best), 0);
  } else nova = -1;
  e.setProperty("fizzi:camada", nova);
  return camadas(jogador, e);
}
