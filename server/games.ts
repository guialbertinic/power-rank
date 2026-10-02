import { loadCatalog, publicInfo } from './catalog';
import { claimDailyAttempt, dailyChallenge } from './daily';
import { badRequest, GAME_TTL_MS, json, sanitizeName, type Env } from './lib';
import { playerAccess } from './players';
import { nickProblem } from './security';
import { drawCharacters } from '../src/game/draw';
import { DEFAULT_MODE, isMode, parseDifficulty, parseGenerations, poolFor } from '../src/game/modes';
import { SLOTS } from '../src/game/scoring';
import type { Character } from '../src/game/types';

/**
 * POST /api/games: { name, token?, mode?, generations?, difficulty?, daily? } → sorteia uma partida para esse nick e devolve
 * { gameId, characterIds, characters, daily } (characters = dados públicos dos sorteados, sem `power`).
 * Nick de conta exige o token do dono; nick livre joga como convidado.
 * `daily: true`: o Desafio Diário da categoria (os mesmos personagens para todos); uma tentativa por jogador e
 * categoria (409 `daily_done` depois).
 * `generations`: filtro de gerações do modo pokemon; `difficulty`: dificuldade dos outros modos (sem ela, todos).
 * O desafio diário ignora os dois (usa todos). O ranking é um só.
 */
export async function createGame(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const body = (await request.json().catch(() => null)) as
    | { name?: unknown; token?: unknown; mode?: unknown; generations?: unknown; difficulty?: unknown; daily?: unknown }
    | null;
  const name = sanitizeName(body?.name);
  if (!name) return badRequest('Nick inválido');
  const access = await playerAccess(env, name, body?.token);
  if (!access) return json({ error: 'Nick não verificado' }, { status: 401 });
  // Contas antigas mantêm o nick; convidado com nick ofensivo não joga.
  const problem = access.kind === 'guest' ? nickProblem(name) : null;
  if (problem) return badRequest(problem);
  const mode = body?.mode ?? DEFAULT_MODE;
  if (!isMode(mode)) return badRequest('Categoria inválida');
  const generations = mode === 'pokemon' && body?.daily !== true ? parseGenerations(body?.generations) : undefined;
  if (generations === null) return badRequest('Gerações inválidas');
  const difficulty = mode !== 'pokemon' && body?.daily !== true ? parseDifficulty(body?.difficulty) : undefined;
  if (difficulty === null) return badRequest('Dificuldade inválida');
  const { active, byId } = await loadCatalog(env);
  const pool = poolFor(mode, active, { generations, difficulty });
  if (pool.length < SLOTS) return badRequest('Categoria ainda sem personagens suficientes');
  const gameId = crypto.randomUUID();

  let drawn: Character[];
  let daily: string | null = null;
  if (body?.daily === true) {
    const challenge = await dailyChallenge(env, mode, active);
    const characters = challenge?.characterIds.map((id) => byId.get(id)) ?? [];
    if (!challenge || !characters.every(Boolean)) return badRequest('Desafio de hoje indisponível');
    // A tentativa é gasta ao começar: sair no meio e pedir de novo não dá uma segunda chance.
    if (!(await claimDailyAttempt(env, challenge.day, mode, access, gameId))) {
      return json({ error: 'Você já jogou o desafio de hoje.', code: 'daily_done' }, { status: 409 });
    }
    drawn = characters as Character[];
    daily = challenge.day;
  } else {
    drawn = drawCharacters(pool, SLOTS);
  }
  const characterIds = drawn.map((c) => c.id);
  const now = Date.now();

  // Conta: grava o id (e o nick atual dela); convidado: só o nick.
  await env.DB.prepare(
    'INSERT INTO games (id, character_ids, name, player_id, mode, daily, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(gameId, JSON.stringify(characterIds), access.name, access.kind === 'account' ? access.id : null, mode, daily, now)
    .run();

  // Limpeza ocasional de partidas abandonadas.
  if (Math.random() < 0.05) {
    ctx.waitUntil(
      env.DB.prepare('DELETE FROM games WHERE submitted = 0 AND created_at < ?').bind(now - GAME_TTL_MS).run(),
    );
  }

  return json({ gameId, characterIds, characters: drawn.map(publicInfo), daily: daily !== null });
}
