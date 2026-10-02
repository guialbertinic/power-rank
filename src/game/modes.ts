import type { Category, CharacterInfo } from './types';

/** Modo de jogo: uma categoria ou o free for all. Cada modo tem seu próprio ranking. */
export type Mode = Category | 'all';

export const MODES: { id: Mode; label: string }[] = [
  { id: 'anime', label: 'Animes' },
  { id: 'games', label: 'Games' },
  { id: 'pokemon', label: 'Pokémon' },
  { id: 'all', label: 'Free for All' },
];

export const DEFAULT_MODE: Mode = 'anime';

/** Categorias que entram no Free for All (os Pokémon ficam só no modo deles). */
const ALL_CATEGORIES: readonly Category[] = ['anime', 'games'];

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

/** Filtros de uma partida ou sala: gerações (só no modo pokemon) e dificuldade (só fora dele). */
export interface PoolFilter {
  generations?: readonly number[];
  difficulty?: Difficulty;
}

/** Personagem sem `tier` conta como obscuro: só aparece no difícil. */
const maxTier = (difficulty: Difficulty | undefined) => DIFFICULTIES.find((d) => d.id === difficulty)?.maxTier ?? 3;

/**
 * Personagens sorteáveis no modo. Quem ainda não tem imagem fica de fora até ganhar uma.
 * Sem filtro, todos (gerações e tiers).
 */
export function poolFor<T extends CharacterInfo>(mode: Mode, characters: readonly T[], filter: PoolFilter = {}): T[] {
  const { generations, difficulty } = filter;
  const limit = maxTier(difficulty);
  return characters.filter(
    (c) =>
      c.image &&
      (mode === 'all' ? ALL_CATEGORIES.includes(c.category) : c.category === mode) &&
      (mode === 'pokemon' ? !generations || generations.includes(c.generation ?? 0) : (c.tier ?? 3) <= limit),
  );
}

/** Filtro que vale para o modo: gerações no Pokémon, dificuldade nos outros (o que não vale fica de fora). */
export function filterFor(mode: Mode, filter: PoolFilter): PoolFilter {
  return mode === 'pokemon'
    ? filter.generations ? { generations: filter.generations } : {}
    : filter.difficulty ? { difficulty: filter.difficulty } : {};
}
