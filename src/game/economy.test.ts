import { describe, expect, it } from 'vitest';
import { coinsForScore, podiumBonus } from './economy';

describe('coinsForScore', () => {
  it('pays nothing below 400 (random guessing makes ~330)', () => {
    expect(coinsForScore(0)).toBe(0);
    expect(coinsForScore(399)).toBe(0);
  });

  it('pays by score band', () => {
    expect(coinsForScore(400)).toBe(5);
    expect(coinsForScore(549)).toBe(5);
    expect(coinsForScore(550)).toBe(15);
    expect(coinsForScore(700)).toBe(35);
    expect(coinsForScore(849)).toBe(35);
    expect(coinsForScore(850)).toBe(60);
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
