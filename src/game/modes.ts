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

/**
 * Personagens sorteáveis no modo. Quem ainda não tem imagem fica de fora até ganhar uma.
 * `generations` só vale no modo pokemon (sem ela, todas).
 */
export function poolFor<T extends CharacterInfo>(mode: Mode, characters: readonly T[], generations?: readonly number[]): T[] {
  return characters.filter(
    (c) =>
      c.image &&
      (mode === 'all' ? ALL_CATEGORIES.includes(c.category) : c.category === mode) &&
      (mode !== 'pokemon' || !generations || generations.includes(c.generation ?? 0)),
  );
}
