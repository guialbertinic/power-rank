import { describe, expect, it } from 'vitest';
import {
  BET_MAX,
  drawReels,
  evaluate,
  isValidBet,
  jackpotPrize,
  potContribution,
  potShare,
  SYMBOLS,
  symbolChance,
  type SymbolId,
} from './casino';

/** Retorno esperado exato da tabela fixa (jackpot no prêmio mínimo), somando as 7³ combinações. */
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
    const p = symbolChance('dragonball') ** 3;
    expect(Math.round(1 / p)).toBeGreaterThan(4000);
    expect(Math.round(1 / p)).toBeLessThan(5500);
  });

  it('avalia trincas, pares e nada', () => {
    expect(evaluate(['dragonball', 'dragonball', 'dragonball'])).toEqual({ kind: 'jackpot' });
    expect(evaluate(['sharingan', 'sharingan', 'sharingan'])).toEqual({ kind: 'three', symbol: 'sharingan', multiplier: 60 });
    expect(evaluate(['hat', 'pokeball', 'hat'])).toEqual({ kind: 'pair', symbol: 'hat', multiplier: 1 });
    expect(evaluate(['pokeball', 'dragonball', 'dragonball'])).toEqual({ kind: 'pair', symbol: 'dragonball', multiplier: 5 });
    expect(evaluate(['hat', 'pokeball', 'shuriken'])).toEqual({ kind: 'none' });
  });

  it('jackpot: nunca menos que 100× e proporcional à aposta', () => {
    expect(jackpotPrize(10, 1000)).toBe(1000); // pote pequeno: vale o mínimo
    expect(jackpotPrize(100, 40000)).toBe(20000); // aposta máxima leva 50% do pote
    expect(potShare(10, 40000)).toBe(2000); // aposta 10 leva 10% disso
    expect(jackpotPrize(BET_MAX, 0)).toBe(10000);
  });

  it('apostas válidas e contribuição ao pote', () => {
    expect(isValidBet(10)).toBe(true);
    expect(isValidBet(100)).toBe(true);
    expect(isValidBet(15)).toBe(false);
    expect(isValidBet(110)).toBe(false);
    expect(isValidBet('50')).toBe(false);
    expect(potContribution(10)).toBe(1);
    expect(potContribution(100)).toBe(5);
  });

  it('sorteio usa os pesos', () => {
    expect(drawReels(() => 0)).toEqual(['dragonball', 'dragonball', 'dragonball']);
    expect(drawReels(() => 0.9999)).toEqual(['pokeball', 'pokeball', 'pokeball']);
  });
});
