import { badRequest, CHARACTERS, GAME_TTL_MS, json, sanitizeName, type Env } from './lib';
import { playerAccess } from './players';
import { drawCharacters } from '../src/game/draw';
import { DEFAULT_MODE, isMode, poolFor } from '../src/game/modes';
import { SLOTS } from '../src/game/scoring';

/**
 * POST /api/games: { name, token?, mode? } → sorteia uma partida para esse nick e devolve { gameId, characterIds }.
 * Nick de conta exige o token do dono; nick livre joga como convidado.
 */
export async function createGame(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { name?: unknown; token?: unknown; mode?: unknown } | null;
  const name = sanitizeName(body?.name);
  if (!name) return badRequest('Nick inválido');
  const access = await playerAccess(env, name, body?.token);
  if (!access) return json({ error: 'Nick não verificado' }, { status: 401 });
  const mode = body?.mode ?? DEFAULT_MODE;
  if (!isMode(mode)) return badRequest('Categoria inválida');

  const pool = poolFor(mode, CHARACTERS);
  if (pool.length < SLOTS) return badRequest('Categoria ainda sem personagens suficientes');

  const gameId = crypto.randomUUID();
  const characterIds = drawCharacters(pool, SLOTS).map((c) => c.id);
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

  return json({ gameId, characterIds });
}
