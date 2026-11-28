// =====================================================================
// Fizzi Lenhador — quebre um tronco com machado e a árvore inteira cai.
// Usa somente a Script API ESTÁVEL (@minecraft/server 2.0.0).
// Sem experimentos, sem APIs beta: funciona em Realms.
// O Minerador (veios de minério, agachado + picareta) fica em minerador.js.
// =====================================================================

import { world, system } from "@minecraft/server";
import { VIZINHOS, chave, lerBloco, planejarDesgaste } from "./comum.js";
import "./minerador.js";

// ---------------------------------------------------------------------
// CONFIGURAÇÃO DO LENHADOR (pode mudar estes valores à vontade)
// ---------------------------------------------------------------------

/** Máximo de troncos derrubados por árvore (contando o primeiro). */
const MAX_TRONCOS = 200;

/** Mínimo de folhas NATURAIS encostadas nos troncos para ser árvore. */
const MIN_FOLHAS_NATURAIS = 3;

/** Quantos troncos quebrar por tick (espalha o trabalho e evita lag). */
const TRONCOS_POR_TICK = 16;

/**
 * Toggle opcional (DESATIVADO): se true, agachar enquanto quebra
 * desliga o lenhador e só um bloco quebra (vanilla). Útil para não
 * derrubar construções do mesmo tronco encostadas em árvores.
 */
const AGACHAR_DESATIVA = false;

// ---------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------

/**
 * Tronco natural: ID termina em "_log" e NÃO é "stripped_*".
 * @param {string} typeId
 */
function ehTronco(typeId) {
  return typeId.endsWith("_log") && !typeId.includes("stripped_");
}

/**
 * Folha natural = "leaves" no ID e persistent_bit == false.
 * Folhas colocadas pelo jogador têm persistent_bit == true e NÃO contam.
 * @param {import("@minecraft/server").Block} bloco
 */
function ehFolhaNatural(bloco) {
  if (!bloco.typeId.includes("leaves")) return false;
  try {
    return bloco.permutation.getState("persistent_bit") === false;
  } catch {
    return false;
  }
}

/**
 * Busca em largura (BFS) a partir da posição quebrada, só por troncos
 * do MESMO ID. Ao mesmo tempo conta as folhas naturais encostadas.
 * Cada posição é lida no máximo uma vez.
 * @param {import("@minecraft/server").Dimension} dim
 * @param {import("@minecraft/server").Vector3} origem
 * @param {string} idTronco
 */
function buscarArvore(dim, origem, idTronco) {
  const vistos = new Set([chave(origem.x, origem.y, origem.z)]);
  const fila = [origem];
  /** @type {import("@minecraft/server").Vector3[]} */
  const troncos = []; // troncos EXTRAS (sem o primeiro, que o jogador já quebrou)
  let folhas = 0;

  for (let i = 0; i < fila.length; i++) {
    const atual = fila[i];
    for (const d of VIZINHOS) {
      const x = atual.x + d.x, y = atual.y + d.y, z = atual.z + d.z;
      const k = chave(x, y, z);
      if (vistos.has(k)) continue;
      vistos.add(k);

      const bloco = lerBloco(dim, { x, y, z });
      if (!bloco) continue;

      if (bloco.typeId === idTronco) {
        // +1 porque o primeiro tronco também conta no limite
        if (troncos.length + 1 < MAX_TRONCOS) {
          troncos.push({ x, y, z });
          fila.push({ x, y, z });
        }
      } else if (ehFolhaNatural(bloco)) {
        folhas++;
      }
    }
  }
  return { troncos, folhas };
}

// ---------------------------------------------------------------------
// Quebra em cadeia
// ---------------------------------------------------------------------

/**
 * Quebra os troncos com drop normal e partículas, alguns por tick.
 * "setblock ... destroy" não é quebra de jogador, então NÃO dispara
 * playerBreakBlock de novo (sem recursão).
 * @param {import("@minecraft/server").Dimension} dim
 * @param {import("@minecraft/server").Vector3[]} lista
 * @param {string} idTronco
 */
function* quebrarTroncos(dim, lista, idTronco) {
  let nesteTick = 0;
  for (const p of lista) {
    try {
      // Confere de novo: o bloco pode ter mudado desde a busca
      const bloco = lerBloco(dim, p);
      if (bloco && bloco.typeId === idTronco) {
        dim.runCommand(`setblock ${p.x} ${p.y} ${p.z} air destroy`);
      }
    } catch {
      // ignora (chunk descarregado etc.)
    }
    if (++nesteTick >= TRONCOS_POR_TICK) {
      nesteTick = 0;
      yield;
    }
  }
}

// ---------------------------------------------------------------------
// Evento principal
// ---------------------------------------------------------------------

world.afterEvents.playerBreakBlock.subscribe((ev) => {
  const idTronco = ev.brokenBlockPermutation.type.id;
  if (!ehTronco(idTronco)) return;

  const item = ev.itemStackBeforeBreak;
  if (!item || !item.hasTag("minecraft:is_axe")) return; // mão ou outra ferramenta: vanilla

  // Se o machado quebrou no próprio primeiro tronco, não há cadeia.
  if (!ev.itemStackAfterBreak) return;

  const jogador = ev.player;
  if (AGACHAR_DESATIVA && jogador.isSneaking) return;

  const dim = ev.dimension;
  const origem = { x: ev.block.x, y: ev.block.y, z: ev.block.z };

  const { troncos, folhas } = buscarArvore(dim, origem, idTronco);
  if (troncos.length === 0) return;

  // Regra de segurança: sem folhas naturais suficientes, NÃO é árvore
  // (casa de madeira, construção) -> só o bloco quebrado sai.
  if (folhas < MIN_FOLHAS_NATURAIS) return;

  const desgaste = planejarDesgaste(jogador, "minecraft:is_axe", troncos.length);
  if (desgaste.total <= 0) return;
  desgaste.aplicar();

  system.runJob(quebrarTroncos(dim, troncos.slice(0, desgaste.total), idTronco));
});
