/**
 * Mystery Box (gacha) — regras compartilhadas entre o servidor (sorteio) e a tela ("?", revelação).
 * Abrir uma caixa sorteia primeiro a raridade e depois um item dela. O sorteio acontece só no servidor.
 */
import { AVATAR_PRICE, avatarItemId, characterIdOfAvatar, COSMETICS, cosmeticById, type Cosmetic } from './cosmetics';

export const BOX_PRICE = 100;

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface RarityInfo {
  id: Rarity;
  label: string;
  /** Chance da raridade (as quatro somam 1). */
  chance: number;
  /** Moedas devolvidas se o item sorteado já é seu (lendário: valor fixo; os outros: metade do preço). */
  duplicateRefund: (price: number) => number;
}

export const RARITIES: RarityInfo[] = [
  { id: 'common', label: 'Comum', chance: 0.6, duplicateRefund: (p) => Math.floor(p / 2) },
  { id: 'rare', label: 'Raro', chance: 0.28, duplicateRefund: (p) => Math.floor(p / 2) },
  { id: 'epic', label: 'Épico', chance: 0.1, duplicateRefund: (p) => Math.floor(p / 2) },
  { id: 'legendary', label: 'Lendário', chance: 0.02, duplicateRefund: () => 300 },
];

export const RARITIES_BY_ID = new Map(RARITIES.map((r) => [r.id, r]));

/** Raridade de um item da loja pelo preço; exclusivos são sempre lendários. */
export function rarityOf(c: Cosmetic): Rarity {
  if (c.exclusive) return 'legendary';
  if (c.price < 150) return 'common';
  if (c.price < 350) return 'rare';
  return 'epic';
}

/** Recompensas de conquista nunca saem na caixa. */
const BOX_ITEMS = COSMETICS.filter((c) => !c.achievement);

/** Itens (cosméticos) de cada raridade. */
export const GACHA_POOLS: Record<Rarity, Cosmetic[]> = {
  common: BOX_ITEMS.filter((c) => rarityOf(c) === 'common'),
  rare: BOX_ITEMS.filter((c) => rarityOf(c) === 'rare'),
  epic: BOX_ITEMS.filter((c) => rarityOf(c) === 'epic'),
  legendary: BOX_ITEMS.filter((c) => rarityOf(c) === 'legendary'),
};

/** Na raridade comum, metade das vezes sai um avatar (personagem aleatório) em vez de um cosmético. */
export const COMMON_AVATAR_CHANCE = 0.5;

export interface GachaDraw {
  rarity: Rarity;
  itemId: string;
}

/**
 * Sorteia uma caixa. `random` devolve [0, 1) (no servidor, do crypto.getRandomValues); `avatarIds` são os
 * personagens que podem virar avatar (com imagem).
 */
export function drawBox(random: () => number, avatarIds: string[]): GachaDraw {
  let roll = random();
  let rarity: Rarity = 'common';
  for (const r of RARITIES) {
    if (roll < r.chance) {
      rarity = r.id;
      break;
    }
    roll -= r.chance;
  }
  const pick = <T>(list: T[]) => list[Math.min(list.length - 1, Math.floor(random() * list.length))];
  if (rarity === 'common' && avatarIds.length && random() < COMMON_AVATAR_CHANCE) {
    return { rarity, itemId: avatarItemId(pick(avatarIds)) };
  }
  return { rarity, itemId: pick(GACHA_POOLS[rarity]).id };
}

/** Preço de referência de um item sorteado (avatar ou cosmético), para calcular a devolução de repetido. */
export function itemValue(itemId: string): number {
  if (characterIdOfAvatar(itemId) !== null) return AVATAR_PRICE;
  return cosmeticById(itemId)?.price ?? 0;
}

/** Moedas devolvidas quando o item sorteado já é seu. */
export const duplicateRefund = (draw: GachaDraw) => RARITIES_BY_ID.get(draw.rarity)!.duplicateRefund(itemValue(draw.itemId));
