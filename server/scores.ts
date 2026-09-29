import {
  badRequest,
  CHARACTERS_BY_ID,
  GAME_TTL_MS,
  json,
  LEADERBOARD_SIZE,
  sanitizeName,
  type Env,
} from './lib';
import { scoreGame } from '../src/game/scoring';
import type { Character } from '../src/game/types';

/** GET /api/scores: top do ranking global. */
export async function getLeaderboard(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT name, score, created_at AS createdAt FROM scores ORDER BY score DESC, created_at ASC LIMIT ?',
  )
    .bind(LEADERBOARD_SIZE)
    .all();
  return json({ scores: results });
}

/**
 * POST /api/scores: { gameId, name, placements } → { score, rank }.
 * `placements` são os ids na ordem escolhida (posição 1 primeiro). A pontuação é recalculada aqui.
 */
export async function submitScore(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    gameId?: unknown;
    name?: unknown;
    placements?: unknown;
  } | null;
  if (!body) return badRequest('JSON inválido');

  const name = sanitizeName(body.name);
  if (!name) return badRequest('Nome inválido');
  if (typeof body.gameId !== 'string') return badRequest('gameId inválido');
  if (!Array.isArray(body.placements) || !body.placements.every((id) => typeof id === 'string')) {
    return badRequest('placements inválido');
  }
  const placements = body.placements as string[];

  // Marca a partida como usada de forma atômica: só um envio por partida.
  const game = await env.DB.prepare(
    'UPDATE games SET submitted = 1 WHERE id = ? AND submitted = 0 AND created_at > ? RETURNING character_ids',
  )
    .bind(body.gameId, Date.now() - GAME_TTL_MS)
    .first<{ character_ids: string }>();
  if (!game) return badRequest('Partida inexistente, expirada ou já enviada');

  const drawn: string[] = JSON.parse(game.character_ids);
  const samePlayers =
    placements.length === drawn.length &&
    new Set(placements).size === drawn.length &&
    placements.every((id) => drawn.includes(id));
  if (!samePlayers) return badRequest('placements não corresponde à partida');

  // Um personagem removido do JSON depois do sorteio invalida a partida.
  const slots = placements.map((id) => CHARACTERS_BY_ID.get(id));
  if (slots.some((c) => !c)) return badRequest('Personagem desconhecido');

  const { total } = scoreGame(slots as Character[]);
  const now = Date.now();

  await env.DB.prepare(
    'INSERT INTO scores (game_id, name, score, placements, created_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(body.gameId, name, total, JSON.stringify(placements), now)
    .run();

  const better = await env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE score > ?')
    .bind(total)
    .first<{ n: number }>();

  return json({ score: total, rank: (better?.n ?? 0) + 1 });
}
