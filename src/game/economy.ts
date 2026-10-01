/**
 * Moedas ganhas por partida. Calculadas no servidor a partir da pontuação (que também é do servidor).
 * Abaixo de 400 (chutando, uma ordem aleatória faz ~330) não paga nada, para não compensar spam.
 */
export const MIN_SCORE_FOR_COINS = 400;

const COINS_BY_SCORE: { min: number; coins: number }[] = [
  { min: 850, coins: 60 },
  { min: 700, coins: 35 },
  { min: 550, coins: 15 },
  { min: MIN_SCORE_FOR_COINS, coins: 5 },
];

export function coinsForScore(score: number): number {
  return COINS_BY_SCORE.find((tier) => score >= tier.min)?.coins ?? 0;
}

/**
 * Bônus de pódio na party (1º, 2º, 3º). Só vale com pelo menos 2 jogadores que terminaram e para quem fez o
 * mínimo de pontos — senão duas contas chutando numa sala ganhariam moedas sem jogar de verdade.
 */
const PODIUM_BONUS = [20, 10, 5];
export const PODIUM_BONUS_MIN_PLAYERS = 2;

export function podiumBonus(place: number, finishedPlayers: number, score: number): number {
  if (finishedPlayers < PODIUM_BONUS_MIN_PLAYERS || score < MIN_SCORE_FOR_COINS) return 0;
  return PODIUM_BONUS[place - 1] ?? 0;
}
