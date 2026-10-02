import { loadCatalog, type Catalog } from './catalog';
import { badRequest, json, type Env } from './lib';
import { accountByToken } from './players';
import {
  AVATAR_PRICE,
  characterIdOfAvatar,
  cosmeticById,
  type CosmeticSlot,
  type Look,
  type Profile,
} from '../src/game/cosmetics';

interface LookRow {
  avatar: string | null;
  name_color: string | null;
  frame: string | null;
  title: string | null;
  badge: string | null;
}

export const toLook = (row: LookRow | null | undefined): Look => ({
  avatar: row?.avatar ?? null,
  nameColor: row?.name_color ?? null,
  frame: row?.frame ?? null,
  title: row?.title ?? null,
  badge: row?.badge ?? null,
});

/** Visual equipado de uma conta (usado pela party, que precisa dele ao entrar na sala). */
export async function lookOf(env: Env, playerId: number): Promise<Look> {
  const row = await env.DB.prepare('SELECT avatar, name_color, frame, title, badge FROM players WHERE id = ?')
    .bind(playerId)
    .first<LookRow>();
  return toLook(row);
}

/** Soma moedas a uma conta. Devolve o novo saldo. */
export async function creditCoins(env: Env, playerId: number, amount: number): Promise<number | null> {
  const row = await env.DB.prepare('UPDATE players SET coins = coins + ? WHERE id = ? RETURNING coins')
    .bind(amount, playerId)
    .first<{ coins: number }>();
  return row?.coins ?? null;
}

/** Lê { token, ... } das rotas de perfil e acha a conta do token. */
export async function authenticate<T extends object>(request: Request, env: Env): Promise<{ id: number; body: T } | Response> {
  const body = (await request.json().catch(() => null)) as ({ token?: unknown } & T) | null;
  const account = body && (await accountByToken(env, body.token));
  if (!account) return json({ error: 'Nick não verificado' }, { status: 401 });
  return { id: account.id, body: body! };
}

export async function loadProfile(env: Env, playerId: number): Promise<Profile> {
  const [player, items, unseen] = await env.DB.batch([
    env.DB.prepare(
      `SELECT name, coins, avatar, name_color, frame, title, badge, password_hash IS NOT NULL AS has_password,
         adult_confirmed_at IS NOT NULL AS adult,
         (SELECT COUNT(*) FROM player_tokens WHERE player_id = players.id) AS devices
       FROM players WHERE id = ?`,
    ).bind(playerId),
    env.DB.prepare('SELECT item_id FROM player_items WHERE player_id = ? ORDER BY acquired_at').bind(playerId),
    env.DB.prepare(
      'SELECT achievement_id FROM player_achievements WHERE player_id = ? AND seen = 0 ORDER BY unlocked_at',
    ).bind(playerId),
  ]);
  const row = (player.results[0] ?? null) as (LookRow & { name: string; coins: number; has_password: number; adult: number; devices: number }) | null;
  return {
    name: row?.name ?? '',
    coins: row?.coins ?? 0,
    owned: (items.results as { item_id: string }[]).map((r) => r.item_id),
    look: toLook(row),
    hasPassword: Boolean(row?.has_password),
    adult: Boolean(row?.adult),
    devices: row?.devices ?? 0,
    newAchievements: (unseen.results as { achievement_id: string }[]).map((r) => r.achievement_id),
  };
}

/** POST /api/profile: { token } → Profile. */
export async function getProfile(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;
  return json(await loadProfile(env, auth.id));
}

/**
 * POST /api/profile/adult: { token } → Profile. A conta declara ter 18 anos ou mais (libera caça-níquel e Mystery Box).
 * Vale a primeira declaração.
 */
export async function confirmAdult(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;
  await env.DB.prepare('UPDATE players SET adult_confirmed_at = ? WHERE id = ? AND adult_confirmed_at IS NULL')
    .bind(Date.now(), auth.id)
    .run();
  return json(await loadProfile(env, auth.id));
}

/** Caça-níquel e Mystery Box: 403 se a conta ainda não declarou ter 18 anos ou mais; null se pode seguir. */
export async function requireAdult(env: Env, playerId: number): Promise<Response | null> {
  const row = await env.DB.prepare('SELECT adult_confirmed_at IS NOT NULL AS adult FROM players WHERE id = ?')
    .bind(playerId)
    .first<{ adult: number }>();
  if (row?.adult) return null;
  return json({ error: 'Só para maiores de 18 anos.', code: 'adult_required' }, { status: 403 });
}

/** Preço de um item do catálogo (ou de um avatar). null se o item não existe. */
function priceOf(itemId: string, catalog: Catalog): number | null {
  const character = characterIdOfAvatar(itemId);
  if (character !== null) {
    const c = catalog.byId.get(character);
    return c?.image && catalog.active.includes(c) ? AVATAR_PRICE : null;
  }
  const item = cosmeticById(itemId);
  // Exclusivos só saem na Mystery Box; recompensas de conquista, só da conquista.
  return item && !item.exclusive && !item.achievement ? item.price : null;
}

/**
 * POST /api/shop/buy: { token, itemId } → Profile.
 * Primeiro registra o item (INSERT OR IGNORE: se já tem, para aqui) e só então debita, com a condição
 * de saldo suficiente no próprio UPDATE. Assim dois cliques simultâneos não cobram duas vezes.
 */
export async function buyItem(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate<{ itemId?: unknown }>(request, env);
  if (auth instanceof Response) return auth;
  const itemId = auth.body.itemId;
  const price = typeof itemId === 'string' ? priceOf(itemId, await loadCatalog(env)) : null;
  if (typeof itemId !== 'string' || price === null) return badRequest('Item inexistente');

  const added = await env.DB.prepare('INSERT OR IGNORE INTO player_items (player_id, item_id, acquired_at) VALUES (?, ?, ?)')
    .bind(auth.id, itemId, Date.now())
    .run();
  if (!added.meta.changes) return json({ error: 'Você já tem esse item' }, { status: 409 });

  const paid = await env.DB.prepare('UPDATE players SET coins = coins - ? WHERE id = ? AND coins >= ?')
    .bind(price, auth.id, price)
    .run();
  if (!paid.meta.changes) {
    await env.DB.prepare('DELETE FROM player_items WHERE player_id = ? AND item_id = ?').bind(auth.id, itemId).run();
    return json({ error: 'Moedas insuficientes' }, { status: 402 });
  }
  return json(await loadProfile(env, auth.id));
}

const SLOT_COLUMN: Record<CosmeticSlot, string> = {
  avatar: 'avatar',
  nameColor: 'name_color',
  frame: 'frame',
  title: 'title',
  badge: 'badge',
};

/** POST /api/profile/equip: { token, slot, itemId | null } → Profile. Só equipa o que o jogador tem. */
export async function equipItem(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate<{ slot?: unknown; itemId?: unknown }>(request, env);
  if (auth instanceof Response) return auth;
  const { slot, itemId } = auth.body;
  if (typeof slot !== 'string' || !(slot in SLOT_COLUMN)) return badRequest('Espaço inválido');

  let value: string | null = null;
  if (itemId !== null) {
    if (typeof itemId !== 'string') return badRequest('Item inválido');
    const fits = slot === 'avatar' ? characterIdOfAvatar(itemId) !== null : cosmeticById(itemId)?.slot === slot;
    if (!fits) return badRequest('Esse item não vai nesse espaço');
    const owned = await env.DB.prepare('SELECT 1 FROM player_items WHERE player_id = ? AND item_id = ?')
      .bind(auth.id, itemId)
      .first();
    if (!owned) return json({ error: 'Você não tem esse item' }, { status: 403 });
    value = slot === 'avatar' ? characterIdOfAvatar(itemId) : itemId;
  }

  await env.DB.prepare(`UPDATE players SET ${SLOT_COLUMN[slot as CosmeticSlot]} = ? WHERE id = ?`)
    .bind(value, auth.id)
    .run();
  return json(await loadProfile(env, auth.id));
}
