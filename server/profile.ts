import { badRequest, CHARACTERS_BY_ID, json, nameKey, sanitizeName, type Env } from './lib';
import { verifyPlayer } from './players';
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
}

export const toLook = (row: LookRow | null | undefined): Look => ({
  avatar: row?.avatar ?? null,
  nameColor: row?.name_color ?? null,
  frame: row?.frame ?? null,
});

/** Visual equipado de um jogador (usado pela party, que precisa dele ao entrar na sala). */
export async function lookOf(env: Env, name: string): Promise<Look> {
  const row = await env.DB.prepare('SELECT avatar, name_color, frame FROM players WHERE name_key = ?')
    .bind(nameKey(name))
    .first<LookRow>();
  return toLook(row);
}

/** Soma moedas ao jogador (nick com dono). Devolve o novo saldo, ou null se o nick não tiver dono. */
export async function creditCoins(env: Env, name: string, amount: number): Promise<number | null> {
  const row = await env.DB.prepare('UPDATE players SET coins = coins + ? WHERE name_key = ? RETURNING coins')
    .bind(amount, nameKey(name))
    .first<{ coins: number }>();
  return row?.coins ?? null;
}

/** Lê e valida { name, token, ... } das rotas de perfil. */
async function authenticate<T extends object>(
  request: Request,
  env: Env,
): Promise<{ name: string; key: string; body: T } | Response> {
  const body = (await request.json().catch(() => null)) as ({ name?: unknown; token?: unknown } & T) | null;
  const name = sanitizeName(body?.name);
  if (!body || !name || !(await verifyPlayer(env, name, body.token))) {
    return json({ error: 'Nick não verificado' }, { status: 401 });
  }
  return { name, key: nameKey(name), body };
}

async function loadProfile(env: Env, key: string): Promise<Profile> {
  const [player, items] = await env.DB.batch([
    env.DB.prepare('SELECT coins, avatar, name_color, frame FROM players WHERE name_key = ?').bind(key),
    env.DB.prepare('SELECT item_id FROM player_items WHERE name_key = ? ORDER BY acquired_at').bind(key),
  ]);
  const row = (player.results[0] ?? null) as (LookRow & { coins: number }) | null;
  return {
    coins: row?.coins ?? 0,
    owned: (items.results as { item_id: string }[]).map((r) => r.item_id),
    look: toLook(row),
  };
}

/** POST /api/profile: { name, token } → Profile. */
export async function getProfile(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;
  return json(await loadProfile(env, auth.key));
}

/** Preço de um item do catálogo (ou de um avatar). null se o item não existe. */
function priceOf(itemId: string): number | null {
  const character = characterIdOfAvatar(itemId);
  if (character !== null) return CHARACTERS_BY_ID.get(character)?.image ? AVATAR_PRICE : null;
  return cosmeticById(itemId)?.price ?? null;
}

/**
 * POST /api/shop/buy: { name, token, itemId } → Profile.
 * Primeiro registra o item (INSERT OR IGNORE: se já tem, para aqui) e só então debita, com a condição
 * de saldo suficiente no próprio UPDATE. Assim dois cliques simultâneos não cobram duas vezes.
 */
export async function buyItem(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate<{ itemId?: unknown }>(request, env);
  if (auth instanceof Response) return auth;
  const itemId = auth.body.itemId;
  const price = typeof itemId === 'string' ? priceOf(itemId) : null;
  if (typeof itemId !== 'string' || price === null) return badRequest('Item inexistente');

  const added = await env.DB.prepare('INSERT OR IGNORE INTO player_items (name_key, item_id, acquired_at) VALUES (?, ?, ?)')
    .bind(auth.key, itemId, Date.now())
    .run();
  if (!added.meta.changes) return json({ error: 'Você já tem esse item' }, { status: 409 });

  const paid = await env.DB.prepare('UPDATE players SET coins = coins - ? WHERE name_key = ? AND coins >= ?')
    .bind(price, auth.key, price)
    .run();
  if (!paid.meta.changes) {
    await env.DB.prepare('DELETE FROM player_items WHERE name_key = ? AND item_id = ?').bind(auth.key, itemId).run();
    return json({ error: 'Moedas insuficientes' }, { status: 402 });
  }
  return json(await loadProfile(env, auth.key));
}

const SLOT_COLUMN: Record<CosmeticSlot, string> = { avatar: 'avatar', nameColor: 'name_color', frame: 'frame' };

/** POST /api/profile/equip: { name, token, slot, itemId | null } → Profile. Só equipa o que o jogador tem. */
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
    const owned = await env.DB.prepare('SELECT 1 FROM player_items WHERE name_key = ? AND item_id = ?')
      .bind(auth.key, itemId)
      .first();
    if (!owned) return json({ error: 'Você não tem esse item' }, { status: 403 });
    value = slot === 'avatar' ? characterIdOfAvatar(itemId) : itemId;
  }

  await env.DB.prepare(`UPDATE players SET ${SLOT_COLUMN[slot as CosmeticSlot]} = ? WHERE name_key = ?`)
    .bind(value, auth.key)
    .run();
  return json(await loadProfile(env, auth.key));
}
