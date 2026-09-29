import { CHARACTERS, GAME_TTL_MS, json, type Env } from './lib';
import { drawCharacters } from '../src/game/draw';
import { SLOTS } from '../src/game/scoring';

/** POST /api/games: sorteia uma partida e devolve { gameId, characterIds }. */
export async function createGame(env: Env, ctx: ExecutionContext): Promise<Response> {
  const gameId = crypto.randomUUID();
  const characterIds = drawCharacters(CHARACTERS, SLOTS).map((c) => c.id);
  const now = Date.now();

  await env.DB.prepare('INSERT INTO games (id, character_ids, created_at) VALUES (?, ?, ?)')
    .bind(gameId, JSON.stringify(characterIds), now)
    .run();

  // Limpeza ocasional de partidas abandonadas.
  if (Math.random() < 0.05) {
    ctx.waitUntil(
      env.DB.prepare('DELETE FROM games WHERE submitted = 0 AND created_at < ?').bind(now - GAME_TTL_MS).run(),
    );
  }

  return json({ gameId, characterIds });
}
