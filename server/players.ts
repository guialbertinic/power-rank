import { badRequest, json, nameKey, sanitizeName, type Env } from './lib';

/** Sem letras/números parecidos (I/1, O/0) para o código ser fácil de copiar à mão. */
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Código de sincronização no formato XXXX-XXXX-XXXX. */
function randomRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = [...bytes].map((b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]).join('');
  return chars.match(/.{4}/g)!.join('-');
}

const normalizeRecoveryCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function issueToken(env: Env, key: string): Promise<string> {
  const token = randomToken();
  await env.DB.prepare('INSERT INTO player_tokens (token_hash, name_key, created_at) VALUES (?, ?, ?)')
    .bind(await sha256(token), key, Date.now())
    .run();
  return token;
}

/** O token pertence ao dono deste nick? */
export async function verifyPlayer(env: Env, name: string, token: unknown): Promise<boolean> {
  if (typeof token !== 'string' || !token) return false;
  const row = await env.DB.prepare('SELECT 1 FROM player_tokens WHERE token_hash = ? AND name_key = ?')
    .bind(await sha256(token), nameKey(name))
    .first();
  return Boolean(row);
}

/**
 * POST /api/players: { name, token? } — escolhe um nick.
 * - Nick livre: vira seu. Devolve { name, token }. O código de sincronização é gerado depois, sob demanda
 *   (POST /api/players/sync-code), porque só fica guardado como hash.
 * - Nick seu (token válido): devolve { name, token }.
 * - Nick de outra pessoa: 409 { error, taken: true }.
 */
export async function claimPlayer(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { name?: unknown; token?: unknown } | null;
  const name = sanitizeName(body?.name);
  if (!name) return badRequest('Nick inválido');
  const key = nameKey(name);

  const owner = await env.DB.prepare('SELECT name FROM players WHERE name_key = ?').bind(key).first<{ name: string }>();
  if (owner) {
    if (await verifyPlayer(env, name, body?.token)) return json({ name: owner.name, token: body?.token });
    return json({ error: 'Esse nick já tem dono', taken: true }, { status: 409 });
  }

  // Código inicial aleatório que ninguém vê: o dono gera um visível quando quiser sincronizar outro aparelho.
  const recoveryCode = randomRecoveryCode();
  // INSERT OR IGNORE: se duas pessoas pedirem o mesmo nick ao mesmo tempo, só uma fica com ele.
  const created = await env.DB.prepare(
    'INSERT OR IGNORE INTO players (name_key, name, recovery_hash, created_at) VALUES (?, ?, ?, ?)',
  )
    .bind(key, name, await sha256(normalizeRecoveryCode(recoveryCode)), Date.now())
    .run();
  if (!created.meta.changes) return json({ error: 'Esse nick já tem dono', taken: true }, { status: 409 });

  return json({ name, token: await issueToken(env, key) });
}

/**
 * POST /api/players/sync-code: { name, token } → { code }. Gera um novo código de sincronização para o dono
 * usar em outro aparelho; o código anterior deixa de valer.
 */
export async function createSyncCode(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { name?: unknown; token?: unknown } | null;
  const name = sanitizeName(body?.name);
  if (!name || !(await verifyPlayer(env, name, body?.token))) {
    return json({ error: 'Nick não verificado' }, { status: 401 });
  }
  const code = randomRecoveryCode();
  await env.DB.prepare('UPDATE players SET recovery_hash = ? WHERE name_key = ?')
    .bind(await sha256(normalizeRecoveryCode(code)), nameKey(name))
    .run();
  return json({ code });
}

/** POST /api/players/recover: { name, recoveryCode } → { name, token }: usa o código de sincronização neste aparelho. */
export async function recoverPlayer(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { name?: unknown; recoveryCode?: unknown } | null;
  const name = sanitizeName(body?.name);
  if (!name || typeof body?.recoveryCode !== 'string') return badRequest('Dados inválidos');
  const key = nameKey(name);

  const owner = await env.DB.prepare('SELECT name, recovery_hash FROM players WHERE name_key = ?')
    .bind(key)
    .first<{ name: string; recovery_hash: string }>();
  const valid = owner && owner.recovery_hash === (await sha256(normalizeRecoveryCode(body.recoveryCode)));
  if (!valid) return json({ error: 'Código de sincronização inválido' }, { status: 403 });

  return json({ name: owner.name, token: await issueToken(env, key) });
}
