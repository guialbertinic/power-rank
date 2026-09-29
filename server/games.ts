import { loadCatalog, publicInfo } from './catalog';
import { badRequest, GAME_TTL_MS, json, sanitizeName, type Env } from './lib';
import { playerAccess } from './players';
import { nickProblem } from './security';
import { drawCharacters } from '../src/game/draw';
import { DEFAULT_MODE, isMode, poolFor } from '../src/game/modes';
import { SLOTS } from '../src/game/scoring';

/**
 * POST /api/games: { name, token?, mode? } → sorteia uma partida para esse nick e devolve
 * { gameId, characterIds, characters } (characters = dados públicos dos sorteados, sem `power`).
 * Nick de conta exige o token do dono; nick livre joga como convidado.
 */
export async function createGame(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { name?: unknown; token?: unknown; mode?: unknown } | null;
  const name = sanitizeName(body?.name);
  if (!name) return badRequest('Nick inválido');
  const access = await playerAccess(env, name, body?.token);
  if (!access) return json({ error: 'Nick não verificado' }, { status: 401 });
  // Contas antigas mantêm o nick; convidado com nick ofensivo não joga.
  const problem = access.kind === 'guest' ? nickProblem(name) : null;
  if (problem) return badRequest(problem);
  const mode = body?.mode ?? DEFAULT_MODE;
  if (!isMode(mode)) return badRequest('Categoria inválida');

  const pool = poolFor(mode, (await loadCatalog(env)).active);
  if (pool.length < SLOTS) return badRequest('Categoria ainda sem personagens suficientes');

  const gameId = crypto.randomUUID();
  const drawn = drawCharacters(pool, SLOTS);
  const characterIds = drawn.map((c) => c.id);
  const now = Date.now();

  // Conta: grava o id (e o nick atual dela); convidado: só o nick.
  await env.DB.prepare('INSERT INTO games (id, character_ids, name, player_id, mode, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(gameId, JSON.stringify(characterIds), access.name, access.kind === 'account' ? access.id : null, mode, now)
    .run();

  // Limpeza ocasional de partidas abandonadas.
  if (Math.random() < 0.05) {
    ctx.waitUntil(
      env.DB.prepare('DELETE FROM games WHERE submitted = 0 AND created_at < ?').bind(now - GAME_TTL_MS).run(),
    );
  }

  return json({ gameId, characterIds, characters: drawn.map(publicInfo) });
}
