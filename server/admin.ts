import { verifyAccessJwt, type AccessJwk } from './accessJwt';
import { clearCatalogCache } from './catalog';
import { badRequest, json, nameKey, sanitizeName, type Env } from './lib';
import { hashPassword } from './players';
import { isLocalRequest } from './security';
import { BAN_DAYS, BAN_FOREVER } from '../src/game/account';
import {
  ADMIN_COINS_MAX,
  ADMIN_IMAGE_MAX_BYTES,
  type AdminAction,
  type AdminCharacter,
  type AdminCharacterDetail,
  type AdminActionKind,
  type AdminFeature,
  type AdminPlayer,
  type AdminPlayerRow,
  type Economy,
  type ReportGroup,
} from '../src/game/admin';
import type { Category } from '../src/game/types';
import { POT_CENTS } from '../src/game/casino';
import { FEATURES, isFeatureId } from '../src/game/features';
import { RARITIES } from '../src/game/gacha';

// ---------- Acesso ----------

/** Chaves públicas do Access, guardadas por 1 hora (e buscadas de novo se aparecer uma chave desconhecida). */
let keysCache: { url: string; at: number; keys: AccessJwk[] } | null = null;
const KEYS_TTL_MS = 60 * 60 * 1000;

async function accessKeys(team: string, refresh: boolean): Promise<AccessJwk[]> {
  const url = `${team}/cdn-cgi/access/certs`;
  if (!refresh && keysCache?.url === url && Date.now() - keysCache.at < KEYS_TTL_MS) return keysCache.keys;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Access certs: HTTP ${res.status}`);
  const { keys } = (await res.json()) as { keys: AccessJwk[] };
  keysCache = { url, at: Date.now(), keys };
  return keys;
}

/**
 * Quem é o admin desta requisição, ou null. Duas camadas: o Cloudflare Access pede o login antes de a requisição
 * chegar aqui, e o Worker confere o token dele (assinatura, AUD, prazo) e o e-mail na lista `ADMIN_EMAILS`.
 * Faltou alguma configuração = ninguém entra. No dev local (sem Access) libera como 'local'.
 */
async function adminEmail(request: Request, env: Env): Promise<string | null> {
  if (isLocalRequest(request)) return 'local';
  const team = env.ACCESS_TEAM_DOMAIN?.replace(/\/+$/, '');
  const allowed = (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!team || !env.ACCESS_AUD || !allowed.length || !token) return null;
  const email = await verifyAccessJwt(token, {
    issuer: team,
    audience: env.ACCESS_AUD,
    keys: (refresh) => accessKeys(team, refresh),
  });
  return email && allowed.includes(email) ? email : null;
}

// ---------- Registro das ações ----------

function logAction(env: Env, admin: string, action: AdminActionKind, playerId: number | null, details: Record<string, unknown>) {
  return env.DB.prepare(
    'INSERT INTO admin_actions (admin, action, player_id, details, created_at) VALUES (?, ?, ?, ?, ?)',
  ).bind(admin, action, playerId, JSON.stringify(details), Date.now());
}

interface ActionRow {
  id: number;
  admin: string;
  action: AdminActionKind;
  player_id: number | null;
  player_name: string | null;
  details: string;
  created_at: number;
}

const toAction = (r: ActionRow): AdminAction => ({
  id: r.id,
  admin: r.admin,
  action: r.action,
  playerId: r.player_id,
  playerName: r.player_name,
  details: JSON.parse(r.details),
  createdAt: r.created_at,
});

async function loadActions(env: Env, playerId: number | null, limit: number): Promise<AdminAction[]> {
  const rows = await env.DB.prepare(
    `SELECT a.*, p.name AS player_name FROM admin_actions a LEFT JOIN players p ON p.id = a.player_id
     WHERE ?1 IS NULL OR a.player_id = ?1 ORDER BY a.id DESC LIMIT ?2`,
  )
    .bind(playerId, limit)
    .all<ActionRow>();
  return rows.results.map(toAction);
}

// ---------- Chaves ----------

async function loadAdminFeatures(env: Env): Promise<AdminFeature[]> {
  const rows = await env.DB.prepare('SELECT id, enabled, updated_at FROM features').all<{
    id: string;
    enabled: number;
    updated_at: number;
  }>();
  const byId = new Map(rows.results.map((r) => [r.id, r]));
  return FEATURES.map((id) => {
    const row = byId.get(id);
    return { id, enabled: Boolean(row?.enabled), updatedAt: row?.updated_at ?? null };
  });
}

/** POST /api/admin/features { id, enabled } → AdminFeature[]. */
async function setFeature(env: Env, admin: string, body: { id?: unknown; enabled?: unknown }): Promise<Response> {
  if (!isFeatureId(body.id) || typeof body.enabled !== 'boolean') return badRequest('Chave inválida');
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO features (id, enabled, updated_at) VALUES (?1, ?2, ?3)
       ON CONFLICT (id) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at`,
    ).bind(body.id, body.enabled ? 1 : 0, now),
    logAction(env, admin, 'feature', null, { id: body.id, enabled: body.enabled }),
  ]);
  return json(await loadAdminFeatures(env));
}

// ---------- Economia ----------

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

async function loadEconomy(env: Env): Promise<Economy> {
  const since = Date.now() - WEEK_MS;
  // Cada soma em duas colunas: tudo e só os últimos 7 dias (?1).
  const [players, earned, granted, slots, pot, plinko, scratch, box, rarities, items] = await env.DB.batch<Record<string, number | string>>([
    env.DB.prepare(
      'SELECT COUNT(*) AS accounts, COALESCE(SUM(coins), 0) AS circulating, COALESCE(MAX(coins), 0) AS max, COALESCE(AVG(coins), 0) AS avg FROM players',
    ),
    env.DB.prepare(
      'SELECT COALESCE(SUM(coins), 0) AS total, COALESCE(SUM(CASE WHEN created_at >= ?1 THEN coins END), 0) AS week FROM scores',
    ).bind(since),
    env.DB.prepare(
      `SELECT COALESCE(SUM(json_extract(details, '$.delta')), 0) AS total,
              COALESCE(SUM(CASE WHEN created_at >= ?1 THEN json_extract(details, '$.delta') END), 0) AS week
       FROM admin_actions WHERE action = 'coins'`,
    ).bind(since),
    env.DB.prepare(
      `SELECT COUNT(*) AS spins, COALESCE(SUM(bet), 0) AS bet, COALESCE(SUM(prize), 0) AS prize, COALESCE(SUM(jackpot), 0) AS jackpots,
              COALESCE(SUM(created_at >= ?1), 0) AS w_spins,
              COALESCE(SUM(CASE WHEN created_at >= ?1 THEN bet END), 0) AS w_bet,
              COALESCE(SUM(CASE WHEN created_at >= ?1 THEN prize END), 0) AS w_prize,
              COALESCE(SUM(CASE WHEN created_at >= ?1 THEN jackpot END), 0) AS w_jackpots
       FROM casino_spins`,
    ).bind(since),
    env.DB.prepare('SELECT amount_cents FROM casino_pot WHERE id = 1'),
    env.DB.prepare(
      `SELECT COUNT(*) AS drops, COALESCE(SUM(bet), 0) AS bet, COALESCE(SUM(prize), 0) AS prize,
              COALESCE(SUM(created_at >= ?1), 0) AS w_drops,
              COALESCE(SUM(CASE WHEN created_at >= ?1 THEN bet END), 0) AS w_bet,
              COALESCE(SUM(CASE WHEN created_at >= ?1 THEN prize END), 0) AS w_prize
       FROM plinko_drops`,
    ).bind(since),
    env.DB.prepare(
      `SELECT COUNT(*) AS cards, COALESCE(SUM(bet), 0) AS bet, COALESCE(SUM(prize), 0) AS prize,
              COALESCE(SUM(created_at >= ?1), 0) AS w_cards,
              COALESCE(SUM(CASE WHEN created_at >= ?1 THEN bet END), 0) AS w_bet,
              COALESCE(SUM(CASE WHEN created_at >= ?1 THEN prize END), 0) AS w_prize
       FROM scratch_cards`,
    ).bind(since),
    env.DB.prepare(
      `SELECT COUNT(*) AS openings, COALESCE(SUM(price), 0) AS spent, COALESCE(SUM(refund), 0) AS refunded,
              COALESCE(SUM(created_at >= ?1), 0) AS w_openings,
              COALESCE(SUM(CASE WHEN created_at >= ?1 THEN price END), 0) AS w_spent,
              COALESCE(SUM(CASE WHEN created_at >= ?1 THEN refund END), 0) AS w_refunded
       FROM gacha_openings`,
    ).bind(since),
    env.DB.prepare('SELECT rarity, COUNT(*) AS count FROM gacha_openings GROUP BY rarity'),
    env.DB.prepare('SELECT item_id, COUNT(*) AS owners FROM player_items GROUP BY item_id ORDER BY owners DESC, item_id LIMIT 10'),
  ]);
  const one = (r: D1Result<Record<string, number | string>>) => r.results[0] ?? {};
  const n = (v: unknown) => Number(v ?? 0);
  const p = one(players);
  const s = one(slots);
  const pl = one(plinko);
  const sc = one(scratch);
  const b = one(box);
  const rarityCount = new Map(rarities.results.map((r) => [r.rarity, n(r.count)]));
  return {
    accounts: n(p.accounts),
    circulating: n(p.circulating),
    maxBalance: n(p.max),
    avgBalance: Math.round(n(p.avg)),
    earned: { total: n(one(earned).total), week: n(one(earned).week) },
    granted: { total: n(one(granted).total), week: n(one(granted).week) },
    slots: {
      total: { spins: n(s.spins), bet: n(s.bet), prize: n(s.prize), jackpots: n(s.jackpots) },
      week: { spins: n(s.w_spins), bet: n(s.w_bet), prize: n(s.w_prize), jackpots: n(s.w_jackpots) },
      pot: Math.floor(n(one(pot).amount_cents) / POT_CENTS),
    },
    plinko: {
      total: { drops: n(pl.drops), bet: n(pl.bet), prize: n(pl.prize) },
      week: { drops: n(pl.w_drops), bet: n(pl.w_bet), prize: n(pl.w_prize) },
    },
    scratch: {
      total: { cards: n(sc.cards), bet: n(sc.bet), prize: n(sc.prize) },
      week: { cards: n(sc.w_cards), bet: n(sc.w_bet), prize: n(sc.w_prize) },
    },
    box: {
      total: { openings: n(b.openings), spent: n(b.spent), refunded: n(b.refunded) },
      week: { openings: n(b.w_openings), spent: n(b.w_spent), refunded: n(b.w_refunded) },
      rarities: RARITIES.map((r) => ({ rarity: r.id, count: rarityCount.get(r.id) ?? 0, chance: r.chance })),
    },
    topItems: items.results.map((r) => ({ itemId: String(r.item_id), owners: n(r.owners) })),
  };
}

// ---------- Jogadores ----------

interface PlayerRow {
  id: number;
  name: string;
  coins: number;
  created_at: number;
  has_password: number;
  adult: number;
  locked_until: number;
  banned_until: number;
  ban_reason: string | null;
}

const PLAYER_COLUMNS = `id, name, coins, created_at, password_hash IS NOT NULL AS has_password,
  adult_confirmed_at IS NOT NULL AS adult, locked_until, banned_until, ban_reason`;

const toPlayerRow = (r: PlayerRow): AdminPlayerRow => ({
  id: r.id,
  name: r.name,
  coins: r.coins,
  createdAt: r.created_at,
  hasPassword: Boolean(r.has_password),
  adult: Boolean(r.adult),
  lockedUntil: r.locked_until,
  bannedUntil: r.banned_until,
  banReason: r.ban_reason,
});

const PLAYER_LIST_SIZE = 50;

/** GET /api/admin/players?q=&sort=recent|coins → AdminPlayerRow[] (busca por parte do nick, sem diferenciar maiúsculas). */
async function searchPlayers(env: Env, url: URL): Promise<Response> {
  const q = nameKey(url.searchParams.get('q')?.trim() ?? '').replace(/[\\%_]/g, (c) => `\\${c}`);
  const order = url.searchParams.get('sort') === 'coins' ? 'coins DESC, id DESC' : 'id DESC';
  const rows = await env.DB.prepare(
    `SELECT ${PLAYER_COLUMNS} FROM players WHERE name_key LIKE ?1 ESCAPE '\\' ORDER BY ${order} LIMIT ?2`,
  )
    .bind(`%${q}%`, PLAYER_LIST_SIZE)
    .all<PlayerRow>();
  return json(rows.results.map(toPlayerRow));
}

async function loadAdminPlayer(env: Env, id: number): Promise<AdminPlayer | null> {
  const [player, counts, scores, access] = await env.DB.batch<Record<string, number | string | null>>([
    env.DB.prepare(`SELECT ${PLAYER_COLUMNS} FROM players WHERE id = ?`).bind(id),
    env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM player_items WHERE player_id = ?1) AS items,
         (SELECT COUNT(*) FROM player_tokens WHERE player_id = ?1) AS devices,
         (SELECT COUNT(*) FROM scores WHERE player_id = ?1) AS games,
         (SELECT COALESCE(SUM(coins), 0) FROM scores WHERE player_id = ?1) AS earned,
         (SELECT COUNT(*) FROM casino_spins WHERE player_id = ?1) AS spins,
         (SELECT COALESCE(SUM(bet), 0) FROM casino_spins WHERE player_id = ?1) AS bet,
         (SELECT COALESCE(SUM(prize), 0) FROM casino_spins WHERE player_id = ?1) AS prize,
         (SELECT COUNT(*) FROM plinko_drops WHERE player_id = ?1) AS drops,
         (SELECT COALESCE(SUM(bet), 0) FROM plinko_drops WHERE player_id = ?1) AS plinko_bet,
         (SELECT COALESCE(SUM(prize), 0) FROM plinko_drops WHERE player_id = ?1) AS plinko_prize,
         (SELECT COUNT(*) FROM scratch_cards WHERE player_id = ?1) AS cards,
         (SELECT COALESCE(SUM(bet), 0) FROM scratch_cards WHERE player_id = ?1) AS scratch_bet,
         (SELECT COALESCE(SUM(prize), 0) FROM scratch_cards WHERE player_id = ?1) AS scratch_prize,
         (SELECT COUNT(*) FROM gacha_openings WHERE player_id = ?1) AS openings,
         (SELECT COALESCE(SUM(price), 0) FROM gacha_openings WHERE player_id = ?1) AS spent,
         (SELECT COALESCE(SUM(refund), 0) FROM gacha_openings WHERE player_id = ?1) AS refunded`,
    ).bind(id),
    env.DB.prepare(
      'SELECT mode, score, coins, daily, created_at FROM scores WHERE player_id = ? ORDER BY created_at DESC LIMIT 10',
    ).bind(id),
    env.DB.prepare(
      'SELECT event, ip, country, created_at FROM access_log WHERE player_id = ? ORDER BY created_at DESC LIMIT 10',
    ).bind(id),
  ]);
  const row = player.results[0] as unknown as PlayerRow | undefined;
  if (!row) return null;
  const c = (counts.results[0] ?? {}) as Record<string, number>;
  return {
    ...toPlayerRow(row),
    items: c.items,
    devices: c.devices,
    games: c.games,
    earned: c.earned,
    slots: { spins: c.spins, bet: c.bet, prize: c.prize },
    plinko: { drops: c.drops, bet: c.plinko_bet, prize: c.plinko_prize },
    scratch: { cards: c.cards, bet: c.scratch_bet, prize: c.scratch_prize },
    box: { openings: c.openings, spent: c.spent, refunded: c.refunded },
    recentScores: scores.results.map((s) => ({
      mode: String(s.mode),
      score: Number(s.score),
      coins: Number(s.coins),
      daily: s.daily !== null,
      createdAt: Number(s.created_at),
    })),
    recentAccess: access.results.map((a) => ({
      event: String(a.event),
      ip: String(a.ip),
      country: a.country === null ? null : String(a.country),
      createdAt: Number(a.created_at),
    })),
    actions: await loadActions(env, id, 20),
  };
}

async function playerResponse(env: Env, id: number): Promise<Response> {
  const player = await loadAdminPlayer(env, id);
  return player ? json(player) : json({ error: 'Jogador não encontrado' }, { status: 404 });
}

/**
 * POST /api/admin/players/:id/coins { delta, reason } → AdminPlayer. Soma (ou tira) moedas; o saldo não fica
 * negativo. O UPDATE e o registro vão juntos (batch = transação): o registro só entra se o saldo mudou.
 */
async function adjustCoins(env: Env, admin: string, id: number, body: { delta?: unknown; reason?: unknown }): Promise<Response> {
  const delta = body.delta;
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : '';
  if (typeof delta !== 'number' || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > ADMIN_COINS_MAX) {
    return badRequest('Quantidade inválida');
  }
  if (!reason) return badRequest('Informe o motivo');
  const [updated] = await env.DB.batch([
    env.DB.prepare('UPDATE players SET coins = coins + ?1 WHERE id = ?2 AND coins + ?1 >= 0').bind(delta, id),
    env.DB.prepare(
      `INSERT INTO admin_actions (admin, action, player_id, details, created_at)
       SELECT ?1, 'coins', ?2, json_object('delta', ?3, 'reason', ?4, 'coins', coins), ?5
       FROM players WHERE id = ?2 AND changes() = 1`,
    ).bind(admin, id, delta, reason, Date.now()),
  ]);
  if (!updated.meta.changes) return json({ error: 'O saldo não pode ficar negativo' }, { status: 409 });
  return playerResponse(env, id);
}

/** POST /api/admin/players/:id/rename { name } → AdminPlayer. Sem o filtro de palavrões: o admin decide. */
async function renameByAdmin(env: Env, admin: string, id: number, body: { name?: unknown }): Promise<Response> {
  const name = sanitizeName(body.name);
  if (!name) return badRequest('Nick inválido');
  const current = await env.DB.prepare('SELECT name FROM players WHERE id = ?').bind(id).first<{ name: string }>();
  if (!current) return json({ error: 'Jogador não encontrado' }, { status: 404 });
  try {
    await env.DB.batch([
      env.DB.prepare('UPDATE players SET name = ?, name_key = ? WHERE id = ?').bind(name, nameKey(name), id),
      logAction(env, admin, 'rename', id, { from: current.name, to: name }),
    ]);
  } catch (err) {
    if (String(err).includes('UNIQUE')) return json({ error: 'Esse nick já é de outra conta' }, { status: 409 });
    throw err;
  }
  return playerResponse(env, id);
}

/** Senha temporária: sem letras que se confundem (0/O, 1/l/I). */
function temporaryPassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

/**
 * POST /api/admin/players/:id/password → { password, player }. Troca a senha por uma temporária (mostrada uma vez),
 * desbloqueia e desconecta todos os aparelhos da conta.
 */
async function resetPassword(env: Env, admin: string, id: number): Promise<Response> {
  const exists = await env.DB.prepare('SELECT 1 FROM players WHERE id = ?').bind(id).first();
  if (!exists) return json({ error: 'Jogador não encontrado' }, { status: 404 });
  const password = temporaryPassword();
  const hash = await hashPassword(password);
  await env.DB.batch([
    env.DB.prepare('UPDATE players SET password_hash = ?, failed_logins = 0, locked_until = 0 WHERE id = ?').bind(hash, id),
    env.DB.prepare('DELETE FROM player_tokens WHERE player_id = ?').bind(id),
    logAction(env, admin, 'password', id, {}),
  ]);
  return json({ password, player: await loadAdminPlayer(env, id) });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * POST /api/admin/players/:id/ban { days: 1|7|30|null (permanente), reason } → AdminPlayer. Suspende a conta:
 * desconecta todos os aparelhos, recusa o login (com a data) e tira a conta do ranking enquanto durar.
 */
async function banPlayer(env: Env, admin: string, id: number, body: { days?: unknown; reason?: unknown }): Promise<Response> {
  const days = body.days ?? null;
  if (days !== null && !(BAN_DAYS as readonly unknown[]).includes(days)) return badRequest('Prazo inválido');
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : '';
  if (!reason) return badRequest('Informe o motivo');
  const until = days === null ? BAN_FOREVER : Date.now() + (days as number) * DAY_MS;
  const [updated] = await env.DB.batch([
    env.DB.prepare('UPDATE players SET banned_until = ?, ban_reason = ? WHERE id = ?').bind(until, reason, id),
    env.DB.prepare('DELETE FROM player_tokens WHERE player_id = ?').bind(id),
    logAction(env, admin, 'ban', id, { days, reason, until }),
  ]);
  if (!updated.meta.changes) return json({ error: 'Jogador não encontrado' }, { status: 404 });
  return playerResponse(env, id);
}

/** POST /api/admin/players/:id/unban → AdminPlayer. Tira a suspensão (o jogador entra de novo com a senha). */
async function unbanPlayer(env: Env, admin: string, id: number): Promise<Response> {
  const [updated] = await env.DB.batch([
    env.DB.prepare('UPDATE players SET banned_until = 0, ban_reason = NULL WHERE id = ? AND banned_until > 0').bind(id),
    env.DB.prepare(
      `INSERT INTO admin_actions (admin, action, player_id, details, created_at)
       SELECT ?1, 'unban', ?2, '{}', ?3 WHERE changes() = 1`,
    ).bind(admin, id, Date.now()),
  ]);
  if (!updated.meta.changes) return json({ error: 'Essa conta não está suspensa' }, { status: 409 });
  return playerResponse(env, id);
}

// ---------- Personagens ----------

interface CharacterRow {
  id: string;
  name: string;
  category: Category;
  series: string;
  version: string | null;
  tier: 1 | 2 | 3 | null;
  power: number;
  image: string | null;
  image_version: string | null;
  anilist_id: number | null;
  active: number;
  admin_fields: string | null;
}

const CHARACTER_COLUMNS = 'id, name, category, series, version, tier, power, image, image_version, anilist_id, active, admin_fields';

const toCharacter = (r: CharacterRow): AdminCharacter => ({
  id: r.id,
  name: r.name,
  category: r.category,
  series: r.series,
  version: r.version,
  tier: r.tier,
  power: r.power,
  image: r.image,
  imageVersion: r.image_version,
  anilistId: r.anilist_id,
  active: r.active === 1,
  adminFields: r.admin_fields ? (JSON.parse(r.admin_fields) as string[]) : [],
});

const CHARACTER_LIST_SIZE = 60;
const CATEGORIES: Category[] = ['anime', 'games', 'movies', 'pokemon'];

/** GET /api/admin/characters?q=&category= → AdminCharacter[] (busca por parte do nome, da obra ou do id). */
async function searchCharacters(env: Env, url: URL): Promise<Response> {
  const q = (url.searchParams.get('q')?.trim() ?? '').replace(/[\\%_]/g, (c) => `\\${c}`);
  const category = url.searchParams.get('category');
  const rows = await env.DB.prepare(
    `SELECT ${CHARACTER_COLUMNS} FROM characters
     WHERE (name LIKE ?1 ESCAPE '\\' OR series LIKE ?1 ESCAPE '\\' OR id LIKE ?1 ESCAPE '\\') AND (?2 IS NULL OR category = ?2)
     ORDER BY active DESC, power DESC, name LIMIT ?3`,
  )
    .bind(`%${q}%`, CATEGORIES.includes(category as Category) ? category : null, CHARACTER_LIST_SIZE)
    .all<CharacterRow>();
  return json(rows.results.map(toCharacter));
}

async function loadAdminCharacter(env: Env, id: string): Promise<AdminCharacterDetail | null> {
  const [character, history, reports] = await env.DB.batch<Record<string, unknown>>([
    env.DB.prepare(`SELECT ${CHARACTER_COLUMNS} FROM characters WHERE id = ?`).bind(id),
    env.DB.prepare(
      `SELECT a.*, NULL AS player_name FROM admin_actions a
       WHERE a.action IN ('character', 'image') AND json_extract(a.details, '$.id') = ? ORDER BY a.id DESC LIMIT 20`,
    ).bind(id),
    env.DB.prepare("SELECT COUNT(*) AS n FROM reports WHERE kind = 'image' AND target = ? AND status = 'open'").bind(id),
  ]);
  const row = character.results[0] as unknown as CharacterRow | undefined;
  if (!row) return null;
  return {
    ...toCharacter(row),
    history: (history.results as unknown as ActionRow[]).map(toAction),
    openReports: Number((reports.results[0] as { n?: number } | undefined)?.n ?? 0),
  };
}

async function characterResponse(env: Env, id: string): Promise<Response> {
  const character = await loadAdminCharacter(env, id);
  return character ? json(character) : json({ error: 'Personagem não encontrado' }, { status: 404 });
}

/** Junta campos editados aos que já estavam marcados (o sync deixa de sobrescrever esses). */
const mergeFields = (current: string[], changed: string[]) => JSON.stringify([...new Set([...current, ...changed])].sort());

/** Valida a edição: devolve as colunas novas ou a mensagem de erro. */
function parseEdit(body: Record<string, unknown>, current: AdminCharacter): Record<string, unknown> | string {
  const next: Record<string, unknown> = {};
  if ('name' in body) {
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 60) : '';
    if (!name) return 'Nome inválido';
    next.name = name;
  }
  if ('series' in body) {
    const series = typeof body.series === 'string' ? body.series.trim().slice(0, 80) : '';
    if (!series) return 'Obra inválida';
    next.series = series;
  }
  if ('version' in body) {
    if (body.version !== null && typeof body.version !== 'string') return 'Versão inválida';
    next.version = (body.version as string | null)?.trim().slice(0, 80) || null;
  }
  if ('power' in body) {
    const power = body.power;
    if (typeof power !== 'number' || !Number.isFinite(power) || power < 0 || power > 100) return 'Poder inválido (0 a 100)';
    next.power = Math.round(power * 10) / 10;
  }
  if ('tier' in body) {
    // Pokémon não tem fama (usa o filtro de gerações); anime e games precisam de uma.
    const valid = current.category === 'pokemon' ? body.tier === null : [1, 2, 3].includes(body.tier as number);
    if (!valid) return 'Fama inválida';
    next.tier = body.tier;
  }
  if ('active' in body) {
    if (typeof body.active !== 'boolean') return 'Ativo inválido';
    next.active = body.active ? 1 : 0;
  }
  return next;
}

/**
 * POST /api/admin/characters/:id { name?, series?, version?, tier?, power?, active? } → AdminCharacterDetail.
 * Grava só o que mudou, marca esses campos como do admin (o `characters:sync` não sobrescreve) e registra o antes e
 * o depois. Mudar o `power` não recalcula partidas antigas (isso é o `rescore`).
 */
async function editCharacter(env: Env, admin: string, id: string, body: Record<string, unknown>): Promise<Response> {
  const row = await env.DB.prepare(`SELECT ${CHARACTER_COLUMNS} FROM characters WHERE id = ?`).bind(id).first<CharacterRow>();
  if (!row) return json({ error: 'Personagem não encontrado' }, { status: 404 });
  const current = toCharacter(row);
  const next = parseEdit(body, current);
  if (typeof next === 'string') return badRequest(next);

  const before = row as unknown as Record<string, unknown>;
  const changes = Object.fromEntries(
    Object.entries(next)
      .filter(([column, value]) => before[column] !== value)
      .map(([column, value]) => [column, [before[column], value]]),
  );
  const columns = Object.keys(changes);
  if (!columns.length) return characterResponse(env, id);

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE characters SET ${columns.map((c) => `${c} = ?`).join(', ')}, admin_fields = ?, updated_at = ? WHERE id = ?`,
    ).bind(...columns.map((c) => next[c]), mergeFields(current.adminFields, columns), Date.now(), id),
    logAction(env, admin, 'character', null, { id, name: current.name, changes }),
  ]);
  clearCatalogCache();
  return characterResponse(env, id);
}

const fromBase64 = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

/** Começa com "RIFF....WEBP"? (o site sempre envia WebP; qualquer outra coisa é recusada). */
const isWebp = (b: Uint8Array) =>
  b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP';

/**
 * POST /api/admin/characters/:id/image { data: base64 do WebP } → AdminCharacterDetail. Troca a imagem sem deploy:
 * guarda no D1 e aponta o personagem para /api/img/:id com uma versão nova (o cache dos navegadores é ignorado).
 */
async function uploadImage(env: Env, admin: string, id: string, body: { data?: unknown }): Promise<Response> {
  let bytes: Uint8Array;
  try {
    bytes = fromBase64(typeof body.data === 'string' ? body.data : '');
  } catch {
    return badRequest('Imagem inválida');
  }
  if (!isWebp(bytes) || bytes.length > ADMIN_IMAGE_MAX_BYTES) return badRequest('Imagem inválida');
  const row = await env.DB.prepare('SELECT name, image, admin_fields FROM characters WHERE id = ?')
    .bind(id)
    .first<{ name: string; image: string | null; admin_fields: string | null }>();
  if (!row) return json({ error: 'Personagem não encontrado' }, { status: 404 });

  const now = Date.now();
  const fields = row.admin_fields ? (JSON.parse(row.admin_fields) as string[]) : [];
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO character_images (character_id, data, content_type, created_at) VALUES (?1, ?2, 'image/webp', ?3)
       ON CONFLICT (character_id) DO UPDATE SET data = excluded.data, content_type = excluded.content_type, created_at = excluded.created_at`,
    ).bind(id, bytes, now),
    env.DB.prepare('UPDATE characters SET image = ?, image_version = ?, admin_fields = ?, updated_at = ? WHERE id = ?').bind(
      `api/img/${id}`,
      `a${now.toString(36)}`,
      mergeFields(fields, ['image']),
      now,
      id,
    ),
    logAction(env, admin, 'image', null, { id, name: row.name, from: row.image, bytes: bytes.length }),
  ]);
  clearCatalogCache();
  return characterResponse(env, id);
}

// ---------- Moderação ----------

interface ReportRow {
  kind: ReportGroup['kind'];
  target: string;
  target_name: string;
  player_id: number | null;
  count: number;
  reasons: string;
  first_at: number;
  last_at: number;
}

/** GET /api/admin/reports → ReportGroup[]: denúncias abertas, juntas por alvo (mais denunciados primeiro). */
async function loadReports(env: Env): Promise<ReportGroup[]> {
  const { results } = await env.DB.prepare(
    `SELECT kind, target, MAX(target_name) AS target_name, MAX(target_player_id) AS player_id, COUNT(*) AS count,
            json_group_array(reason) AS reasons, MIN(created_at) AS first_at, MAX(created_at) AS last_at
     FROM reports WHERE status = 'open' GROUP BY kind, target ORDER BY count DESC, last_at DESC LIMIT 100`,
  ).all<ReportRow>();
  const imageIds = results.filter((r) => r.kind === 'image').map((r) => r.target);
  const characters = new Map<string, AdminCharacter>();
  if (imageIds.length) {
    const rows = await env.DB.prepare(
      `SELECT ${CHARACTER_COLUMNS} FROM characters WHERE id IN (${imageIds.map(() => '?').join(', ')})`,
    )
      .bind(...imageIds)
      .all<CharacterRow>();
    for (const r of rows.results) characters.set(r.id, toCharacter(r));
  }
  return results.map((r) => {
    const reasons: ReportGroup['reasons'] = {};
    for (const reason of JSON.parse(r.reasons) as (keyof ReportGroup['reasons'])[]) reasons[reason] = (reasons[reason] ?? 0) + 1;
    return {
      kind: r.kind,
      target: r.target,
      targetName: r.target_name,
      playerId: r.player_id,
      count: r.count,
      reasons,
      firstAt: r.first_at,
      lastAt: r.last_at,
      character: characters.get(r.target) ?? null,
    };
  });
}

/**
 * POST /api/admin/reports/close { kind, target, status: 'resolved' | 'dismissed' } → ReportGroup[]. Fecha todas as
 * denúncias abertas do alvo (resolvida = o admin agiu; descartada = não era nada).
 */
async function closeReports(env: Env, admin: string, body: { kind?: unknown; target?: unknown; status?: unknown }): Promise<Response> {
  const { kind, target, status } = body;
  if ((kind !== 'nick' && kind !== 'image') || typeof target !== 'string' || (status !== 'resolved' && status !== 'dismissed')) {
    return badRequest('Denúncia inválida');
  }
  const now = Date.now();
  const owner = await env.DB.prepare(
    "SELECT MAX(target_player_id) AS id FROM reports WHERE kind = ? AND target = ? AND status = 'open'",
  )
    .bind(kind, target)
    .first<{ id: number | null }>();
  // O registro conta quantas fecharam (changes() do UPDATE logo antes, na mesma transação).
  const [updated] = await env.DB.batch([
    env.DB.prepare(
      "UPDATE reports SET status = ?, closed_at = ?, closed_by = ? WHERE kind = ? AND target = ? AND status = 'open'",
    ).bind(status, now, admin, kind, target),
    env.DB.prepare(
      `INSERT INTO admin_actions (admin, action, player_id, details, created_at)
       SELECT ?1, 'report', ?2, json_object('kind', ?3, 'target', ?4, 'status', ?5, 'count', changes()), ?6 WHERE changes() > 0`,
    ).bind(admin, owner?.id ?? null, kind, target, status, now),
  ]);
  if (!updated.meta.changes) return json({ error: 'Nada para fechar' }, { status: 409 });
  return json(await loadReports(env));
}

// ---------- Rotas ----------

const PLAYER_ROUTE = /^\/api\/admin\/players\/(\d+)(?:\/(coins|rename|password|ban|unban))?$/;
const CHARACTER_ROUTE = /^\/api\/admin\/characters\/([a-z0-9-]+)(?:\/(image))?$/;

/** Tudo em /api/admin/*: confere o admin antes de qualquer rota. */
export async function handleAdmin(request: Request, env: Env): Promise<Response> {
  const admin = await adminEmail(request, env);
  if (!admin) return json({ error: 'Acesso negado', code: 'admin_denied' }, { status: 403 });

  const url = new URL(request.url);
  const route = `${request.method} ${url.pathname}`;
  // POST só com JSON: outro site não consegue mandar esse Content-Type sem preflight (CORS), então não dá para
  // usar o cookie do Access de quem está logado para disparar uma ação (CSRF).
  if (request.method === 'POST' && !request.headers.get('Content-Type')?.startsWith('application/json')) {
    return badRequest('Envie JSON');
  }
  const body: Record<string, unknown> = request.method === 'POST' ? (((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>) : {};

  switch (route) {
    case 'GET /api/admin/me':
      return json({ email: admin });
    case 'GET /api/admin/features':
      return json(await loadAdminFeatures(env));
    case 'POST /api/admin/features':
      return setFeature(env, admin, body);
    case 'GET /api/admin/economy':
      return json(await loadEconomy(env));
    case 'GET /api/admin/players':
      return searchPlayers(env, url);
    case 'GET /api/admin/actions':
      return json(await loadActions(env, null, 50));
    case 'GET /api/admin/characters':
      return searchCharacters(env, url);
    case 'GET /api/admin/reports':
      return json(await loadReports(env));
    case 'POST /api/admin/reports/close':
      return closeReports(env, admin, body);
  }

  const character = CHARACTER_ROUTE.exec(url.pathname);
  if (character) {
    const [, id, action] = character;
    if (request.method === 'GET' && !action) return characterResponse(env, id);
    if (request.method === 'POST' && !action) return editCharacter(env, admin, id, body);
    if (request.method === 'POST' && action === 'image') return uploadImage(env, admin, id, body);
  }

  const match = PLAYER_ROUTE.exec(url.pathname);
  if (match) {
    const id = Number(match[1]);
    const action = match[2];
    if (request.method === 'GET' && !action) return playerResponse(env, id);
    if (request.method === 'POST' && action === 'coins') return adjustCoins(env, admin, id, body);
    if (request.method === 'POST' && action === 'rename') return renameByAdmin(env, admin, id, body);
    if (request.method === 'POST' && action === 'password') return resetPassword(env, admin, id);
    if (request.method === 'POST' && action === 'ban') return banPlayer(env, admin, id, body);
    if (request.method === 'POST' && action === 'unban') return unbanPlayer(env, admin, id);
  }
  return json({ error: 'Not found' }, { status: 404 });
}
