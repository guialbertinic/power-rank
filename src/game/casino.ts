/**
 * Cassino (caça-níquel) — regras compartilhadas entre o servidor (sorteio, prêmio) e a tela (tabela, "?").
 * O sorteio acontece só no servidor; a tela só anima o resultado que ele devolve.
 *
 * Calibração (ver casino.test.ts): a tabela fixa, com o pote no prêmio mínimo, devolve ~90% do apostado;
 * os 5% de cada aposta que vão para o pote voltam aos jogadores nos jackpots → ~95% no longo prazo.
 */

/** Símbolos da máquina do Game Corner de Pokémon (public/cassino/<id>.webp), do melhor para o pior. */
export type SymbolId = 'seven' | 'galactic' | 'replay' | 'cherry' | 'pikachu' | 'moonstone';

export interface CasinoSymbol {
  id: SymbolId;
  label: string;
  /** Peso no sorteio (igual nos 3 rolos): quanto maior, mais comum. */
  weight: number;
  /** 3 iguais: multiplicador da aposta (o 7 = jackpot, com este valor como prêmio mínimo). */
  three: number;
  /** 2 iguais (em qualquer posição): multiplicador da aposta (0 = par não paga). */
  pair: number;
}

/** Do mais raro ao mais comum. */
export const SYMBOLS: CasinoSymbol[] = [
  { id: 'seven', label: '7', weight: 6, three: 100, pair: 5 },
  { id: 'galactic', label: 'Galáctico', weight: 9, three: 60, pair: 3 },
  { id: 'replay', label: 'Replay', weight: 12, three: 30, pair: 2 },
  { id: 'cherry', label: 'Cerejas', weight: 16, three: 18, pair: 1 },
  { id: 'pikachu', label: 'Pikachu', weight: 24, three: 10, pair: 1 },
  { id: 'moonstone', label: 'Pedra da Lua', weight: 33, three: 5, pair: 0 },
];

export const SYMBOLS_BY_ID = new Map(SYMBOLS.map((s) => [s.id, s]));
export const JACKPOT_SYMBOL: SymbolId = 'seven';

/** Apostas de 1 a 10 moedas (uma partida rende de 5 a 60: a aposta tem que caber nesse ganho). */
export const BET_MIN = 1;
export const BET_MAX = 10;
export const BET_STEP = 1;
/** Parte de cada aposta que vai para o pote acumulado. */
export const POT_CONTRIBUTION = 0.05;
/** O jackpot paga esta fração do pote para quem aposta o máximo (proporcional à aposta: 1 = 10% disso). */
export const POT_PAYOUT_SHARE = 0.5;
/** O pote é guardado em centésimos de moeda: 5% de uma aposta de 1 (0,05) não se perde no arredondamento. */
export const POT_CENTS = 100;

export const isValidBet = (bet: unknown): bet is number =>
  typeof bet === 'number' && Number.isInteger(bet) && bet >= BET_MIN && bet <= BET_MAX && bet % BET_STEP === 0;

/** Centésimos de moeda que a aposta põe no pote (5%: aposta 1 → 5, aposta 10 → 50). */
export const potContributionCents = (bet: number) => Math.round(bet * POT_CONTRIBUTION * POT_CENTS);

/** Parte do pote (em moedas) que o jackpot leva com esta aposta. */
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
  const pairPays = paired ? SYMBOLS_BY_ID.get(paired)!.pair : 0;
  if (paired && pairPays > 0) return { kind: 'pair', symbol: paired, multiplier: pairPays };
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
