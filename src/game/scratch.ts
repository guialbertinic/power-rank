/**
 * Raspadinha — regras compartilhadas entre o servidor (sorteio, cartela, prêmio) e a tela (tabela do "?").
 * Cartela 3×3 com os símbolos dos tiers (os mesmos do caça-níquel). Três iguais = prêmio daquele tier.
 * O servidor sorteia primeiro o resultado (qual trio, ou nenhum) e depois monta uma cartela coerente com ele:
 * no máximo um trio por cartela, e os outros símbolos aparecem no máximo duas vezes.
 * A tela só revela a cartela que o servidor devolve; as moedas já foram acertadas na compra.
 *
 * Calibração (ver scratch.test.ts): devolve exatamente 95% do apostado.
 */
import type { SymbolId } from './casino';

export const CELLS = 9;
/** Quantas vezes o símbolo precisa aparecer para pagar. */
export const MATCH = 3;

export interface ScratchPrize {
  id: SymbolId;
  /** Multiplicador da aposta. */
  multiplier: number;
  /** Chance em 1/10.000 de a cartela ter esse trio. */
  weight: number;
}

/** Do mais raro ao mais comum. As chances que sobram (77%) são cartelas sem trio. */
export const PRIZES: ScratchPrize[] = [
  { id: 'ss', multiplier: 100, weight: 20 },
  { id: 's', multiplier: 25, weight: 80 },
  { id: 'a', multiplier: 10, weight: 200 },
  { id: 'b', multiplier: 3, weight: 500 },
  { id: 'c', multiplier: 2, weight: 500 },
  { id: 'd', multiplier: 1, weight: 1000 },
];

export const WEIGHT_TOTAL = 10_000;
export const SYMBOL_IDS: SymbolId[] = PRIZES.map((p) => p.id);
const PRIZE_BY_ID = new Map(PRIZES.map((p) => [p.id, p]));

/** Multiplicador de um trio (0 = sem trio). */
export const multiplierOf = (symbol: SymbolId | null) => (symbol ? (PRIZE_BY_ID.get(symbol)?.multiplier ?? 0) : 0);

/** Apostas de 1 a 10 moedas, como no caça-níquel. */
export const BET_MIN = 1;
export const BET_MAX = 10;

export const isValidBet = (bet: unknown): bet is number =>
  typeof bet === 'number' && Number.isInteger(bet) && bet >= BET_MIN && bet <= BET_MAX;

/** Sorteia o resultado: o símbolo do trio ou null (sem prêmio). `random` devolve [0, 1). */
export function drawOutcome(random: () => number): SymbolId | null {
  let roll = Math.floor(random() * WEIGHT_TOTAL);
  for (const prize of PRIZES) {
    if (roll < prize.weight) return prize.id;
    roll -= prize.weight;
  }
  return null;
}

/**
 * Monta a cartela de um resultado: o trio (se houver) mais casas tiradas de um "saco" com duas fichas de cada outro
 * símbolo, embaralhadas. Assim nenhum outro símbolo chega a três, e quase-vitórias (dois SS) aparecem naturalmente.
 */
export function drawCard(outcome: SymbolId | null, random: () => number): SymbolId[] {
  const bag = SYMBOL_IDS.filter((id) => id !== outcome).flatMap((id) => [id, id]);
  const cells: SymbolId[] = outcome ? [outcome, outcome, outcome] : [];
  while (cells.length < CELLS) cells.push(bag.splice(Math.floor(random() * bag.length), 1)[0]);
  // Fisher-Yates: o trio pode cair em qualquer casa.
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells;
}

/** O símbolo que aparece três vezes na cartela (null = nenhum). */
export function winnerOf(cells: SymbolId[]): SymbolId | null {
  return SYMBOL_IDS.find((id) => cells.filter((c) => c === id).length >= MATCH) ?? null;
}
