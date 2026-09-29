import { describe, expect, it } from 'vitest';
import { COSMETICS } from './cosmetics';
import { drawBox, duplicateRefund, GACHA_POOLS, RARITIES, rarityOf } from './gacha';

/** Gerador que devolve os valores da lista, em ordem. */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('mystery box', () => {
  it('chances das raridades somam 100%', () => {
    expect(RARITIES.reduce((sum, r) => sum + r.chance, 0)).toBeCloseTo(1);
  });

  it('todo cosmético cai em exatamente uma raridade; exclusivos só no lendário', () => {
    const pooled = Object.values(GACHA_POOLS).flat();
    expect(pooled.length).toBe(COSMETICS.length);
    expect(GACHA_POOLS.legendary.length).toBeGreaterThan(0);
    expect(GACHA_POOLS.legendary.every((c) => c.exclusive)).toBe(true);
    expect([...GACHA_POOLS.common, ...GACHA_POOLS.rare, ...GACHA_POOLS.epic].some((c) => c.exclusive)).toBe(false);
  });

  it('raridade pelo preço', () => {
    const byId = (id: string) => COSMETICS.find((c) => c.id === id)!;
    expect(rarityOf(byId('name-cyan'))).toBe('common'); // 60
    expect(rarityOf(byId('frame-neon'))).toBe('common'); // 120
    expect(rarityOf(byId('name-gold'))).toBe('rare'); // 150
    expect(rarityOf(byId('name-lightning'))).toBe('epic'); // 350
    expect(rarityOf(byId('frame-dragon'))).toBe('epic'); // 800
    expect(rarityOf(byId('name-aurora'))).toBe('legendary');
  });

  it('sorteio: raridade pela faixa e, no comum, avatar ou cosmético', () => {
    // 0.1 → comum; 0.2 → avatar (< 50%); 0 → primeiro personagem.
    expect(drawBox(sequence(0.1, 0.2, 0), ['goku', 'luffy'])).toEqual({ rarity: 'common', itemId: 'avatar:goku' });
    // 0.1 → comum; 0.9 → índice no pool; 0.7 → cosmético (≥ 50%).
    expect(drawBox(sequence(0.1, 0.9, 0.7), ['goku']).itemId.startsWith('avatar:')).toBe(false);
    expect(drawBox(sequence(0.7, 0), []).rarity).toBe('rare'); // 0.60–0.88
    expect(drawBox(sequence(0.9, 0), []).rarity).toBe('epic'); // 0.88–0.98
    expect(drawBox(sequence(0.99, 0), [])).toEqual({ rarity: 'legendary', itemId: GACHA_POOLS.legendary[0].id });
  });

  it('repetido devolve metade do preço (lendário: 300)', () => {
    expect(duplicateRefund({ rarity: 'common', itemId: 'avatar:goku' })).toBe(25);
    expect(duplicateRefund({ rarity: 'rare', itemId: 'name-gold' })).toBe(75);
    expect(duplicateRefund({ rarity: 'legendary', itemId: 'name-aurora' })).toBe(300);
  });
});
