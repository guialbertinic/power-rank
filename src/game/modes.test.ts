import { describe, expect, it } from 'vitest';
import { parseGenerations, poolFor } from './modes';
import type { CharacterInfo } from './types';

const char = (id: string, category: CharacterInfo['category'], generation?: number): CharacterInfo => ({
  id,
  name: id,
  category,
  series: 'x',
  image: `chars/${id}.webp`,
  ...(generation ? { generation } : {}),
});

const chars = [char('goku', 'anime'), char('mario', 'games'), char('pikachu', 'pokemon', 1), char('lucario', 'pokemon', 4)];

describe('poolFor', () => {
  it('keeps Pokémon out of Free for All', () => {
    expect(poolFor('all', chars).map((c) => c.id)).toEqual(['goku', 'mario']);
  });

  it('filters Pokémon by generation', () => {
    expect(poolFor('pokemon', chars).map((c) => c.id)).toEqual(['pikachu', 'lucario']);
    expect(poolFor('pokemon', chars, [4]).map((c) => c.id)).toEqual(['lucario']);
  });

  it('ignores the generation filter outside the pokemon mode', () => {
    expect(poolFor('anime', chars, [4]).map((c) => c.id)).toEqual(['goku']);
  });
});

describe('parseGenerations', () => {
  it('sorts and dedupes', () => {
    expect(parseGenerations([3, 1, 3])).toEqual([1, 3]);
  });

  it('treats missing or all generations as no filter', () => {
    expect(parseGenerations(undefined)).toBeUndefined();
    expect(parseGenerations([1, 2, 3, 4, 5, 6, 7, 8, 9])).toBeUndefined();
  });

  it('rejects empty or out-of-range lists', () => {
    expect(parseGenerations([])).toBeNull();
    expect(parseGenerations([0])).toBeNull();
    expect(parseGenerations([10])).toBeNull();
    expect(parseGenerations('1')).toBeNull();
  });
});
