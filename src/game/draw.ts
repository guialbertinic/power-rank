import type { Character } from './types';

/** Sorteia `count` personagens distintos (Fisher-Yates parcial). */
export function drawCharacters(
  pool: readonly Character[],
  count: number,
  rng: () => number = Math.random,
): Character[] {
  if (pool.length < count) {
    throw new Error(`Pool tem ${pool.length} personagens, precisa de pelo menos ${count}`);
  }
  const copy = [...pool];
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}
