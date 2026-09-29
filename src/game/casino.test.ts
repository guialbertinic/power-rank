import { describe, expect, it } from 'vitest';
import {
  BET_MAX,
  drawReels,
  evaluate,
  isValidBet,
  jackpotPrize,
  potContributionCents,
  potShare,
  SYMBOLS,
  symbolChance,
  type SymbolId,
} from './casino';

/** Retorno esperado exato da tabela fixa (jackpot no prêmio mínimo), somando as 6³ combinações. */
function baseReturn(): number {
  let total = 0;
  for (const a of SYMBOLS)
    for (const b of SYMBOLS)
      for (const c of SYMBOLS) {
        const reels = [a.id, b.id, c.id] as SymbolId[];
        const p = symbolChance(a.id) * symbolChance(b.id) * symbolChance(c.id);
        const outcome = evaluate(reels);
        const multiplier = outcome.kind === 'jackpot' ? jackpotPrize(10, 0) / 10 : outcome.kind === 'none' ? 0 : outcome.multiplier;
        total += p * multiplier;
      }
  return total;
}

describe('cassino', () => {
  it('tabela fixa devolve ~90% (o pote completa ~95%)', () => {
    const r = baseReturn();
    expect(r).toBeGreaterThan(0.88);
    expect(r).toBeLessThan(0.92);
  });

  it('jackpot sai perto de 1 a cada 4.600 giros', () => {
    const p = symbolChance('seven') ** 3;
    expect(Math.round(1 / p)).toBeGreaterThan(4000);
    expect(Math.round(1 / p)).toBeLessThan(5500);
  });

  it('avalia trincas, pares e nada', () => {
    expect(evaluate(['seven', 'seven', 'seven'])).toEqual({ kind: 'jackpot' });
    expect(evaluate(['galactic', 'galactic', 'galactic'])).toEqual({ kind: 'three', symbol: 'galactic', multiplier: 60 });
    expect(evaluate(['cherry', 'pikachu', 'cherry'])).toEqual({ kind: 'pair', symbol: 'cherry', multiplier: 1 });
    expect(evaluate(['moonstone', 'seven', 'seven'])).toEqual({ kind: 'pair', symbol: 'seven', multiplier: 5 });
    expect(evaluate(['cherry', 'moonstone', 'replay'])).toEqual({ kind: 'none' });
    // Par de Pedra da Lua não paga.
    expect(evaluate(['moonstone', 'moonstone', 'pikachu'])).toEqual({ kind: 'none' });
  });

  it('jackpot: nunca menos que 100× e proporcional à aposta', () => {
    expect(jackpotPrize(1, 50)).toBe(100); // pote pequeno: vale o mínimo
    expect(jackpotPrize(10, 4000)).toBe(2000); // aposta máxima leva 50% do pote
    expect(potShare(1, 4000)).toBe(200); // aposta 1 leva 10% disso
    expect(jackpotPrize(BET_MAX, 0)).toBe(1000);
  });

  it('apostas válidas e contribuição ao pote (em centésimos)', () => {
    expect(isValidBet(1)).toBe(true);
    expect(isValidBet(10)).toBe(true);
    expect(isValidBet(0)).toBe(false);
    expect(isValidBet(11)).toBe(false);
    expect(isValidBet(1.5)).toBe(false);
    expect(isValidBet('5')).toBe(false);
    expect(potContributionCents(1)).toBe(5);
    expect(potContributionCents(10)).toBe(50);
  });

  it('sorteio usa os pesos', () => {
    expect(drawReels(() => 0)).toEqual(['seven', 'seven', 'seven']);
    expect(drawReels(() => 0.9999)).toEqual(['moonstone', 'moonstone', 'moonstone']);
  });
});
