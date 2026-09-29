import { badRequest, json, type Env } from './lib';
import { accountByToken } from './players';
import {
  BET_MAX,
  drawReels,
  evaluate,
  isValidBet,
  potContribution,
  POT_PAYOUT_SHARE,
  SYMBOLS_BY_ID,
  JACKPOT_SYMBOL,
} from '../src/game/casino';

/** [0, 1) com o gerador criptográfico (Math.random não serve para sorteio com moedas). */
function secureRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

interface PotRow {
  amount: number;
  last_prize: number | null;
  last_won_at: number | null;
  winner: string | null;
}

async function loadPot(env: Env) {
  const row = await env.DB.prepare(
    `SELECT c.amount, c.last_prize, c.last_won_at, p.name AS winner
     FROM casino_pot c LEFT JOIN players p ON p.id = c.last_winner_id WHERE c.id = 1`,
  ).first<PotRow>();
  return {
    pot: row?.amount ?? 0,
    lastWinner: row?.winner ? { name: row.winner, prize: row.last_prize ?? 0, at: row.last_won_at ?? 0 } : null,
  };
}

/** GET /api/casino → { pot, lastWinner }: pote acumulado e último ganhador do jackpot (público). */
export async function getCasino(env: Env): Promise<Response> {
  return json(await loadPot(env));
}

/**
 * POST /api/casino/spin: { token, bet } → { reels, outcome, prize, coins, pot, jackpot }.
 * Só contas. Tudo no servidor:
 * 1. Debita a aposta com a condição de saldo no próprio UPDATE (sem saldo = 402; dois cliques não gastam duas vezes).
 *    Sem jackpot, o prêmio já entra nesse mesmo UPDATE (débito e crédito juntos).
 * 2. O pote recebe 5% da aposta. No jackpot, o mesmo UPDATE calcula o prêmio a partir do valor atual do pote
 *    e já o desconta: dois jackpots simultâneos não levam o mesmo pote.
 * 3. Credita o jackpot e registra o giro.
 */
export async function spin(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { token?: unknown; bet?: unknown } | null;
  const account = await accountByToken(env, body?.token);
  if (!account) return json({ error: 'Nick não verificado' }, { status: 401 });
  const bet = body?.bet;
  if (!isValidBet(bet)) return badRequest('Aposta inválida');

  const reels = drawReels(secureRandom);
  const outcome = evaluate(reels);
  const isJackpot = outcome.kind === 'jackpot';
  const fixedPrize = outcome.kind === 'three' || outcome.kind === 'pair' ? bet * outcome.multiplier : 0;
  const now = Date.now();

  const debited = await env.DB.prepare(
    'UPDATE players SET coins = coins - ?1 + ?2 WHERE id = ?3 AND coins >= ?1 RETURNING coins',
  )
    .bind(bet, fixedPrize, account.id)
    .first<{ coins: number }>();
  if (!debited) return json({ error: 'Moedas insuficientes' }, { status: 402 });

  let prize = fixedPrize;
  let coins = debited.coins;
  let pot: number;

  if (isJackpot) {
    // Todos os SET usam o valor antigo de `amount`: o prêmio é calculado e descontado na mesma operação.
    const share = `CAST(amount * ${POT_PAYOUT_SHARE} * ${bet / BET_MAX} AS INTEGER)`;
    const minimum = bet * SYMBOLS_BY_ID.get(JACKPOT_SYMBOL)!.three;
    const won = await env.DB.prepare(
      `UPDATE casino_pot SET
         last_prize = MAX(?1, ${share}),
         amount = amount - ${share} + ?2,
         last_winner_id = ?3,
         last_won_at = ?4
       WHERE id = 1 RETURNING last_prize, amount`,
    )
      .bind(minimum, potContribution(bet), account.id, now)
      .first<{ last_prize: number; amount: number }>();
    prize = won?.last_prize ?? minimum;
    pot = won?.amount ?? 0;
    const credited = await env.DB.prepare('UPDATE players SET coins = coins + ? WHERE id = ? RETURNING coins')
      .bind(prize, account.id)
      .first<{ coins: number }>();
    coins = credited?.coins ?? coins + prize;
  } else {
    const row = await env.DB.prepare('UPDATE casino_pot SET amount = amount + ? WHERE id = 1 RETURNING amount')
      .bind(potContribution(bet))
      .first<{ amount: number }>();
    pot = row?.amount ?? 0;
  }

  await env.DB.prepare(
    'INSERT INTO casino_spins (player_id, bet, reels, prize, jackpot, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(account.id, bet, JSON.stringify(reels), prize, isJackpot ? 1 : 0, now)
    .run();

  return json({ reels, outcome, prize, coins, pot, jackpot: isJackpot });
}
