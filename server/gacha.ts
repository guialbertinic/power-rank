import { loadCatalog } from './catalog';
import { json, type Env } from './lib';
import { accountByToken } from './players';
import { loadProfile, requireAdult } from './profile';
import { BOX_PRICE, drawBox, duplicateRefund } from '../src/game/gacha';

const secureRandom = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

/**
 * POST /api/gacha/open: { token } → { rarity, itemId, duplicate, refund, profile }.
 * Só contas. O sorteio é no servidor:
 * 1. Debita o preço da caixa com a condição de saldo no próprio UPDATE (sem saldo = 402).
 * 2. Registra o item com INSERT OR IGNORE: se não inseriu, já era seu (repetido) e devolve moedas.
 * 3. Grava a abertura no histórico e devolve o perfil atualizado (saldo, itens).
 */
export async function openBox(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const account = await accountByToken(env, body?.token);
  if (!account) return json({ error: 'Nick não verificado' }, { status: 401 });
  const notAdult = await requireAdult(env, account.id);
  if (notAdult) return notAdult;

  const paid = await env.DB.prepare('UPDATE players SET coins = coins - ?1 WHERE id = ?2 AND coins >= ?1')
    .bind(BOX_PRICE, account.id)
    .run();
  if (!paid.meta.changes) return json({ error: 'Moedas insuficientes' }, { status: 402 });

  // Personagens que podem sair como avatar: os mesmos da loja (ativos, com imagem).
  const avatarIds = (await loadCatalog(env)).active.filter((c) => c.image).map((c) => c.id);
  const draw = drawBox(secureRandom, avatarIds);
  const now = Date.now();
  const added = await env.DB.prepare('INSERT OR IGNORE INTO player_items (player_id, item_id, acquired_at) VALUES (?, ?, ?)')
    .bind(account.id, draw.itemId, now)
    .run();
  const duplicate = !added.meta.changes;
  const refund = duplicate ? duplicateRefund(draw) : 0;

  await env.DB.batch([
    ...(refund ? [env.DB.prepare('UPDATE players SET coins = coins + ? WHERE id = ?').bind(refund, account.id)] : []),
    env.DB.prepare(
      'INSERT INTO gacha_openings (player_id, rarity, item_id, duplicate, refund, price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(account.id, draw.rarity, draw.itemId, duplicate ? 1 : 0, refund, BOX_PRICE, now),
  ]);

  return json({ ...draw, duplicate, refund, profile: await loadProfile(env, account.id) });
}
