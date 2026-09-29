/**
 * Catálogo de cosméticos do perfil. Compartilhado entre o front (loja, visual) e o servidor (preço, validação).
 * O visual de cada item é uma classe CSS (`cosmetic-<id>` em styles.css).
 */

export type CosmeticSlot = 'avatar' | 'nameColor' | 'frame';

export interface Cosmetic {
  id: string;
  slot: Exclude<CosmeticSlot, 'avatar'>;
  label: string;
  price: number;
}

/** Qualquer personagem da base pode virar avatar. Preço único: preço por força revelaria o poder. */
export const AVATAR_PRICE = 50;
const AVATAR_PREFIX = 'avatar:';

export const avatarItemId = (characterId: string) => `${AVATAR_PREFIX}${characterId}`;
export const characterIdOfAvatar = (itemId: string) =>
  itemId.startsWith(AVATAR_PREFIX) ? itemId.slice(AVATAR_PREFIX.length) : null;

export const COSMETICS: Cosmetic[] = [
  { id: 'name-cyan', slot: 'nameColor', label: 'Ciano neon', price: 60 },
  { id: 'name-pink', slot: 'nameColor', label: 'Rosa aura', price: 60 },
  { id: 'name-green', slot: 'nameColor', label: 'Verde energia', price: 60 },
  { id: 'name-gold', slot: 'nameColor', label: 'Dourado', price: 150 },
  { id: 'name-fire', slot: 'nameColor', label: 'Fogo', price: 250 },
  { id: 'name-rainbow', slot: 'nameColor', label: 'Prisma', price: 400 },

  { id: 'frame-steel', slot: 'frame', label: 'Aço', price: 40 },
  { id: 'frame-neon', slot: 'frame', label: 'Neon', price: 120 },
  { id: 'frame-aura', slot: 'frame', label: 'Aura pulsante', price: 200 },
  { id: 'frame-flame', slot: 'frame', label: 'Chama dourada', price: 350 },
  { id: 'frame-legend', slot: 'frame', label: 'Lendária', price: 600 },
];

const COSMETICS_BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));

export function cosmeticById(id: string): Cosmetic | undefined {
  return COSMETICS_BY_ID.get(id);
}

/** Visual equipado de um jogador (o que aparece no ranking, na party e no pódio). */
export interface Look {
  /** Id do personagem usado como avatar. */
  avatar: string | null;
  nameColor: string | null;
  frame: string | null;
}

export const EMPTY_LOOK: Look = { avatar: null, nameColor: null, frame: null };

/** Perfil do próprio jogador: saldo, itens comprados e o que está equipado. */
export interface Profile {
  coins: number;
  owned: string[];
  look: Look;
  /** O nick tem senha (dá para entrar com ela em outro dispositivo). */
  hasPassword: boolean;
}
