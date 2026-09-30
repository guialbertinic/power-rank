import { logAccess } from './access';
import { badRequest, json, nameKey, sanitizeName, type Env } from './lib';
import { lookalikeOf, nickProblem, verifyTurnstile } from './security';
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

export async function hashPassword(password: string): Promise<string> {
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

async function issueToken(env: Env, playerId: number): Promise<string> {
  const token = randomToken();
  await env.DB.prepare('INSERT INTO player_tokens (token_hash, player_id, created_at) VALUES (?, ?, ?)')
    .bind(await sha256(token), playerId, Date.now())
    .run();
  return token;
}

export interface Account {
  id: number;
  /** Nick atual da conta (pode ter mudado em outro dispositivo). */
  name: string;
}

/** Conta dona do token. O token identifica o jogador; o nick é só um atributo dele. */
export async function accountByToken(env: Env, token: unknown): Promise<Account | null> {
  if (typeof token !== 'string' || !token) return null;
  return env.DB.prepare(
    'SELECT p.id, p.name FROM player_tokens t JOIN players p ON p.id = t.player_id WHERE t.token_hash = ?',
  )
    .bind(await sha256(token))
    .first<Account>();
}

export type Access = ({ kind: 'account' } & Account) | { kind: 'guest'; name: string };

/**
 * Quem está jogando: com token, a conta dele (token inválido = null); sem token, um convidado com esse nick,
 * desde que o nick não seja de nenhuma conta. Convidados não reservam o nick nem ganham moedas.
 */
export async function playerAccess(env: Env, name: string, token: unknown): Promise<Access | null> {
  if (typeof token === 'string' && token) {
    const account = await accountByToken(env, token);
    return account && { kind: 'account', ...account };
  }
  // Convidado não usa nick de conta, nem um parecido demais com o de uma conta (ex: "AIbertini").
  const taken = await env.DB.prepare('SELECT 1 FROM players WHERE name_key = ?').bind(nameKey(name)).first();
  if (taken || (await lookalikeOf(env, name))) return null;
  return { kind: 'guest', name };
}

const unauthorized = () => json({ error: 'Nick não verificado' }, { status: 401 });

interface OwnerRow {
  id: number;
  name: string;
  password_hash: string | null;
  failed_logins: number;
  locked_until: number;
}

/**
 * GET /api/players/status?name= → { exists, hasPassword, problem }: consulta um nick sem ficar com ele
 * (a tela do nick decide se pede a senha ou se oferece criar uma conta).
 */
export async function playerStatus(request: Request, env: Env): Promise<Response> {
  const name = sanitizeName(new URL(request.url).searchParams.get('name'));
  if (!name) return badRequest('Nick inválido');
  const [row, lookalike] = await Promise.all([
    env.DB.prepare('SELECT password_hash IS NOT NULL AS has_password FROM players WHERE name_key = ?')
      .bind(nameKey(name))
      .first<{ has_password: number }>(),
    lookalikeOf(env, name),
  ]);
  // `problem`: nick que não pode ser usado por uma conta nova nem por convidado (ofensivo ou imitando outra conta).
  const problem = nickProblem(name) ?? (lookalike ? 'Parecido demais com o nick ' + lookalike + '. Escolha outro.' : null);
  return json({ exists: Boolean(row), hasPassword: Boolean(row?.has_password), problem });
}

/**
 * POST /api/players: { name, token?, password? } — cria a conta ou entra nela. Só a conta reserva o nick;
 * convidado não passa por aqui (joga com qualquer nick livre, ver playerAccess).
 * - Nick livre + senha: cria a conta. Devolve { name, token }. Sem senha: 400.
 * - Nick seu (token válido): devolve { name, token }.
 * - Nick de outra pessoa com senha: a senha certa dá um token novo para este aparelho; errada, 403.
 *   Muitas erradas seguidas bloqueiam o nick por alguns minutos (429).
 * - Nick de outra pessoa sem senha (contas antigas, criadas antes da senha) ou sem senha enviada:
 *   409 { error, taken: true, hasPassword }.
 */
export async function claimPlayer(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as
    | { name?: unknown; token?: unknown; password?: unknown; turnstile?: unknown }
    | null;
  const name = sanitizeName(body?.name);
  if (!name) return badRequest('Nick inválido');
  const password = typeof body?.password === 'string' && body.password !== '' ? body.password : null;

  const owner = await env.DB.prepare(
    'SELECT id, name, password_hash, failed_logins, locked_until FROM players WHERE name_key = ?',
  )
    .bind(nameKey(name))
    .first<OwnerRow>();

  if (owner) {
    if ((await accountByToken(env, body?.token))?.id === owner.id) return json({ name: owner.name, token: body?.token });
    const hasPassword = owner.password_hash !== null;
    if (!password || !owner.password_hash) {
      return json({ error: 'Esse nick já tem dono', taken: true, hasPassword }, { status: 409 });
    }
    return login(request, env, owner, password);
  }

  const problem = passwordProblem(password) ?? nickProblem(name);
  if (problem) return badRequest(problem);
  const lookalike = await lookalikeOf(env, name);
  if (lookalike) {
    return json({ error: `Parecido demais com o nick ${lookalike}. Escolha outro.`, code: 'nick_lookalike' }, { status: 409 });
  }
  if (!(await verifyTurnstile(env, body?.turnstile, request))) {
    return json({ error: 'Confirme que você não é um robô.', code: 'turnstile' }, { status: 403 });
  }
  // INSERT OR IGNORE: se duas pessoas pedirem o mesmo nick ao mesmo tempo, só uma fica com ele (name_key é UNIQUE).
  const created = await env.DB.prepare(
    'INSERT OR IGNORE INTO players (name, name_key, password_hash, created_at) VALUES (?, ?, ?, ?) RETURNING id',
  )
    .bind(name, nameKey(name), await hashPassword(password!), Date.now())
    .first<{ id: number }>();
  if (!created) return json({ error: 'Esse nick já tem dono', taken: true }, { status: 409 });

  await logAccess(env, request, 'signup', { playerId: created.id, name });
  return json({ name, token: await issueToken(env, created.id) });
}

async function login(request: Request, env: Env, owner: OwnerRow, password: string): Promise<Response> {
  if (owner.locked_until > Date.now()) {
    return json({ error: 'Muitas tentativas. Espere alguns minutos e tente de novo.' }, { status: 429 });
  }
  if (await checkPassword(password, owner.password_hash!)) {
    await env.DB.prepare('UPDATE players SET failed_logins = 0 WHERE id = ?').bind(owner.id).run();
    await logAccess(env, request, 'login', { playerId: owner.id, name: owner.name });
    return json({ name: owner.name, token: await issueToken(env, owner.id) });
  }
  // Os dois SET usam o valor antigo de failed_logins; ao bloquear, a contagem recomeça.
  await env.DB.prepare(
    `UPDATE players SET
       locked_until = CASE WHEN failed_logins + 1 >= ?1 THEN ?2 ELSE locked_until END,
       failed_logins = CASE WHEN failed_logins + 1 >= ?1 THEN 0 ELSE failed_logins + 1 END
     WHERE id = ?3`,
  )
    .bind(MAX_FAILED_LOGINS, Date.now() + LOCK_MS, owner.id)
    .run();
  await logAccess(env, request, 'login_failed', { playerId: owner.id, name: owner.name });
  return json({ error: 'Senha incorreta' }, { status: 403 });
}

/**
 * POST /api/players/password: { token, password } — cria a senha de uma conta que ainda não tem
 * (contas criadas antes da senha existir). Depois disso o dono entra com nick + senha em qualquer dispositivo.
 */
export async function setPassword(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { token?: unknown; password?: unknown } | null;
  const account = await accountByToken(env, body?.token);
  if (!account) return unauthorized();
  const problem = passwordProblem(body?.password);
  if (problem) return badRequest(problem);

  const updated = await env.DB.prepare('UPDATE players SET password_hash = ? WHERE id = ? AND password_hash IS NULL')
    .bind(await hashPassword(body!.password as string), account.id)
    .run();
  if (!updated.meta.changes) return json({ error: 'Esse nick já tem senha' }, { status: 409 });
  return json({ ok: true });
}

/**
 * POST /api/players/rename: { token, name } → { name }. Troca o nick da conta, se o novo não for de outra conta.
 * Partidas, moedas e itens seguem a conta (tudo aponta para o id). Mudar só maiúsculas/minúsculas vale.
 */
export async function renamePlayer(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { token?: unknown; name?: unknown } | null;
  const account = await accountByToken(env, body?.token);
  if (!account) return unauthorized();
  const name = sanitizeName(body?.name);
  if (!name) return badRequest('Nick inválido');
  // Só mudar maiúsculas do próprio nick não passa pelo filtro (é o mesmo nick).
  if (nameKey(name) !== nameKey(account.name)) {
    const problem = nickProblem(name);
    if (problem) return badRequest(problem);
    const lookalike = await lookalikeOf(env, name, account.id);
    if (lookalike) return json({ error: `Parecido demais com o nick ${lookalike}. Escolha outro.` }, { status: 409 });
  }

  try {
    // name_key é UNIQUE: se outra conta já usa o nick (ou pegou agora), o UPDATE falha.
    await env.DB.prepare('UPDATE players SET name = ?, name_key = ? WHERE id = ?')
      .bind(name, nameKey(name), account.id)
      .run();
  } catch (err) {
    if (String(err).includes('UNIQUE')) return json({ error: 'Esse nick já é de outra conta' }, { status: 409 });
    throw err;
  }
  return json({ name });
}
