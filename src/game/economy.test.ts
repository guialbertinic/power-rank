import { describe, expect, it } from 'vitest';
import { coinsForScore, podiumBonus } from './economy';

describe('coinsForScore', () => {
  it('pays nothing below 500 (random guessing)', () => {
    expect(coinsForScore(0)).toBe(0);
    expect(coinsForScore(499)).toBe(0);
  });

  it('pays by score band', () => {
    expect(coinsForScore(500)).toBe(5);
    expect(coinsForScore(600)).toBe(10);
    expect(coinsForScore(750)).toBe(20);
    expect(coinsForScore(850)).toBe(35);
    expect(coinsForScore(949)).toBe(35);
    expect(coinsForScore(950)).toBe(60);
    expect(coinsForScore(1000)).toBe(60);
  });
});

describe('podiumBonus', () => {
  it('rewards the top 3 when at least 2 players finished', () => {
    expect([1, 2, 3, 4].map((place) => podiumBonus(place, 4, 800))).toEqual([20, 10, 5, 0]);
  });

  it('pays nothing when playing alone', () => {
    expect(podiumBonus(1, 1, 1000)).toBe(0);
  });

  it('pays nothing below the minimum score (no farming with guesses)', () => {
    expect(podiumBonus(2, 2, 22)).toBe(0);
  });
});
