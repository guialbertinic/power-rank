import { describe, expect, it } from 'vitest';
import {
  CELLS,
  drawCard,
  drawOutcome,
  isValidBet,
  multiplierOf,
  PRIZES,
  SYMBOL_IDS,
  WEIGHT_TOTAL,
  winnerOf,
} from './scratch';

/** Sequência de "sorteios" a partir de uma semente (determinística, para testar muitas cartelas). */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
}

describe('raspadinha', () => {
  it('devolve 95% do apostado', () => {
    const r = PRIZES.reduce((sum, p) => sum + (p.multiplier * p.weight) / WEIGHT_TOTAL, 0);
    expect(r).toBeCloseTo(0.95, 12);
  });

  it('chances: ganha em 23% das cartelas; o resto não tem trio', () => {
    const wins = PRIZES.reduce((sum, p) => sum + p.weight, 0);
    expect(wins / WEIGHT_TOTAL).toBeCloseTo(0.23, 12);
    expect(drawOutcome(() => 0)).toBe('ss');
    expect(drawOutcome(() => 19 / WEIGHT_TOTAL)).toBe('ss');
    expect(drawOutcome(() => 20 / WEIGHT_TOTAL)).toBe('s');
    expect(drawOutcome(() => (wins - 1) / WEIGHT_TOTAL)).toBe('d');
    expect(drawOutcome(() => wins / WEIGHT_TOTAL)).toBeNull();
    expect(drawOutcome(() => 0.9999)).toBeNull();
  });

  it('cartela coerente com o resultado: um trio no máximo, outros símbolos até 2 vezes', () => {
    const random = seeded(42);
    for (const outcome of [...SYMBOL_IDS, null]) {
      for (let i = 0; i < 300; i++) {
        const cells = drawCard(outcome, random);
        expect(cells).toHaveLength(CELLS);
        expect(winnerOf(cells)).toBe(outcome);
        for (const id of SYMBOL_IDS) {
          const count = cells.filter((c) => c === id).length;
          expect(count).toBeLessThanOrEqual(id === outcome ? 3 : 2);
        }
      }
    }
  });

  it('o trio cai em casas diferentes', () => {
    const random = seeded(7);
    const positions = new Set<number>();
    for (let i = 0; i < 200; i++) drawCard('ss', random).forEach((c, idx) => c === 'ss' && positions.add(idx));
    expect(positions.size).toBe(CELLS);
  });

  it('multiplicador e apostas', () => {
    expect(multiplierOf('ss')).toBe(100);
    expect(multiplierOf('d')).toBe(1);
    expect(multiplierOf(null)).toBe(0);
    expect(isValidBet(1) && isValidBet(10)).toBe(true);
    expect(isValidBet(0) || isValidBet(11) || isValidBet(2.5) || isValidBet('3')).toBe(false);
  });
});
