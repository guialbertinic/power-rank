import { describe, expect, it } from 'vitest';
import { correctRange, distanceTo, MAX_SCORE, scoreGame } from './scoring';
import { drawCharacters } from './draw';
import type { Character } from './types';

const char = (id: string, power: number): Character => ({ id, name: id, anime: 'x', power });

describe('correctRange', () => {
  it('accepts every tied position', () => {
    const drawn = [char('a', 90), char('b', 80), char('c', 80), char('d', 10)];
    expect(correctRange(drawn[0], drawn)).toEqual({ min: 1, max: 1 });
    expect(correctRange(drawn[1], drawn)).toEqual({ min: 2, max: 3 });
    expect(correctRange(drawn[3], drawn)).toEqual({ min: 4, max: 4 });
  });
});

describe('distanceTo', () => {
  it('is zero inside the range and grows outside it', () => {
    const range = { min: 3, max: 5 };
    expect(distanceTo(4, range)).toBe(0);
    expect(distanceTo(1, range)).toBe(2);
    expect(distanceTo(7, range)).toBe(2);
  });
});

describe('scoreGame', () => {
  const ten = Array.from({ length: 10 }, (_, i) => char(`c${i}`, 100 - i * 10));

  it('gives max score for the perfect order', () => {
    expect(scoreGame(ten).total).toBe(MAX_SCORE);
  });

  it('scores the reversed order by distance', () => {
    const result = scoreGame([...ten].reverse());
    expect(result.results.map((r) => r.distance)).toEqual([9, 7, 5, 3, 1, 1, 3, 5, 7, 9]);
    expect(result.total).toBe(10 + 60 + 60 + 10);
  });

  it('returns the correct order strongest first', () => {
    expect(scoreGame([...ten].reverse()).correctOrder).toEqual(ten);
  });
});

describe('drawCharacters', () => {
  it('draws distinct characters', () => {
    const pool = Array.from({ length: 30 }, (_, i) => char(`c${i}`, i));
    const drawn = drawCharacters(pool, 10);
    expect(new Set(drawn.map((c) => c.id)).size).toBe(10);
  });

  it('throws when the pool is too small', () => {
    expect(() => drawCharacters([char('a', 1)], 10)).toThrow();
  });
});
