export const SLOTS = 10;
export const MAX_SCORE = 1000;

/**
 * Pontuação por ordem entre pares: para cada par de personagens, o que o jogador colocou mais acima
 * precisa ser pelo menos tão forte quanto o outro. Com 10 personagens são 45 pares.
 * Acertar a ordem relativa vale mesmo com as posições absolutas deslocadas.
 * Pares com o mesmo poder contam sempre como certos.
 *
 * Funciona com qualquer item que tenha `power`: no servidor, o poder real; no site, o `power` é trocado pela
 * posição relativa que o servidor revela no fim da partida (ver `strengthRanks` / `withRanks`), que dá o mesmo
 * resultado sem expor o valor.
 */

interface Ranked {
  id: string;
  power: number;
}

/** Posições (1-based) aceitas como corretas; empates de poder cobrem várias posições. */
export type Range = { min: number; max: number };

export interface SlotResult<T extends Ranked = Ranked> {
  position: number;
  character: T;
  /** Onde o personagem deveria estar (usado só como dica no resultado). */
  correct: Range;
  /** Pares envolvendo este personagem com a ordem certa, de `pairsTotal`. */
  pairsRight: number;
  pairsTotal: number;
}

export interface GameResult<T extends Ranked = Ranked> {
  total: number;
  pairsRight: number;
  pairsTotal: number;
  results: SlotResult<T>[];
  /** Os personagens sorteados na ordem correta (mais forte primeiro). */
  correctOrder: T[];
}

export function correctRange(character: Ranked, drawn: readonly Ranked[]): Range {
  const stronger = drawn.filter((c) => c.power > character.power).length;
  const tied = drawn.filter((c) => c.power === character.power).length;
  return { min: stronger + 1, max: stronger + tied };
}

/** `slots[i]` é o personagem colocado na posição i + 1. */
export function scoreGame<T extends Ranked>(slots: readonly T[]): GameResult<T> {
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

/**
 * Posição relativa de cada sorteado: quantos são mais fortes que ele (empates têm o mesmo número).
 * É o que o servidor revela ao site no fim da partida — a ordem, nunca o valor de `power`.
 */
export function strengthRanks(drawn: readonly Ranked[]): Record<string, number> {
  return Object.fromEntries(drawn.map((c) => [c.id, drawn.filter((o) => o.power > c.power).length]));
}

/** No site: monta itens pontuáveis a partir das posições relativas (mais forte = menor número = maior "power"). */
export function withRanks<T extends { id: string }>(items: readonly T[], ranks: Record<string, number>): (T & Ranked)[] {
  return items.map((item) => ({ ...item, power: -(ranks[item.id] ?? 0) }));
}

export type RankLevel = 'nerd' | 'cooking' | 'brabo' | 'retry' | 'noob';

/**
 * Nível do título do resultado (o texto vem da tradução: `rank.<nível>`). Uma ordem aleatória acerta ~50% dos
 * pares (~500 pontos), por isso os títulos começam acima disso.
 */
export function rankLevel(total: number): RankLevel {
  if (total >= 950) return 'nerd';
  if (total >= 850) return 'cooking';
  if (total >= 750) return 'brabo';
  if (total >= 600) return 'retry';
  return 'noob';
}
