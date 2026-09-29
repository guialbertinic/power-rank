/**
 * Cassino (caça-níquel) — regras compartilhadas entre o servidor (sorteio, prêmio) e a tela (tabela, "?").
 * O sorteio acontece só no servidor; a tela só anima o resultado que ele devolve.
 *
 * Calibração (ver casino.test.ts): a tabela fixa, com o pote no prêmio mínimo, devolve ~90% do apostado;
 * os 5% de cada aposta que vão para o pote voltam aos jogadores nos jackpots → ~95% no longo prazo.
 */

export type SymbolId = 'dragonball' | 'sharingan' | 'deathnote' | 'bandana' | 'hat' | 'shuriken' | 'pokeball';

export interface CasinoSymbol {
  id: SymbolId;
  label: string;
  /** Peso no sorteio (igual nos 3 rolos): quanto maior, mais comum. */
  weight: number;
  /** 3 iguais: multiplicador da aposta (Esfera do Dragão = jackpot, com este valor como prêmio mínimo). */
  three: number;
  /** 2 iguais (em qualquer posição): multiplicador da aposta. */
  pair: number;
}

/** Do mais raro ao mais comum. */
export const SYMBOLS: CasinoSymbol[] = [
  { id: 'dragonball', label: 'Esfera do Dragão', weight: 6, three: 100, pair: 5 },
  { id: 'sharingan', label: 'Sharingan', weight: 8, three: 60, pair: 3 },
  { id: 'deathnote', label: 'Death Note', weight: 10, three: 30, pair: 2 },
  { id: 'bandana', label: 'Bandana da Folha', weight: 13, three: 20, pair: 2 },
  { id: 'hat', label: 'Chapéu de palha', weight: 16, three: 12, pair: 1 },
  { id: 'shuriken', label: 'Shuriken', weight: 20, three: 8, pair: 1 },
  { id: 'pokeball', label: 'Pokébola', weight: 27, three: 5, pair: 1 },
];

export const SYMBOLS_BY_ID = new Map(SYMBOLS.map((s) => [s.id, s]));
export const JACKPOT_SYMBOL: SymbolId = 'dragonball';

export const BET_MIN = 10;
export const BET_MAX = 100;
export const BET_STEP = 10;
/** Parte de cada aposta que vai para o pote acumulado. */
export const POT_CONTRIBUTION = 0.05;
/** O jackpot paga esta fração do pote para quem aposta o máximo (proporcional à aposta: 10 = 10% disso). */
export const POT_PAYOUT_SHARE = 0.5;
/** Valor inicial do pote (migração 0010). */
export const POT_SEED = 5000;

export const isValidBet = (bet: unknown): bet is number =>
  typeof bet === 'number' && Number.isInteger(bet) && bet >= BET_MIN && bet <= BET_MAX && bet % BET_STEP === 0;

/** Moedas da aposta que vão para o pote (arredondado; 10 → 1). */
export const potContribution = (bet: number) => Math.round(bet * POT_CONTRIBUTION);

/** Parte do pote que o jackpot leva com esta aposta. */
export const potShare = (bet: number, pot: number) => Math.floor(pot * POT_PAYOUT_SHARE * (bet / BET_MAX));

/** Prêmio do jackpot: o maior entre o mínimo (100× a aposta) e a parte do pote. */
export const jackpotPrize = (bet: number, pot: number) =>
  Math.max(bet * SYMBOLS_BY_ID.get(JACKPOT_SYMBOL)!.three, potShare(bet, pot));

export type Outcome =
  | { kind: 'jackpot' }
  | { kind: 'three' | 'pair'; symbol: SymbolId; multiplier: number }
  | { kind: 'none' };

/** Resultado dos 3 rolos (sem o valor do jackpot, que depende do pote). */
export function evaluate(reels: SymbolId[]): Outcome {
  const [a, b, c] = reels;
  if (a === b && b === c) {
    if (a === JACKPOT_SYMBOL) return { kind: 'jackpot' };
    return { kind: 'three', symbol: a, multiplier: SYMBOLS_BY_ID.get(a)!.three };
  }
  const paired = a === b || a === c ? a : b === c ? b : null;
  if (paired) return { kind: 'pair', symbol: paired, multiplier: SYMBOLS_BY_ID.get(paired)!.pair };
  return { kind: 'none' };
}

const TOTAL_WEIGHT = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);

/** Sorteia os 3 rolos. `random` devolve [0, 1) — no servidor, a partir do crypto.getRandomValues. */
export function drawReels(random: () => number): SymbolId[] {
  return [0, 1, 2].map(() => {
    let roll = random() * TOTAL_WEIGHT;
    for (const s of SYMBOLS) {
      roll -= s.weight;
      if (roll < 0) return s.id;
    }
    return SYMBOLS[SYMBOLS.length - 1].id;
  });
}

/** Chance (0–1) de cada símbolo num rolo. */
export const symbolChance = (id: SymbolId) => SYMBOLS_BY_ID.get(id)!.weight / TOTAL_WEIGHT;
