// =====================================================================
// Funções compartilhadas entre o Lenhador e o Minerador.
// =====================================================================

import { GameMode, EquipmentSlot } from "@minecraft/server";

/** Som tocado quando a ferramenta quebra no meio da cadeia. */
const SOM_FERRAMENTA_QUEBROU = "random.break";

/** Os 26 vizinhos (inclui diagonais). */
/** @type {import("@minecraft/server").Vector3[]} */
export const VIZINHOS = [];
for (let dx = -1; dx <= 1; dx++) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (dx !== 0 || dy !== 0 || dz !== 0) VIZINHOS.push({ x: dx, y: dy, z: dz });
    }
  }
}

/**
 * Chave de texto para guardar posições em Set.
 * @param {number} x @param {number} y @param {number} z
 */
export function chave(x, y, z) {
  return x + "," + y + "," + z;
}

/**
 * Lê um bloco com segurança. Chunk não carregado ou fora dos limites
 * do mundo lançam erro — nesse caso devolve undefined.
 * @param {import("@minecraft/server").Dimension} dim
 * @param {import("@minecraft/server").Vector3} pos
 */
export function lerBloco(dim, pos) {
  try {
    return dim.getBlock(pos);
  } catch {
    return undefined;
  }
}

/**
 * Nível de um encantamento no item (0 se não tiver).
 * @param {import("@minecraft/server").ItemStack} item
 * @param {string} encantamento ex.: "unbreaking", "silk_touch"
 */
export function nivelEncantamento(item, encantamento) {
  try {
    return item.getComponent("minecraft:enchantable")?.getEnchantment(encantamento)?.level ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Planeja o desgaste da ferramenta na mão principal para `quantidade`
 * blocos extras. Cada bloco gasta +1 com chance 1/(Inquebrável+1).
 * Se a ferramenta acabar, o bloco em que acabou ainda conta e a cadeia
 * para. NÃO altera nada até chamar `aplicar()` — assim dá para usar a
 * ferramenta (ex.: loot com Fortuna) antes de gastá-la.
 * @param {import("@minecraft/server").Player} jogador
 * @param {string} tag tag exigida, ex.: "minecraft:is_axe"
 * @param {number} quantidade
 * @returns {{ total: number, aplicar: () => void }}
 */
export function planejarDesgaste(jogador, tag, quantidade) {
  const nada = { total: 0, aplicar() {} };
  if (jogador.getGameMode() === GameMode.Creative) return { total: quantidade, aplicar() {} };

  const equip = jogador.getComponent("minecraft:equippable");
  if (!equip) return nada;
  const ferramenta = equip.getEquipment(EquipmentSlot.Mainhand);
  if (!ferramenta || !ferramenta.hasTag(tag)) return nada;

  const dur = ferramenta.getComponent("minecraft:durability");
  if (!dur) return { total: quantidade, aplicar() {} }; // sem durabilidade

  const chance = 1 / (nivelEncantamento(ferramenta, "unbreaking") + 1);
  let dano = dur.damage;
  const max = dur.maxDurability;
  let quebrou = false;
  let total = 0;

  for (let i = 0; i < quantidade; i++) {
    total++; // este bloco será quebrado
    if (Math.random() < chance) {
      dano++;
      if (dano >= max) {
        quebrou = true;
        break; // o resto fica no lugar
      }
    }
  }

  return {
    total,
    aplicar() {
      if (quebrou) {
        equip.setEquipment(EquipmentSlot.Mainhand, undefined); // remove a ferramenta
        jogador.dimension.playSound(SOM_FERRAMENTA_QUEBROU, jogador.location);
      } else {
        dur.damage = dano;
        equip.setEquipment(EquipmentSlot.Mainhand, ferramenta); // devolve atualizada
      }
    },
  };
}
