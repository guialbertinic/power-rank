import { describe, expect, it } from 'vitest';
import { correctRange, MAX_SCORE, rankLevel, scoreGame, strengthRanks, withRanks } from './scoring';
import { drawCharacters } from './draw';
import type { Character } from './types';

const char = (id: string, power: number): Character => ({ id, name: id, category: 'anime', series: 'x', power });

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
    expect(result.results.every((r) => r.distance === 0 && r.points === 100)).toBe(true);
  });

  it('scores each character by its distance to the right position', () => {
    // Invertido: distâncias 9, 7, 5, 3, 1, 1, 3, 5, 7, 9 → só os 4 do meio pontuam (15 + 70 + 70 + 15).
    const reversed = scoreGame([...ten].reverse());
    expect(reversed.results.map((r) => r.distance)).toEqual([9, 7, 5, 3, 1, 1, 3, 5, 7, 9]);
    expect(reversed.total).toBe(170);
  });

  it('two neighbours swapped lose 30 points each', () => {
    const swapped = [...ten];
    [swapped[4], swapped[5]] = [swapped[5], swapped[4]];
    const result = scoreGame(swapped);
    expect(result.results.map((r) => r.points)).toEqual([100, 100, 100, 100, 70, 70, 100, 100, 100, 100]);
    expect(result.total).toBe(940);
  });

  it('a character far from its place shifts the others too', () => {
    // O mais fraco foi colocado em 1º: ele erra por 9 casas e todos os outros ficam 1 casa abaixo.
    const shifted = scoreGame([ten[9], ...ten.slice(0, 9)]);
    expect(shifted.results.map((r) => r.distance)).toEqual([9, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(shifted.total).toBe(630);
  });

  it('accepts any position inside a tie as exact', () => {
    const tied = [char('a', 50), char('b', 50), char('c', 10)];
    expect(scoreGame(tied).total).toBe(300);
    expect(scoreGame([tied[1], tied[0], tied[2]]).total).toBe(300);
    // O empatado em 3º está a 1 casa da faixa 1–2.
    expect(scoreGame([tied[0], tied[2], tied[1]]).results.map((r) => r.distance)).toEqual([0, 1, 1]);
  });

  it('title levels follow the score bands', () => {
    expect([0, 399, 400, 549, 550, 699, 700, 849, 850, 1000].map(rankLevel)).toEqual([
      'noob', 'noob', 'retry', 'retry', 'brabo', 'brabo', 'cooking', 'cooking', 'nerd', 'nerd',
    ]);
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

describe('strengthRanks / withRanks', () => {
  it('posições relativas dão a mesma pontuação que o poder real (com empates)', () => {
    const powers = [95, 80, 80, 70, 50, 50, 50, 30, 10, 5];
    const drawn = powers.map((p, i) => char(`c${i}`, p));
    const ranks = strengthRanks(drawn);
    expect(ranks.c1).toBe(1);
    expect(ranks.c2).toBe(1); // empatado com c1
    for (let round = 0; round < 50; round++) {
      const shuffled = [...drawn].sort(() => Math.random() - 0.5);
      const real = scoreGame(shuffled);
      const fromRanks = scoreGame(withRanks(shuffled.map(({ power: _, ...info }) => info), ranks));
      expect(fromRanks.total).toBe(real.total);
      expect(fromRanks.results.map((r) => r.distance)).toEqual(real.results.map((r) => r.distance));
      expect(fromRanks.correctOrder.map((c) => c.id)).toEqual(real.correctOrder.map((c) => c.id));
    }
  });
});
