import { drawCharacters } from './draw';
import type { Category, CharacterInfo } from './types';

/** Modo de jogo: uma categoria ou o free for all. Cada modo tem seu próprio ranking. */
export type Mode = Category | 'all';

/** Modos na ordem do seletor (o nome na tela vem de `modeLabel`, em src/i18n). */
export const MODES: { id: Mode }[] = [{ id: 'anime' }, { id: 'games' }, { id: 'movies' }, { id: 'pokemon' }, { id: 'all' }];

export const DEFAULT_MODE: Mode = 'anime';

/** Categorias que o Free for All pode misturar (o jogador escolhe), na ordem do seletor. */
export const FFA_CATEGORIES: readonly Category[] = ['anime', 'games', 'movies', 'pokemon'];
/** As que vêm ligadas (o Desafio Diário do Free for All usa sempre estas). Pokémon só se o jogador ligar. */
export const DEFAULT_FFA_CATEGORIES: readonly Category[] = ['anime', 'games', 'movies'];

/**
 * Categorias do Free for All vindas do cliente: lista sem repetição, na ordem de FFA_CATEGORIES, ou null se inválida
 * (vazia, desconhecida). undefined/null = o padrão.
 */
export function parseCategories(value: unknown): Category[] | null | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length === 0 || value.length > FFA_CATEGORIES.length) return null;
  if (!value.every((c) => (FFA_CATEGORIES as readonly unknown[]).includes(c))) return null;
  const list = FFA_CATEGORIES.filter((c) => value.includes(c));
  // Igual ao padrão é o mesmo que sem filtro.
  return list.join() === DEFAULT_FFA_CATEGORIES.join() ? undefined : list;
}

/**
 * Dificuldade (Animes, Games e Free for All): limita o sorteio pela fama do personagem (`tier`: 1 mainstream,
 * 2 médio, 3 obscuro). Cumulativa: o difícil inclui todos. O modo Pokémon usa o filtro de gerações no lugar.
 */
export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTIES: { id: Difficulty; maxTier: number }[] = [
  { id: 'easy', maxTier: 1 },
  { id: 'medium', maxTier: 2 },
  { id: 'hard', maxTier: 3 },
];

export const DEFAULT_DIFFICULTY: Difficulty = 'medium';

export function isDifficulty(value: unknown): value is Difficulty {
  return DIFFICULTIES.some((d) => d.id === value);
}

/** Dificuldade vinda do cliente: undefined/null = sem filtro (todos), null se inválida. */
export function parseDifficulty(value: unknown): Difficulty | null | undefined {
  if (value === undefined || value === null) return undefined;
  return isDifficulty(value) ? value : null;
}

/** Gerações de Pokémon que o jogador pode ligar/desligar (filtro do modo pokemon). */
export const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export function isMode(value: unknown): value is Mode {
  return MODES.some((m) => m.id === value);
}

/**
 * Filtro de gerações vindo do cliente: lista sem repetição e em ordem, ou null se inválido (vazio, fora de 1–9).
 * undefined/null = todas.
 */
export function parseGenerations(value: unknown): number[] | null | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length === 0 || value.length > GENERATIONS.length) return null;
  if (!value.every((g) => (GENERATIONS as readonly unknown[]).includes(g))) return null;
  const list = [...new Set(value as number[])].sort((a, b) => a - b);
  // Todas ligadas é o mesmo que sem filtro.
  return list.length === GENERATIONS.length ? undefined : list;
}

/** Filtros de uma partida ou sala: gerações (só no modo pokemon), dificuldade (fora dele) e categorias (Free for All). */
export interface PoolFilter {
  generations?: readonly number[];
  difficulty?: Difficulty;
  categories?: readonly Category[];
}

/** Personagem sem `tier` conta como obscuro: só aparece no difícil. */
const maxTier = (difficulty: Difficulty | undefined) => DIFFICULTIES.find((d) => d.id === difficulty)?.maxTier ?? 3;

/**
 * Personagens sorteáveis no modo. Quem ainda não tem imagem fica de fora até ganhar uma.
 * Sem filtro, todos (gerações e tiers); no Free for All, as categorias padrão. Pokémon não tem fama: no Free for All
 * entra em qualquer dificuldade (o sorteio equilibrado por categoria impede que domine).
 */
export function poolFor<T extends CharacterInfo>(mode: Mode, characters: readonly T[], filter: PoolFilter = {}): T[] {
  const { generations, difficulty } = filter;
  const categories = filter.categories ?? DEFAULT_FFA_CATEGORIES;
  const limit = maxTier(difficulty);
  return characters.filter(
    (c) =>
      c.image &&
      (mode === 'all' ? categories.includes(c.category) : c.category === mode) &&
      (c.category === 'pokemon' ? mode !== 'pokemon' || !generations || generations.includes(c.generation ?? 0) : (c.tier ?? 3) <= limit),
  );
}

/**
 * Sorteia a partida do modo. No Free for All, cada casa sorteia primeiro a categoria (entre as que ainda têm
 * personagem) e depois o personagem: a mistura fica equilibrada mesmo com 1025 Pokémon ligados.
 */
export function drawFor<T extends CharacterInfo>(mode: Mode, pool: readonly T[], count: number, rng: () => number = Math.random): T[] {
  if (mode !== 'all') return drawCharacters(pool, count, rng);
  if (pool.length < count) throw new Error(`Pool tem ${pool.length} personagens, precisa de pelo menos ${count}`);
  const groups = new Map<Category, T[]>();
  for (const c of pool) groups.set(c.category, [...(groups.get(c.category) ?? []), c]);
  const drawn: T[] = [];
  while (drawn.length < count) {
    const open = [...groups.values()].filter((g) => g.length > 0);
    const group = open[Math.floor(rng() * open.length)];
    drawn.push(group.splice(Math.floor(rng() * group.length), 1)[0]);
  }
  return drawn;
}

/** Filtro que vale para o modo: gerações no Pokémon, dificuldade nos outros e categorias no Free for All. */
export function filterFor(mode: Mode, filter: PoolFilter): PoolFilter {
  if (mode === 'pokemon') return filter.generations ? { generations: filter.generations } : {};
  return {
    ...(filter.difficulty ? { difficulty: filter.difficulty } : {}),
    ...(mode === 'all' && filter.categories ? { categories: filter.categories } : {}),
  };
}

/**
 * Filtro vindo do cliente (partida solo, sala da party), já validado para o modo: o que não vale para o modo é
 * ignorado. Devolve a mensagem de erro (em português, traduzida no site) se algo for inválido.
 */
export function parseFilter(mode: Mode, body: { generations?: unknown; difficulty?: unknown; categories?: unknown }): PoolFilter | string {
  const generations = mode === 'pokemon' ? parseGenerations(body.generations) : undefined;
  if (generations === null) return 'Gerações inválidas';
  const difficulty = mode !== 'pokemon' ? parseDifficulty(body.difficulty) : undefined;
  if (difficulty === null) return 'Dificuldade inválida';
  const categories = mode === 'all' ? parseCategories(body.categories) : undefined;
  if (categories === null) return 'Categorias inválidas';
  return {
    ...(generations ? { generations } : {}),
    ...(difficulty ? { difficulty } : {}),
    ...(categories ? { categories } : {}),
  };
}
