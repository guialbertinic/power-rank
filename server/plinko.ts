import { requireFeature } from './features';
import { badRequest, json, type Env } from './lib';
import { accountByToken } from './players';
import { requireAdult } from './profile';
import { drawPath, isRisk, isValidBet, multiplierTenths, prizeFor, slotOf } from '../src/game/plinko';

/** [0, 1) com o gerador criptográfico (Math.random não serve para sorteio com moedas). */
function secureRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

/**
 * POST /api/plinko/drop: { token, bet, risk } → { path, slot, multiplier, prize, coins }.
 * Só contas maiores de 18, com a chave `plinko` ligada. O servidor sorteia o caminho e o prêmio; aposta e prêmio
 * entram no mesmo UPDATE, com a condição de saldo (sem saldo = 402; dois cliques não gastam duas vezes).
 * `multiplier` em décimos (16 = 1,6×).
 */
export async function drop(request: Request, env: Env): Promise<Response> {
  const disabled = await requireFeature(env, 'plinko');
  if (disabled) return disabled;
  const body = (await request.json().catch(() => null)) as { token?: unknown; bet?: unknown; risk?: unknown } | null;
  const account = await accountByToken(env, body?.token);
  if (!account) return json({ error: 'Nick não verificado' }, { status: 401 });
  const notAdult = await requireAdult(env, account.id);
  if (notAdult) return notAdult;
  const { bet, risk } = body ?? {};
  if (!isValidBet(bet)) return badRequest('Aposta inválida');
  if (!isRisk(risk)) return badRequest('Risco inválido');

  const path = drawPath(secureRandom);
  const slot = slotOf(path);
  const multiplier = multiplierTenths(risk, slot);
  const prize = prizeFor(bet, multiplier, secureRandom);

  const row = await env.DB.prepare(
    'UPDATE players SET coins = coins - ?1 + ?2 WHERE id = ?3 AND coins >= ?1 RETURNING coins',
  )
    .bind(bet, prize, account.id)
    .first<{ coins: number }>();
  if (!row) return json({ error: 'Moedas insuficientes' }, { status: 402 });

  await env.DB.prepare(
    'INSERT INTO plinko_drops (player_id, bet, risk, slot, multiplier, prize, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(account.id, bet, risk, slot, multiplier, prize, Date.now())
    .run();

  return json({ path, slot, multiplier, prize, coins: row.coins });
}
