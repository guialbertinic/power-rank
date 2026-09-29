import { describe, expect, it } from 'vitest';
import { correctRange, MAX_SCORE, scoreGame } from './scoring';
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

describe('scoreGame', () => {
  const ten = Array.from({ length: 10 }, (_, i) => char(`c${i}`, 100 - i * 10));

  it('gives max score for the perfect order', () => {
    const result = scoreGame(ten);
    expect(result.total).toBe(MAX_SCORE);
    expect(result.pairsRight).toBe(45);
    expect(result.results.every((r) => r.pairsRight === 9)).toBe(true);
  });

  it('gives zero for the reversed order', () => {
    expect(scoreGame([...ten].reverse()).total).toBe(0);
  });

  it('loses a single pair when two neighbours are swapped', () => {
    const swapped = [...ten];
    [swapped[4], swapped[5]] = [swapped[5], swapped[4]];
    const result = scoreGame(swapped);
    expect(result.pairsRight).toBe(44);
    expect(result.total).toBe(Math.round((1000 * 44) / 45));
    expect(result.results.map((r) => r.pairsRight)).toEqual([9, 9, 9, 9, 8, 8, 9, 9, 9, 9]);
  });

  it('rewards relative order even when every position is shifted', () => {
    // O mais fraco foi colocado em 1º; o resto está na ordem certa, só deslocado uma posição.
    const shifted = [ten[9], ...ten.slice(0, 9)];
    expect(scoreGame(shifted).pairsRight).toBe(36);
  });

  it('counts tied pairs as right in either order', () => {
    const tied = [char('a', 50), char('b', 50), char('c', 10)];
    expect(scoreGame(tied).total).toBe(MAX_SCORE);
    expect(scoreGame([tied[1], tied[0], tied[2]]).total).toBe(MAX_SCORE);
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
