import { badRequest, json, nameKey, sanitizeName, type Env } from './lib';
import { playerAccess, type Access } from './players';
import { dayKey } from './scores';
import { drawCharacters } from '../src/game/draw';
import { isMode, poolFor, type Mode } from '../src/game/modes';
import { SLOTS } from '../src/game/scoring';
import type { Character } from '../src/game/types';

export interface DailyChallenge {
  day: string;
  characterIds: string[];
}

/**
 * Desafio do dia de uma categoria: sorteado na primeira vez que alguém o pede e fixo dali em diante. Se dois
 * pedidos chegarem juntos, o INSERT OR IGNORE garante que fica valendo um só (os dois leem o mesmo em seguida).
 */
export async function dailyChallenge(
  env: Env,
  mode: Mode,
  active: Character[],
  day = dayKey(),
): Promise<DailyChallenge | null> {
  const read = () =>
    env.DB.prepare('SELECT character_ids FROM daily_challenges WHERE day = ? AND mode = ?')
      .bind(day, mode)
      .first<{ character_ids: string }>();
  let row = await read();
  if (!row) {
    const pool = poolFor(mode, active);
    if (pool.length < SLOTS) return null;
    const ids = drawCharacters(pool, SLOTS).map((c) => c.id);
    await env.DB.prepare('INSERT OR IGNORE INTO daily_challenges (day, mode, character_ids, created_at) VALUES (?, ?, ?, ?)')
      .bind(day, mode, JSON.stringify(ids), Date.now())
      .run();
    row = await read();
    if (!row) return null;
  }
  return { day, characterIds: JSON.parse(row.character_ids) };
}

/** Quem gasta a tentativa do dia: a conta (mesmo trocando de nick) ou, para convidado, o nick. */
export const dailyPlayerKey = (access: Access) => (access.kind === 'account' ? `p:${access.id}` : `g:${nameKey(access.name)}`);

/**
 * Gasta a tentativa do dia nesta categoria para esta partida. false = o jogador já começou o desafio dela hoje.
 * Chave primária (dia, modo, jogador): dois pedidos juntos não passam os dois.
 */
export async function claimDailyAttempt(env: Env, day: string, mode: Mode, access: Access, gameId: string): Promise<boolean> {
  const { meta } = await env.DB.prepare(
    'INSERT OR IGNORE INTO daily_attempts (day, mode, player_key, game_id, created_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(day, mode, dailyPlayerKey(access), gameId, Date.now())
    .run();
  return meta.changes > 0;
}

/**
 * POST /api/daily { name, token?, mode } → { day, done, score }: se o jogador já jogou o desafio de hoje da
 * categoria (`score` = pontuação dele, ou null se começou e não terminou).
 */
export async function dailyStatus(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { name?: unknown; token?: unknown; mode?: unknown } | null;
  const name = sanitizeName(body?.name);
  if (!name) return badRequest('Nick inválido');
  const mode = body?.mode;
  if (!isMode(mode)) return badRequest('Categoria inválida');
  const access = await playerAccess(env, name, body?.token);
  if (!access) return json({ error: 'Nick não verificado' }, { status: 401 });
  const day = dayKey();
  const attempt = await env.DB.prepare(
    `SELECT s.score FROM daily_attempts a LEFT JOIN scores s ON s.game_id = a.game_id
     WHERE a.day = ? AND a.mode = ? AND a.player_key = ?`,
  )
    .bind(day, mode, dailyPlayerKey(access))
    .first<{ score: number | null }>();
  return json({ day, done: attempt !== null, score: attempt?.score ?? null });
}
