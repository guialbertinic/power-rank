import { loadFeatures } from './features';
import { json, nameKey, type Env } from './lib';
import { NO_FEATURES } from '../src/game/features';

/** A rota vem do servidor local (npm run dev)? Em produção o host nunca é localhost. */
export const isLocalRequest = (request: Request) => ['localhost', '127.0.0.1'].includes(new URL(request.url).hostname);

// ---------- Limite de requisições ----------

type Limiter = 'RL_AUTH' | 'RL_PLAY' | 'RL_CASINO' | 'RL_PLINKO';

/** Rotas limitadas por IP e qual limite usam (valores em wrangler.jsonc → ratelimits). */
const RATE_LIMITED: Record<string, Limiter> = {
  'POST /api/players': 'RL_AUTH',
  'POST /api/players/rename': 'RL_AUTH',
  'POST /api/players/password': 'RL_AUTH',
  'POST /api/players/delete': 'RL_AUTH',
  'POST /api/players/change-password': 'RL_AUTH',
  'POST /api/players/logout-all': 'RL_AUTH',
  'POST /api/reports': 'RL_AUTH',
  'POST /api/games': 'RL_PLAY',
  'POST /api/scores': 'RL_PLAY',
  'POST /api/party': 'RL_PLAY',
  'POST /api/slots/spin': 'RL_CASINO',
  'POST /api/plinko/drop': 'RL_PLINKO',
  'POST /api/scratch/buy': 'RL_CASINO',
  'POST /api/gacha/open': 'RL_CASINO',
  'POST /api/shop/buy': 'RL_CASINO',
  // Auto Battle: começar e lutar no limite das partidas; loja da run (cliques em sequência) no limite maior.
  'POST /api/autobattle/start': 'RL_PLAY',
  'POST /api/autobattle/battle': 'RL_PLAY',
  'POST /api/autobattle/buy': 'RL_PLINKO',
  'POST /api/autobattle/sell': 'RL_PLINKO',
  'POST /api/autobattle/move': 'RL_PLINKO',
  'POST /api/autobattle/reroll': 'RL_PLINKO',
};

/**
 * Devolve 429 se o IP passou do limite da rota; null se pode seguir. No dev local não limita (os testes e2e
 * fazem dezenas de requisições seguidas), a não ser com o cabeçalho `x-rate-limit-test: 1`, usado no teste do limite.
 */
export async function rateLimit(request: Request, env: Env, route: string): Promise<Response | null> {
  const name = RATE_LIMITED[route];
  const limiter = name && env[name];
  if (!limiter) return null;
  if (isLocalRequest(request) && request.headers.get('x-rate-limit-test') !== '1') return null;
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
  const { success } = await limiter.limit({ key: `${name}:${ip}` });
  if (success) return null;
  return json(
    { error: 'Muitas tentativas seguidas. Espere um minuto e tente de novo.', code: 'rate_limited' },
    { status: 429, headers: { 'Retry-After': '60' } },
  );
}

// ---------- Turnstile (anti-bot na criação de conta) ----------

/** Turnstile ligado = as duas chaves configuradas (no dev, pelo .dev.vars; em produção, var + secret). */
export const turnstileEnabled = (env: Env) => Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET);

/** Confere o token do widget com a Cloudflare. Desligado (sem chaves) = sempre passa. */
export async function verifyTurnstile(env: Env, token: unknown, request: Request): Promise<boolean> {
  if (!turnstileEnabled(env)) return true;
  if (typeof token !== 'string' || !token) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET!);
  form.append('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) form.append('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

/**
 * GET /api/config → { turnstileSiteKey, features }: chave do widget anti-bot (null = desligado) e as chaves dos
 * minigames. Se a leitura das chaves falhar (ex: migração ainda não aplicada), vão todas desligadas: a criação de
 * conta (que depende desta rota) não pode quebrar por causa delas.
 */
export async function getConfig(env: Env): Promise<Response> {
  const features = await loadFeatures(env).catch((err) => {
    console.error('features', err);
    return NO_FEATURES;
  });
  return json({ turnstileSiteKey: turnstileEnabled(env) ? env.TURNSTILE_SITE_KEY : null, features });
}

// ---------- Nicks ----------

/** Troca letras "disfarçadas" (4→a, 3→e, 0→o, $→s...) e tira acentos e símbolos, para achar palavrões escondidos. */
function unleet(name: string): string {
  const map: Record<string, string> = { '4': 'a', '@': 'a', '3': 'e', '1': 'i', '!': 'i', '|': 'i', '0': 'o', '5': 's', $: 's', '7': 't' };
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[4@3105$!|7]/g, (ch) => map[ch])
    .replace(/[^a-z]/g, '');
}

/** Ofensas sem ambiguidade: bloqueadas em qualquer parte do nick (inclusive grudadas em outras palavras). */
const BLOCKED_ANYWHERE = [
  // inglês
  'fuck', 'shit', 'cunt', 'nigger', 'nigga', 'faggot', 'whore', 'pussy', 'bitch', 'retard', 'hitler', 'rapist',
  'pedophil', 'molest',
  // português
  'caralho', 'buceta', 'boceta', 'porra', 'viado', 'arrombad', 'cuzao', 'cuzinho', 'piroca', 'xoxota', 'xereca',
  'vagabund', 'desgracad', 'filhodaput', 'punheta', 'siririca', 'estupr', 'pedofil', 'nazist', 'macaquit',
];

/** Palavras curtas que aparecem dentro de palavras normais: bloqueadas só quando são o nick inteiro ou uma parte separada. */
const BLOCKED_WORDS = ['puta', 'bosta', 'merda', 'foda', 'fdp', 'vsf', 'tnc', 'pqp', 'cu', 'dick', 'cock', 'anal', 'rape', 'porn', 'nazi', 'cum'];

/** Motivo para recusar um nick novo (conta nova, troca de nick, convidado); null = pode. Nicks antigos não mudam. */
export function nickProblem(name: string): string | null {
  const squashed = unleet(name);
  const words = name
    .split(/[\s._\-]+/)
    .map(unleet)
    .filter(Boolean);
  const offensive =
    BLOCKED_ANYWHERE.some((w) => squashed.includes(w)) ||
    BLOCKED_WORDS.some((w) => squashed === w || words.includes(w));
  return offensive ? 'Esse nick não é permitido. Escolha outro.' : null;
}

/**
 * "Esqueleto" do nick para achar imitações de outra conta ("AIbertini" x "Albertini", "N4ruto" não entra aqui):
 * i/l/1 viram "l", 0 vira "o" e separadores somem. Aplicado sobre o `name_key` (já minúsculo), igual em JS e SQL.
 */
const SKELETON_REPLACEMENTS: [string, string][] = [
  ['i', 'l'],
  ['1', 'l'],
  ['|', 'l'],
  ['0', 'o'],
  [' ', ''],
  ['_', ''],
  ['-', ''],
  ['.', ''],
];

export function nickSkeleton(name: string): string {
  return SKELETON_REPLACEMENTS.reduce((s, [from, to]) => s.split(from).join(to), nameKey(name));
}

/** A mesma transformação em SQL, sobre a coluna `name_key`. */
export const SQL_SKELETON = SKELETON_REPLACEMENTS.reduce(
  (expr, [from, to]) => `replace(${expr}, '${from}', '${to}')`,
  'name_key',
);

/** Nome da conta (outra, que não `exceptId`) cujo nick é parecido demais com este; null se não há. */
export async function lookalikeOf(env: Env, name: string, exceptId: number | null = null): Promise<string | null> {
  const row = await env.DB.prepare(
    `SELECT name FROM players WHERE ${SQL_SKELETON} = ? AND name_key != ? AND (? IS NULL OR id != ?) LIMIT 1`,
  )
    .bind(nickSkeleton(name), nameKey(name), exceptId, exceptId)
    .first<{ name: string }>();
  return row?.name ?? null;
}

// ---------- Placar honesto ----------

/** Menor tempo possível para posicionar 10 personagens de verdade. Abaixo disso, a partida é recusada. */
export const MIN_GAME_MS = 3000;
