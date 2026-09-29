import { badRequest, CHARACTERS, GAME_TTL_MS, json, sanitizeName, type Env } from './lib';
import { drawCharacters } from '../src/game/draw';
import { SLOTS } from '../src/game/scoring';

/** POST /api/games: { name } → sorteia uma partida para esse nick e devolve { gameId, characterIds }. */
export async function createGame(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const name = sanitizeName(body?.name);
  if (!name) return badRequest('Nick inválido');

  const gameId = crypto.randomUUID();
  const characterIds = drawCharacters(CHARACTERS, SLOTS).map((c) => c.id);
  const now = Date.now();

  await env.DB.prepare('INSERT INTO games (id, character_ids, name, created_at) VALUES (?, ?, ?, ?)')
    .bind(gameId, JSON.stringify(characterIds), name, now)
    .run();

  // Limpeza ocasional de partidas abandonadas.
  if (Math.random() < 0.05) {
    ctx.waitUntil(
      env.DB.prepare('DELETE FROM games WHERE submitted = 0 AND created_at < ?').bind(now - GAME_TTL_MS).run(),
    );
  }

  return json({ gameId, characterIds });
}
