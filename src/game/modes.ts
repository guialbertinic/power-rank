import type { Category, CharacterInfo } from './types';

/** Modo de jogo: uma categoria ou todas misturadas (free for all). Cada modo tem seu próprio ranking. */
export type Mode = Category | 'all';

export const MODES: { id: Mode; label: string }[] = [
  { id: 'anime', label: 'Animes' },
  { id: 'games', label: 'Games' },
  { id: 'all', label: 'Free for All' },
];

export const DEFAULT_MODE: Mode = 'anime';

export function isMode(value: unknown): value is Mode {
  return MODES.some((m) => m.id === value);
}

/** Personagens sorteáveis no modo. Quem ainda não tem imagem fica de fora até ganhar uma. */
export function poolFor<T extends CharacterInfo>(mode: Mode, characters: readonly T[]): T[] {
  return characters.filter((c) => c.image && (mode === 'all' || c.category === mode));
}

/** Categoria do Desafio Diário (um desafio só por dia, com personagens de todas). */
export const DAILY_MODE: Mode = 'all';
