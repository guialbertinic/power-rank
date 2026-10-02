import { describe, expect, it } from 'vitest';
import { drawFor, filterFor, parseCategories, parseDifficulty, parseFilter, parseGenerations, poolFor } from './modes';
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
  char('vader', 'movies', { tier: 1 }),
  char('pikachu', 'pokemon', { generation: 1 }),
  char('lucario', 'pokemon', { generation: 4 }),
];

const ids = (list: CharacterInfo[]) => list.map((c) => c.id);

describe('poolFor', () => {
  it('keeps Pokémon out of Free for All by default', () => {
    expect(ids(poolFor('all', chars))).toEqual(['goku', 'mario', 'vader']);
  });

  it('mixes only the chosen categories in Free for All, Pokémon in any difficulty', () => {
    expect(ids(poolFor('all', chars, { categories: ['movies', 'pokemon'], difficulty: 'easy' }))).toEqual(['vader', 'pikachu', 'lucario']);
    expect(ids(poolFor('anime', chars, { categories: ['games'] }))).toEqual(['goku']);
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
    expect(filterFor('anime', { ...filter, categories: ['games'] })).toEqual({ difficulty: 'easy' });
    expect(filterFor('all', { ...filter, categories: ['games'] })).toEqual({ difficulty: 'easy', categories: ['games'] });
  });
});

describe('parseCategories', () => {
  it('keeps the selector order and treats the default as no filter', () => {
    expect(parseCategories(['pokemon', 'anime', 'anime'])).toEqual(['anime', 'pokemon']);
    expect(parseCategories(['movies', 'games', 'anime'])).toBeUndefined();
    expect(parseCategories(undefined)).toBeUndefined();
  });

  it('rejects empty or unknown lists', () => {
    expect(parseCategories([])).toBeNull();
    expect(parseCategories(['all'])).toBeNull();
    expect(parseCategories('anime')).toBeNull();
  });
});

describe('parseFilter', () => {
  it('validates only what the mode uses', () => {
    expect(parseFilter('anime', { generations: 'x', categories: 'x', difficulty: 'easy' })).toEqual({ difficulty: 'easy' });
    expect(parseFilter('all', { categories: ['pokemon'] })).toEqual({ categories: ['pokemon'] });
    expect(parseFilter('all', { categories: [] })).toBe('Categorias inválidas');
    expect(parseFilter('pokemon', { generations: [10] })).toBe('Gerações inválidas');
  });
});

describe('drawFor', () => {
  it('balances Free for All between categories, even with many Pokémon', () => {
    const pool = [
      ...Array.from({ length: 1000 }, (_, i) => char(`p${i}`, 'pokemon', { generation: 1 })),
      ...Array.from({ length: 10 }, (_, i) => char(`a${i}`, 'anime', { tier: 1 })),
    ];
    let pokemon = 0;
    for (let round = 0; round < 50; round++) pokemon += drawFor('all', pool, 10).filter((c) => c.category === 'pokemon').length;
    // 500 sorteados em 50 rodadas: metade de cada (~250), longe dos ~99% de um sorteio simples.
    expect(pokemon).toBeGreaterThan(175);
    expect(pokemon).toBeLessThan(325);
  });

  it('draws distinct characters and fills from the bigger categories when one runs out', () => {
    const pool = [char('a1', 'anime'), ...Array.from({ length: 20 }, (_, i) => char(`g${i}`, 'games'))];
    const drawn = drawFor('all', pool, 10);
    expect(new Set(ids(drawn)).size).toBe(10);
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
