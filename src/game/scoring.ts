export const SLOTS = 10;
export const MAX_SCORE = 1000;

/**
 * Pontuação por posição: cada personagem vale até 100 pontos, conforme a distância (em casas) entre onde o
 * jogador o colocou e onde ele deveria estar. Exato vale 100; cada casa de erro tira pontos, e a 4 casas ou mais
 * não vale nada. Com 10 personagens, o máximo é 1000.
 * Empates de poder cobrem várias posições, e qualquer uma delas conta como exata.
 * Uma ordem aleatória faz ~330 pontos.
 *
 * Funciona com qualquer item que tenha `power`: no servidor, o poder real; no site, o `power` é trocado pela
 * posição relativa que o servidor revela no fim da partida (ver `strengthRanks` / `withRanks`), que dá o mesmo
 * resultado sem expor o valor.
 */

/** Pontos por personagem pela distância até a posição certa (índice = casas de erro; além do fim vale 0). */
export const POINTS_BY_DISTANCE = [100, 70, 40, 15] as const;

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
  /** Casas entre `position` e a faixa `correct` (0 = posição certa). */
  distance: number;
  /** Pontos que este personagem rendeu (0 a 100). */
  points: number;
}

export interface GameResult<T extends Ranked = Ranked> {
  total: number;
  results: SlotResult<T>[];
  /** Os personagens sorteados na ordem correta (mais forte primeiro). */
  correctOrder: T[];
}

export function correctRange(character: Ranked, drawn: readonly Ranked[]): Range {
  const stronger = drawn.filter((c) => c.power > character.power).length;
  const tied = drawn.filter((c) => c.power === character.power).length;
  return { min: stronger + 1, max: stronger + tied };
}

export function pointsForDistance(distance: number): number {
  return POINTS_BY_DISTANCE[distance] ?? 0;
}

/** `slots[i]` é o personagem colocado na posição i + 1. */
export function scoreGame<T extends Ranked>(slots: readonly T[]): GameResult<T> {
  const results = slots.map((character, i) => {
    const position = i + 1;
    const correct = correctRange(character, slots);
    const distance = position < correct.min ? correct.min - position : position > correct.max ? position - correct.max : 0;
    return { position, character, correct, distance, points: pointsForDistance(distance) };
  });

  return {
    total: results.reduce((sum, r) => sum + r.points, 0),
    results,
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
 * Nível do título do resultado (o texto vem da tradução: `rank.<nível>`). Mesmas faixas das moedas
 * (`economy.ts`): uma ordem aleatória faz ~330 pontos, por isso "Tente novamente" começa em 400.
 */
export function rankLevel(total: number): RankLevel {
  if (total >= 850) return 'nerd';
  if (total >= 700) return 'cooking';
  if (total >= 550) return 'brabo';
  if (total >= 400) return 'retry';
  return 'noob';
}
