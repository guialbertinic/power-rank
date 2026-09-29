/** Sorteia `count` itens distintos (Fisher-Yates parcial). */
export function drawCharacters<T>(pool: readonly T[], count: number, rng: () => number = Math.random): T[] {
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
