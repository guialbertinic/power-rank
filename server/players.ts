import { badRequest, json, nameKey, sanitizeName, type Env } from './lib';
import { passwordProblem } from '../src/game/account';

/** PBKDF2: o número de iterações fica gravado junto do hash, para poder subir depois sem invalidar senhas. */
const PBKDF2_ITERATIONS = 50_000;
/** Senhas erradas seguidas até bloquear o nick, e por quanto tempo. */
const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 5 * 60 * 1000;

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

async function checkPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterations, salt, expected] = stored.split('$');
  if (scheme !== 'pbkdf2-sha256' || !salt || !expected) return false;
  const hash = await pbkdf2(password, fromBase64(salt), Number(iterations));
  const want = fromBase64(expected);
  // Comparação em tempo constante.
  let diff = hash.length ^ want.length;
  for (let i = 0; i < Math.min(hash.length, want.length); i++) diff |= hash[i] ^ want[i];
  return diff === 0;
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

interface OwnerRow {
  name: string;
  password_hash: string | null;
  failed_logins: number;
  locked_until: number;
}

/**
 * POST /api/players: { name, token?, password? } — escolhe um nick. O nick é único, com ou sem senha.
 * - Nick livre: vira seu (com a senha, se veio uma). Devolve { name, token }.
 * - Nick seu (token válido): devolve { name, token }.
 * - Nick de outra pessoa com senha: a senha certa dá um token novo para este aparelho; errada, 403.
 *   Muitas erradas seguidas bloqueiam o nick por alguns minutos (429).
 * - Nick de outra pessoa sem senha (ou sem senha enviada): 409 { error, taken: true, hasPassword }.
 */
export async function claimPlayer(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as
    | { name?: unknown; token?: unknown; password?: unknown }
    | null;
  const name = sanitizeName(body?.name);
  if (!name) return badRequest('Nick inválido');
  const key = nameKey(name);
  const password = typeof body?.password === 'string' && body.password !== '' ? body.password : null;

  const owner = await env.DB.prepare(
    'SELECT name, password_hash, failed_logins, locked_until FROM players WHERE name_key = ?',
  )
    .bind(key)
    .first<OwnerRow>();

  if (owner) {
    if (await verifyPlayer(env, name, body?.token)) return json({ name: owner.name, token: body?.token });
    const hasPassword = owner.password_hash !== null;
    if (!password || !owner.password_hash) {
      return json({ error: 'Esse nick já tem dono', taken: true, hasPassword }, { status: 409 });
    }
    return login(env, key, owner, password);
  }

  if (password) {
    const problem = passwordProblem(password);
    if (problem) return badRequest(problem);
  }
  // INSERT OR IGNORE: se duas pessoas pedirem o mesmo nick ao mesmo tempo, só uma fica com ele.
  const created = await env.DB.prepare(
    'INSERT OR IGNORE INTO players (name_key, name, password_hash, created_at) VALUES (?, ?, ?, ?)',
  )
    .bind(key, name, password ? await hashPassword(password) : null, Date.now())
    .run();
  if (!created.meta.changes) return json({ error: 'Esse nick já tem dono', taken: true }, { status: 409 });

  return json({ name, token: await issueToken(env, key) });
}

async function login(env: Env, key: string, owner: OwnerRow, password: string): Promise<Response> {
  if (owner.locked_until > Date.now()) {
    return json({ error: 'Muitas tentativas. Espere alguns minutos e tente de novo.' }, { status: 429 });
  }
  if (await checkPassword(password, owner.password_hash!)) {
    await env.DB.prepare('UPDATE players SET failed_logins = 0 WHERE name_key = ?').bind(key).run();
    return json({ name: owner.name, token: await issueToken(env, key) });
  }
  // Os dois SET usam o valor antigo de failed_logins; ao bloquear, a contagem recomeça.
  await env.DB.prepare(
    `UPDATE players SET
       locked_until = CASE WHEN failed_logins + 1 >= ?1 THEN ?2 ELSE locked_until END,
       failed_logins = CASE WHEN failed_logins + 1 >= ?1 THEN 0 ELSE failed_logins + 1 END
     WHERE name_key = ?3`,
  )
    .bind(MAX_FAILED_LOGINS, Date.now() + LOCK_MS, key)
    .run();
  return json({ error: 'Senha incorreta' }, { status: 403 });
}

/**
 * POST /api/players/password: { name, token, password } — cria a senha de um nick que ainda não tem.
 * Depois disso o dono entra com nick + senha em qualquer dispositivo.
 */
export async function setPassword(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as
    | { name?: unknown; token?: unknown; password?: unknown }
    | null;
  const name = sanitizeName(body?.name);
  if (!name || !(await verifyPlayer(env, name, body?.token))) {
    return json({ error: 'Nick não verificado' }, { status: 401 });
  }
  const problem = passwordProblem(body?.password);
  if (problem) return badRequest(problem);

  const updated = await env.DB.prepare(
    'UPDATE players SET password_hash = ? WHERE name_key = ? AND password_hash IS NULL',
  )
    .bind(await hashPassword(body!.password as string), nameKey(name))
    .run();
  if (!updated.meta.changes) return json({ error: 'Esse nick já tem senha' }, { status: 409 });
  return json({ ok: true });
}
