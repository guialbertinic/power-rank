/**
 * Catálogo de cosméticos do perfil. Compartilhado entre o front (loja, visual) e o servidor (preço, validação).
 * O visual de cada item é uma classe CSS (`cosmetic-<id>` em styles.css).
 */

export type CosmeticSlot = 'avatar' | 'nameColor' | 'frame' | 'title';

export interface Cosmetic {
  id: string;
  slot: Exclude<CosmeticSlot, 'avatar'>;
  /** Nome do item na loja; nos títulos, é o próprio texto que aparece embaixo do nick. */
  label: string;
  price: number;
  /** Categoria do título na loja (Iniciante, Otaku...). */
  group?: string;
  /** Só sai na Mystery Box (lendário): não está à venda; na loja só aparece para quem já tem. */
  exclusive?: boolean;
}

const title = (id: string, label: string, price: number, group: string): Cosmetic => ({
  id: `title-${id}`,
  slot: 'title',
  label,
  price,
  group,
});

/** Qualquer personagem da base pode virar avatar. Preço único: preço por força revelaria o poder. */
export const AVATAR_PRICE = 50;
const AVATAR_PREFIX = 'avatar:';

export const avatarItemId = (characterId: string) => `${AVATAR_PREFIX}${characterId}`;
export const characterIdOfAvatar = (itemId: string) =>
  itemId.startsWith(AVATAR_PREFIX) ? itemId.slice(AVATAR_PREFIX.length) : null;

export const COSMETICS: Cosmetic[] = [
  { id: 'name-cyan', slot: 'nameColor', label: 'Ciano neon', price: 60 },
  { id: 'name-pink', slot: 'nameColor', label: 'Rosa aura', price: 60 },
  { id: 'name-green', slot: 'nameColor', label: 'Energy', price: 60 },
  { id: 'name-gold', slot: 'nameColor', label: 'Dourado', price: 150 },
  { id: 'name-fire', slot: 'nameColor', label: 'Fogo', price: 250 },
  { id: 'name-rainbow', slot: 'nameColor', label: 'Prisma', price: 400 },
  { id: 'name-sharingan', slot: 'nameColor', label: 'Sharingan', price: 80 },
  { id: 'name-susanoo', slot: 'nameColor', label: 'Susanoo', price: 80 },
  { id: 'name-rasengan', slot: 'nameColor', label: 'Rasengan', price: 80 },
  { id: 'name-ice', slot: 'nameColor', label: 'Gelo', price: 150 },
  { id: 'name-sakura', slot: 'nameColor', label: 'Sakura', price: 150 },
  { id: 'name-venom', slot: 'nameColor', label: 'Veneno', price: 150 },
  { id: 'name-sunset', slot: 'nameColor', label: 'Pôr do sol', price: 200 },
  { id: 'name-lightning', slot: 'nameColor', label: 'Relâmpago', price: 350 },
  { id: 'name-glitch', slot: 'nameColor', label: 'Glitch', price: 450 },
  { id: 'name-holo', slot: 'nameColor', label: 'Holográfico', price: 500 },

  { id: 'frame-steel', slot: 'frame', label: 'Aço', price: 40 },
  { id: 'frame-neon', slot: 'frame', label: 'Neon', price: 120 },
  { id: 'frame-aura', slot: 'frame', label: 'Aura pulsante', price: 200 },
  { id: 'frame-flame', slot: 'frame', label: 'Chama dourada', price: 350 },
  { id: 'frame-legend', slot: 'frame', label: 'Lendária', price: 600 },
  { id: 'frame-bronze', slot: 'frame', label: 'Bronze', price: 60 },
  { id: 'frame-sakura', slot: 'frame', label: 'Sakura', price: 150 },
  { id: 'frame-ice', slot: 'frame', label: 'Gelo', price: 150 },
  { id: 'frame-venom', slot: 'frame', label: 'Veneno', price: 150 },
  { id: 'frame-lightning', slot: 'frame', label: 'Raio', price: 250 },
  { id: 'frame-sharingan', slot: 'frame', label: 'Sharingan', price: 400 },
  { id: 'frame-galaxy', slot: 'frame', label: 'Galáxia', price: 500 },
  { id: 'frame-dragon', slot: 'frame', label: 'Dragão', price: 800 },

  title('iniciante-prospero', 'Iniciante Próspero', 50, 'Iniciante'),
  title('novato-promissor', 'Novato Promissor', 50, 'Iniciante'),
  title('chutador-profissional', 'Chutador Profissional', 50, 'Iniciante'),
  title('so-mais-uma', 'Só Mais Uma Partida', 50, 'Iniciante'),
  title('mestre-dos-animes', 'Mestre dos Animes', 150, 'Otaku'),
  title('senhor-das-waifus', 'Senhor das Waifus', 150, 'Otaku'),
  title('rei-dos-husbandos', 'Rei dos Husbandos', 150, 'Otaku'),
  title('otaku-de-carteirinha', 'Otaku de Carteirinha', 150, 'Otaku'),
  title('power-scaling', 'Especialista em Power Scaling', 150, 'Otaku'),
  title('chapeu-de-palha', 'Do Bando do Chapéu de Palha', 250, 'Animes'),
  title('decima-primeira-espada', 'Décima Primeira Espada', 250, 'Animes'),
  title('akatsuki', 'Membro da Akatsuki', 250, 'Animes'),
  title('hashira', 'Hashira do Corpo de Caça-Demônios', 250, 'Animes'),
  title('tropa-de-exploracao', 'Tropa de Exploração', 250, 'Animes'),
  title('usuario-de-stand', 'Usuário de Stand', 250, 'Animes'),
  title('heroi-classe-s', 'Herói Classe S', 250, 'Animes'),
  title('alquimista-federal', 'Alquimista Federal', 250, 'Animes'),
  title('mago-fairy-tail', 'Mago da Fairy Tail', 250, 'Animes'),
  title('cacador-licenciado', 'Caçador Licenciado', 250, 'Animes'),
  title('keyblade', 'Portador da Keyblade', 250, 'Games'),
  title('soldado-primeira-classe', 'Soldado de Primeira Classe', 250, 'Games'),
  title('guardiao-da-triforce', 'Guardião da Triforce', 250, 'Games'),
  title('morri-mil-vezes', 'Morri Mil Vezes', 250, 'Games'),
  title('deus-da-destruicao', 'Deus da Destruição', 600, 'Lendário'),
  title('ultra-instinto', 'Ultra Instinto', 700, 'Lendário'),
  title('o-mais-forte', 'O Mais Forte da Atualidade', 700, 'Lendário'),
  title('rei-dos-piratas', 'Rei dos Piratas', 800, 'Lendário'),

  // Exclusivos da Mystery Box (raridade lendária): não estão à venda.
  { id: 'name-aurora', slot: 'nameColor', label: 'Aurora', price: 0, exclusive: true },
  { id: 'name-blackgold', slot: 'nameColor', label: 'Ouro Negro', price: 0, exclusive: true },
  { id: 'name-neonpulse', slot: 'nameColor', label: 'Neon Pulsante', price: 0, exclusive: true },
  { id: 'frame-masterball', slot: 'frame', label: 'Master Ball', price: 0, exclusive: true },
  { id: 'frame-gamecorner', slot: 'frame', label: 'Game Corner', price: 0, exclusive: true },
  { id: 'frame-holo', slot: 'frame', label: 'Holográfica', price: 0, exclusive: true },
  { ...title('sortudo-game-corner', 'Sortudo do Game Corner', 0, 'Exclusivo'), exclusive: true },
  { ...title('viciado-em-gacha', 'Viciado em Gacha', 0, 'Exclusivo'), exclusive: true },
  { ...title('tirou-o-lendario', 'Tirou o Lendário', 0, 'Exclusivo'), exclusive: true },
  { ...title('mestre-da-sorte', 'Mestre da Sorte', 0, 'Exclusivo'), exclusive: true },
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
  /** Id do título (o texto é o `label` do item). */
  title: string | null;
}

export const EMPTY_LOOK: Look = { avatar: null, nameColor: null, frame: null, title: null };

/** Perfil do próprio jogador: saldo, itens comprados e o que está equipado. */
export interface Profile {
  /** Nick atual da conta (pode ter sido trocado em outro dispositivo). */
  name: string;
  coins: number;
  owned: string[];
  look: Look;
  /** O nick tem senha (dá para entrar com ela em outro dispositivo). */
  hasPassword: boolean;
  /** A conta declarou ter 18 anos ou mais (libera cassino e Mystery Box). */
  adult: boolean;
}
