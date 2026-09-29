import type { Character } from './types';

export const SLOTS = 10;

/** Pontos pela distância entre a posição escolhida e a correta. */
export const POINTS_BY_DISTANCE = [100, 60, 30, 10];
export const MAX_SCORE = SLOTS * POINTS_BY_DISTANCE[0];

/** Posições (1-based) aceitas como corretas; empates de poder cobrem várias posições. */
export type Range = { min: number; max: number };

export interface SlotResult {
  position: number;
  character: Character;
  correct: Range;
  distance: number;
  points: number;
}

export interface GameResult {
  total: number;
  results: SlotResult[];
  /** Os personagens sorteados na ordem correta (mais forte primeiro). */
  correctOrder: Character[];
}

export function correctRange(character: Character, drawn: readonly Character[]): Range {
  const stronger = drawn.filter((c) => c.power > character.power).length;
  const tied = drawn.filter((c) => c.power === character.power).length;
  return { min: stronger + 1, max: stronger + tied };
}

export function distanceTo(position: number, range: Range): number {
  if (position < range.min) return range.min - position;
  if (position > range.max) return position - range.max;
  return 0;
}

export function pointsFor(distance: number): number {
  return POINTS_BY_DISTANCE[distance] ?? 0;
}

/** `slots[i]` é o personagem colocado na posição i + 1. */
export function scoreGame(slots: readonly Character[]): GameResult {
  const results = slots.map((character, i) => {
    const position = i + 1;
    const correct = correctRange(character, slots);
    const distance = distanceTo(position, correct);
    return { position, character, correct, distance, points: pointsFor(distance) };
  });
  return {
    total: results.reduce((sum, r) => sum + r.points, 0),
    results,
    correctOrder: [...slots].sort((a, b) => b.power - a.power),
  };
}

export function rankTitle(total: number): string {
  if (total >= 900) return 'Lendário';
  if (total >= 700) return 'Mestre do Power Scaling';
  if (total >= 500) return 'Veterano';
  if (total >= 300) return 'Aprendiz';
  return 'Só viu o trailer';
}
