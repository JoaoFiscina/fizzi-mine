// =====================================================================
// Fizzi Minerador — AGACHADO + picareta: quebra o veio inteiro de uma vez.
// Os drops vêm da tabela de loot do próprio jogo usando a picareta da mão
// (comando /loot ... mine ... mainhand), então Fortuna e Toque Suave
// funcionam como no vanilla. Só API estável.
// =====================================================================

import { world, GameMode } from "@minecraft/server";
import { VIZINHOS, chave, lerBloco, nivelEncantamento, planejarDesgaste } from "./comum.js";

// ---------------------------------------------------------------------
// CONFIGURAÇÃO DO MINERADOR
// ---------------------------------------------------------------------

/** Liga/desliga o minerador inteiro. */
const MINERADOR_ATIVO = true;

/** Máximo de minérios por veio (contando o primeiro). */
const MAX_MINERIOS = 64;

/** Exige estar agachado para minerar o veio. */
const EXIGIR_AGACHADO = true;

/** Prefixo das marcas de "minério colocado por jogador" no mundo. */
const PREFIXO_COLOCADO = "fm_ore:";

// ---------------------------------------------------------------------
// Tabelas
// ---------------------------------------------------------------------

/**
 * Nível mínimo de picareta por minério (0 madeira/ouro, 1 pedra/cobre,
 * 2 ferro, 3 diamante/netherite). Com picareta fraca demais o vanilla
 * não dropa nada, então nem fazemos a cadeia.
 * @type {Record<string, number>}
 */
const NIVEL_MINIMO = {
  "minecraft:coal_ore": 0,
  "minecraft:nether_gold_ore": 0,
  "minecraft:quartz_ore": 0,
  "minecraft:iron_ore": 1,
  "minecraft:copper_ore": 1,
  "minecraft:lapis_ore": 1,
  "minecraft:gold_ore": 2,
  "minecraft:redstone_ore": 2,
  "minecraft:diamond_ore": 2,
  "minecraft:emerald_ore": 2,
  "minecraft:ancient_debris": 3,
};

/**
 * XP que cada minério dá no vanilla Bedrock [mín, máx].
 * Ferro, ouro, cobre e detrito antigo não dão XP.
 * @type {Record<string, [number, number]>}
 */
const XP = {
  "minecraft:coal_ore": [0, 2],
  "minecraft:nether_gold_ore": [0, 1],
  "minecraft:quartz_ore": [2, 5],
  "minecraft:lapis_ore": [2, 5],
  "minecraft:redstone_ore": [1, 5],
  "minecraft:diamond_ore": [3, 7],
  "minecraft:emerald_ore": [3, 7],
};

// ---------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------

/**
 * "Grupo" do minério: junta as versões de pedra e deepslate e a redstone
 * acesa (lit_). Ex.: minecraft:deepslate_iron_ore -> minecraft:iron_ore.
 * Devolve undefined se não for minério.
 * @param {string} typeId
 */
function grupoMinerio(typeId) {
  if (typeId === "minecraft:ancient_debris") return typeId;
  if (!typeId.endsWith("_ore")) return undefined;
  const grupo = typeId.replace("lit_", "").replace("deepslate_", "");
  return grupo in NIVEL_MINIMO ? grupo : undefined;
}

/**
 * Nível da picareta pelo ID (picaretas de outros add-ons contam como 0).
 * @param {string} typeId
 */
function nivelPicareta(typeId) {
  if (typeId.includes("netherite") || typeId.includes("diamond")) return 3;
  if (typeId.includes("iron")) return 2;
  if (typeId.includes("stone") || typeId.includes("copper")) return 1;
  return 0;
}

/**
 * Marca de minério colocado por jogador (para não contar como natural).
 * @param {import("@minecraft/server").Dimension} dim
 * @param {import("@minecraft/server").Vector3} p
 */
function chaveColocado(dim, p) {
  return PREFIXO_COLOCADO + dim.id + ":" + chave(p.x, p.y, p.z);
}

/** @param {number} min @param {number} max */
function sortear(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// ---------------------------------------------------------------------
// "Só minérios naturais": lembra onde o jogador colocou minério.
// Limite: minérios colocados ANTES de instalar o pack, ou movidos por
// pistão, não são reconhecidos como colocados.
// ---------------------------------------------------------------------

world.afterEvents.playerPlaceBlock.subscribe((ev) => {
  if (!MINERADOR_ATIVO) return;
  if (!grupoMinerio(ev.block.typeId)) return;
  try {
    world.setDynamicProperty(chaveColocado(ev.dimension, ev.block.location), true);
  } catch {
    // sem espaço / erro: só não marca
  }
});

/**
 * Busca em largura (26 vizinhos) por minérios do MESMO grupo que não
 * foram colocados por jogador.
 * @param {import("@minecraft/server").Dimension} dim
 * @param {import("@minecraft/server").Vector3} origem
 * @param {string} grupo
 */
function buscarVeio(dim, origem, grupo) {
  const vistos = new Set([chave(origem.x, origem.y, origem.z)]);
  const fila = [origem];
  /** @type {{ x: number, y: number, z: number, id: string }[]} */
  const minerios = []; // minérios EXTRAS (sem o primeiro)

  for (let i = 0; i < fila.length && minerios.length + 1 < MAX_MINERIOS; i++) {
    const atual = fila[i];
    for (const d of VIZINHOS) {
      const x = atual.x + d.x, y = atual.y + d.y, z = atual.z + d.z;
      const k = chave(x, y, z);
      if (vistos.has(k)) continue;
      vistos.add(k);

      const bloco = lerBloco(dim, { x, y, z });
      if (!bloco || grupoMinerio(bloco.typeId) !== grupo) continue;
      if (world.getDynamicProperty(chaveColocado(dim, { x, y, z }))) continue; // colocado

      minerios.push({ x, y, z, id: bloco.typeId });
      fila.push({ x, y, z });
      if (minerios.length + 1 >= MAX_MINERIOS) break;
    }
  }
  return minerios;
}

// ---------------------------------------------------------------------
// Evento principal
// ---------------------------------------------------------------------

world.afterEvents.playerBreakBlock.subscribe((ev) => {
  if (!MINERADOR_ATIVO) return;
  const grupo = grupoMinerio(ev.brokenBlockPermutation.type.id);
  if (!grupo) return;

  const dim = ev.dimension;
  const origem = { x: ev.block.x, y: ev.block.y, z: ev.block.z };

  // Se este minério tinha sido colocado por jogador: apaga a marca e não faz cadeia.
  const marca = chaveColocado(dim, origem);
  if (world.getDynamicProperty(marca)) {
    world.setDynamicProperty(marca, undefined);
    return;
  }

  const jogador = ev.player;
  if (EXIGIR_AGACHADO && !jogador.isSneaking) return;

  const item = ev.itemStackBeforeBreak;
  if (!item || !item.hasTag("minecraft:is_pickaxe")) return;
  if (!ev.itemStackAfterBreak) return; // picareta quebrou no primeiro bloco
  if (nivelPicareta(item.typeId) < NIVEL_MINIMO[grupo]) return; // picareta fraca: vanilla

  const minerios = buscarVeio(dim, origem, grupo);
  if (minerios.length === 0) return;

  const criativo = jogador.getGameMode() === GameMode.Creative;
  const desgaste = planejarDesgaste(jogador, "minecraft:is_pickaxe", minerios.length);
  if (desgaste.total <= 0) return;

  // Os drops caem todos onde o jogador quebrou o primeiro (fácil de pegar).
  const cx = origem.x + 0.5, cy = origem.y + 0.5, cz = origem.z + 0.5;
  const toqueSuave = nivelEncantamento(item, "silk_touch") > 0;
  let xp = 0;

  for (const m of minerios.slice(0, desgaste.total)) {
    try {
      if (criativo) {
        dim.setBlockType(m, "minecraft:air"); // Criativo: sem drops, como no vanilla
        continue;
      }
      // Loot oficial do bloco usando a picareta da mão (aplica Fortuna/Toque Suave).
      // Precisa rodar ANTES de tirar o bloco e ANTES de gastar a picareta.
      let ok = false;
      try {
        const r = jogador.runCommand(`loot spawn ${cx} ${cy} ${cz} mine ${m.x} ${m.y} ${m.z} mainhand`);
        ok = r.successCount > 0;
      } catch {
        ok = false;
      }
      if (ok) {
        dim.setBlockType(m, "minecraft:air");
      } else {
        // Plano B: quebra com drop normal (sem Fortuna).
        dim.runCommand(`setblock ${m.x} ${m.y} ${m.z} air destroy`);
      }
      const faixa = XP[grupoMinerio(m.id) ?? ""];
      if (faixa && !toqueSuave) xp += sortear(faixa[0], faixa[1]);
    } catch {
      // chunk descarregado etc.: pula este bloco
    }
  }

  if (xp > 0) jogador.addExperience(xp);
  try {
    dim.playSound("dig.stone", origem);
  } catch {
    // som é só enfeite
  }
  desgaste.aplicar(); // só agora gasta/remove a picareta
});
