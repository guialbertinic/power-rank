import { describe, expect, it } from 'vitest';
import {
  drawPath,
  isRisk,
  isValidBet,
  multipliersOf,
  multiplierText,
  prizeFor,
  RISKS,
  ROWS,
  SLOTS,
  slotChance,
  slotOf,
  type Risk,
} from './plinko';

/** Retorno esperado exato de um nível de risco (soma das casas × chance). */
const expectedReturn = (risk: Risk) =>
  multipliersOf(risk).reduce((sum, tenths, slot) => sum + (tenths / 10) * slotChance(slot), 0);

describe('plinko', () => {
  it.each(RISKS)('risco %s devolve ~95%', (risk) => {
    const r = expectedReturn(risk);
    expect(r).toBeGreaterThan(0.93);
    expect(r).toBeLessThan(0.96);
  });

  it('chances somam 1 e o tabuleiro é simétrico', () => {
    const total = Array.from({ length: SLOTS }, (_, s) => slotChance(s)).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 12);
    expect(slotChance(0)).toBe(1 / 2 ** ROWS);
    for (const risk of RISKS) {
      const m = multipliersOf(risk);
      expect(m).toEqual([...m].reverse());
    }
  });

  it('risco maior paga mais nas pontas e menos no meio', () => {
    const [low, medium, high] = RISKS.map(multipliersOf);
    expect(high[0]).toBeGreaterThan(medium[0]);
    expect(medium[0]).toBeGreaterThan(low[0]);
    expect(high[ROWS / 2]).toBeLessThan(low[ROWS / 2]);
  });

  it('caminho e casa', () => {
    expect(drawPath(() => 0)).toEqual(Array(ROWS).fill(0));
    expect(slotOf(drawPath(() => 0.99))).toBe(ROWS);
    expect(slotOf([1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1])).toBe(3);
  });

  it('prêmio: parte inteira garantida e fração por sorteio (média certa)', () => {
    expect(prizeFor(10, 16, () => 0.99)).toBe(16);
    expect(prizeFor(1, 16, () => 0.59)).toBe(2);
    expect(prizeFor(1, 16, () => 0.6)).toBe(1);
    expect(prizeFor(1, 2, () => 0.5)).toBe(0);
    // Média exata sobre 10 sorteios igualmente espaçados: 1 × 1,6 = 1,6.
    const avg = Array.from({ length: 10 }, (_, i) => prizeFor(1, 16, () => i / 10)).reduce((a, b) => a + b) / 10;
    expect(avg).toBeCloseTo(1.6, 12);
  });

  it('apostas e riscos válidos; texto do multiplicador', () => {
    expect(isValidBet(1) && isValidBet(10)).toBe(true);
    expect(isValidBet(0) || isValidBet(11) || isValidBet(2.5) || isValidBet('3')).toBe(false);
    expect(isRisk('high') && !isRisk('extreme')).toBe(true);
    expect(multiplierText(16, ',')).toBe('1,6×');
    expect(multiplierText(1300, '.')).toBe('130×');
  });
});
