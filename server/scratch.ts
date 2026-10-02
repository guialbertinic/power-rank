import { requireFeature } from './features';
import { badRequest, json, type Env } from './lib';
import { accountByToken } from './players';
import { requireAdult } from './profile';
import { drawCard, drawOutcome, isValidBet, multiplierOf } from '../src/game/scratch';

/** [0, 1) com o gerador criptográfico (Math.random não serve para sorteio com moedas). */
function secureRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

/**
 * POST /api/scratch/buy: { token, bet } → { cells, symbol, multiplier, prize, coins }.
 * Só contas maiores de 18, com a chave `scratch` ligada. O servidor sorteia o resultado e monta a cartela; aposta e
 * prêmio entram no mesmo UPDATE, com a condição de saldo (sem saldo = 402). Raspar é só a revelação na tela.
 */
export async function buyCard(request: Request, env: Env): Promise<Response> {
  const disabled = await requireFeature(env, 'scratch');
  if (disabled) return disabled;
  const body = (await request.json().catch(() => null)) as { token?: unknown; bet?: unknown } | null;
  const account = await accountByToken(env, body?.token);
  if (!account) return json({ error: 'Nick não verificado' }, { status: 401 });
  const notAdult = await requireAdult(env, account.id);
  if (notAdult) return notAdult;
  const bet = body?.bet;
  if (!isValidBet(bet)) return badRequest('Aposta inválida');

  const symbol = drawOutcome(secureRandom);
  const cells = drawCard(symbol, secureRandom);
  const multiplier = multiplierOf(symbol);
  const prize = bet * multiplier;

  const row = await env.DB.prepare(
    'UPDATE players SET coins = coins - ?1 + ?2 WHERE id = ?3 AND coins >= ?1 RETURNING coins',
  )
    .bind(bet, prize, account.id)
    .first<{ coins: number }>();
  if (!row) return json({ error: 'Moedas insuficientes' }, { status: 402 });

  await env.DB.prepare(
    'INSERT INTO scratch_cards (player_id, bet, symbol, multiplier, prize, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(account.id, bet, symbol, multiplier, prize, Date.now())
    .run();

  return json({ cells, symbol, multiplier, prize, coins: row.coins });
}
