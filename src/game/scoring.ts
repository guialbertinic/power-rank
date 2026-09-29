import type { Character } from './types';

export const SLOTS = 10;
export const MAX_SCORE = 1000;

/**
 * Pontuação por ordem entre pares: para cada par de personagens, o que o jogador colocou mais acima
 * precisa ser pelo menos tão forte quanto o outro. Com 10 personagens são 45 pares.
 * Acertar a ordem relativa vale mesmo com as posições absolutas deslocadas.
 * Pares com o mesmo poder contam sempre como certos.
 */

/** Posições (1-based) aceitas como corretas; empates de poder cobrem várias posições. */
export type Range = { min: number; max: number };

export interface SlotResult {
  position: number;
  character: Character;
  /** Onde o personagem deveria estar (usado só como dica no resultado). */
  correct: Range;
  /** Pares envolvendo este personagem com a ordem certa, de `pairsTotal`. */
  pairsRight: number;
  pairsTotal: number;
}

export interface GameResult {
  total: number;
  pairsRight: number;
  pairsTotal: number;
  results: SlotResult[];
  /** Os personagens sorteados na ordem correta (mais forte primeiro). */
  correctOrder: Character[];
}

export function correctRange(character: Character, drawn: readonly Character[]): Range {
  const stronger = drawn.filter((c) => c.power > character.power).length;
  const tied = drawn.filter((c) => c.power === character.power).length;
  return { min: stronger + 1, max: stronger + tied };
}

/** `slots[i]` é o personagem colocado na posição i + 1. */
export function scoreGame(slots: readonly Character[]): GameResult {
  const right = slots.map(() => 0);
  let pairsRight = 0;
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      if (slots[i].power >= slots[j].power) {
        pairsRight++;
        right[i]++;
        right[j]++;
      }
    }
  }
  const pairsTotal = (slots.length * (slots.length - 1)) / 2;

  return {
    total: pairsTotal ? Math.round((MAX_SCORE * pairsRight) / pairsTotal) : 0,
    pairsRight,
    pairsTotal,
    results: slots.map((character, i) => ({
      position: i + 1,
      character,
      correct: correctRange(character, slots),
      pairsRight: right[i],
      pairsTotal: slots.length - 1,
    })),
    correctOrder: [...slots].sort((a, b) => b.power - a.power),
  };
}

/** Uma ordem aleatória acerta ~50% dos pares (~500 pontos), por isso os títulos começam acima disso. */
export function rankTitle(total: number): string {
  if (total >= 950) return 'Nerd esquisito';
  if (total >= 850) return 'Tá cozinhando chefe';
  if (total >= 750) return 'Brabo';
  if (total >= 600) return 'Tente novamente';
  return 'Kk Noob';
}
