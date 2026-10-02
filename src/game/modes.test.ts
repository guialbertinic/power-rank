import { describe, expect, it } from 'vitest';
import { filterFor, parseDifficulty, parseGenerations, poolFor } from './modes';
import type { CharacterInfo } from './types';

const char = (id: string, category: CharacterInfo['category'], extra: Partial<CharacterInfo> = {}): CharacterInfo => ({
  id,
  name: id,
  category,
  series: 'x',
  image: `chars/${id}.webp`,
  ...extra,
});

const chars = [
  char('goku', 'anime', { tier: 1 }),
  char('mario', 'games', { tier: 1 }),
  char('pikachu', 'pokemon', { generation: 1 }),
  char('lucario', 'pokemon', { generation: 4 }),
];

const ids = (list: CharacterInfo[]) => list.map((c) => c.id);

describe('poolFor', () => {
  it('keeps Pokémon out of Free for All', () => {
    expect(ids(poolFor('all', chars))).toEqual(['goku', 'mario']);
  });

  it('filters Pokémon by generation', () => {
    expect(ids(poolFor('pokemon', chars))).toEqual(['pikachu', 'lucario']);
    expect(ids(poolFor('pokemon', chars, { generations: [4] }))).toEqual(['lucario']);
  });

  it('ignores the generation filter outside the pokemon mode', () => {
    expect(ids(poolFor('anime', chars, { generations: [4] }))).toEqual(['goku']);
  });

  it('filters by difficulty, cumulatively', () => {
    const anime = [char('goku', 'anime', { tier: 1 }), char('reigen', 'anime', { tier: 2 }), char('raizen', 'anime', { tier: 3 })];
    expect(ids(poolFor('anime', anime, { difficulty: 'easy' }))).toEqual(['goku']);
    expect(ids(poolFor('anime', anime, { difficulty: 'medium' }))).toEqual(['goku', 'reigen']);
    expect(ids(poolFor('anime', anime, { difficulty: 'hard' }))).toEqual(['goku', 'reigen', 'raizen']);
    expect(ids(poolFor('anime', anime))).toEqual(['goku', 'reigen', 'raizen']);
  });

  it('treats a character without tier as obscure', () => {
    const anime = [char('goku', 'anime', { tier: 1 }), char('new', 'anime')];
    expect(ids(poolFor('anime', anime, { difficulty: 'medium' }))).toEqual(['goku']);
  });

  it('ignores the difficulty in the pokemon mode', () => {
    expect(ids(poolFor('pokemon', chars, { difficulty: 'easy' }))).toEqual(['pikachu', 'lucario']);
  });
});

describe('filterFor', () => {
  it('keeps only the filter of the mode', () => {
    const filter = { generations: [1], difficulty: 'easy' as const };
    expect(filterFor('pokemon', filter)).toEqual({ generations: [1] });
    expect(filterFor('all', filter)).toEqual({ difficulty: 'easy' });
  });
});

describe('parseDifficulty', () => {
  it('accepts the three levels and treats missing as no filter', () => {
    expect(parseDifficulty('easy')).toBe('easy');
    expect(parseDifficulty(undefined)).toBeUndefined();
    expect(parseDifficulty('insane')).toBeNull();
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
