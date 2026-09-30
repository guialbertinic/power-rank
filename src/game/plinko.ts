/**
 * Plinko — regras compartilhadas entre o servidor (sorteio, prêmio) e a tela (tabuleiro, tabela do "?").
 * A bolinha cai por ROWS fileiras de pinos; em cada uma vai para a esquerda ou a direita (50/50). A casa final é o
 * número de "direitas" (0 … ROWS), então as casas do meio são as mais comuns e as das pontas, as mais raras.
 * O sorteio acontece só no servidor; a tela só anima o caminho que ele devolve.
 *
 * Calibração (ver plinko.test.ts): cada nível de risco devolve ~95% do apostado (como o caça-níquel com o pote).
 */

export const ROWS = 12;
export const SLOTS = ROWS + 1;

export type Risk = 'low' | 'medium' | 'high';
export const RISKS: Risk[] = ['low', 'medium', 'high'];

/**
 * Multiplicadores em décimos (15 = 1,5×), da ponta até o meio (7 valores; o tabuleiro é simétrico).
 * Risco maior = pontas muito melhores e meio pior.
 */
const HALF_TENTHS: Record<Risk, number[]> = {
  low: [80, 30, 16, 14, 11, 9, 5],
  medium: [260, 90, 36, 20, 12, 5, 3],
  high: [1300, 220, 70, 22, 7, 2, 2],
};

/** Distância da casa até a do meio: 0 no meio, ROWS/2 nas pontas. */
export const distanceFromCenter = (slot: number) => Math.abs(slot - ROWS / 2);

/** Multiplicador (em décimos) de uma casa. */
export const multiplierTenths = (risk: Risk, slot: number) => HALF_TENTHS[risk][ROWS / 2 - distanceFromCenter(slot)];

/** Todas as casas, da esquerda para a direita, em décimos. */
export const multipliersOf = (risk: Risk) => Array.from({ length: SLOTS }, (_, slot) => multiplierTenths(risk, slot));

/** Texto do multiplicador ("1,6×" / "1.6×"; inteiros sem decimal). */
export const multiplierText = (tenths: number, decimal: string) =>
  `${tenths % 10 === 0 ? tenths / 10 : (tenths / 10).toFixed(1).replace('.', decimal)}×`;

export const isRisk = (risk: unknown): risk is Risk => RISKS.includes(risk as Risk);

/** Apostas de 1 a 10 moedas, como no caça-níquel. */
export const BET_MIN = 1;
export const BET_MAX = 10;

export const isValidBet = (bet: unknown): bet is number =>
  typeof bet === 'number' && Number.isInteger(bet) && bet >= BET_MIN && bet <= BET_MAX;

/** Caminho da bolinha: uma direção por fileira (0 = esquerda, 1 = direita). `random` devolve [0, 1). */
export function drawPath(random: () => number): (0 | 1)[] {
  return Array.from({ length: ROWS }, () => (random() < 0.5 ? 0 : 1));
}

/** Casa em que o caminho termina (número de "direitas"). */
export const slotOf = (path: (0 | 1)[]) => path.reduce<number>((sum, step) => sum + step, 0);

/** Chance (0–1) de cair numa casa: C(ROWS, slot) / 2^ROWS. */
export function slotChance(slot: number): number {
  let c = 1;
  for (let i = 1; i <= slot; i++) c = (c * (ROWS - i + 1)) / i;
  return c / 2 ** ROWS;
}

/**
 * Prêmio em moedas inteiras. Aposta × multiplicador pode dar fração (1 × 1,6 = 1,6): a parte inteira é garantida e a
 * fração vira uma moeda a mais com essa chance (1,6 → 2 moedas em 60% das vezes). Assim o retorno médio é o mesmo
 * para qualquer aposta.
 */
export function prizeFor(bet: number, tenths: number, random: () => number): number {
  const total = bet * tenths;
  const whole = Math.floor(total / 10);
  return whole + (random() * 10 < total % 10 ? 1 : 0);
}
