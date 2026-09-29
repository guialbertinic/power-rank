import { badRequest, CHARACTERS_BY_ID, GAME_TTL_MS, json, LEADERBOARD_SIZE, nameKey, type Env } from './lib';
import { scoreGame } from '../src/game/scoring';
import type { Character } from '../src/game/types';

/** Melhor partida de cada jogador (empate: quem chegou primeiro). */
const BEST_PER_PLAYER = `
  SELECT name_key, name, score, created_at FROM (
    SELECT name_key, name, score, created_at,
           ROW_NUMBER() OVER (PARTITION BY name_key ORDER BY score DESC, created_at ASC) AS rn
    FROM scores
  ) WHERE rn = 1`;

/** GET /api/scores: top do ranking global, uma linha por jogador. */
export async function getLeaderboard(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT name, score, created_at AS createdAt FROM (${BEST_PER_PLAYER})
     ORDER BY score DESC, created_at ASC LIMIT ?`,
  )
    .bind(LEADERBOARD_SIZE)
    .all();
  return json({ scores: results });
}

/**
 * POST /api/scores: { gameId, placements } → { score, best, isNewBest, rank }.
 * `placements` são os ids na ordem escolhida (posição 1 primeiro). O nick vem da partida
 * e a pontuação é recalculada aqui. `rank` é a posição do melhor resultado do jogador.
 */
export async function submitScore(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { gameId?: unknown; placements?: unknown } | null;
  if (!body) return badRequest('JSON inválido');
  if (typeof body.gameId !== 'string') return badRequest('gameId inválido');
  if (!Array.isArray(body.placements) || !body.placements.every((id) => typeof id === 'string')) {
    return badRequest('placements inválido');
  }
  const placements = body.placements as string[];

  // Marca a partida como usada de forma atômica: só um envio por partida.
  const game = await env.DB.prepare(
    `UPDATE games SET submitted = 1
     WHERE id = ? AND submitted = 0 AND created_at > ? AND name IS NOT NULL
     RETURNING character_ids, name`,
  )
    .bind(body.gameId, Date.now() - GAME_TTL_MS)
    .first<{ character_ids: string; name: string }>();
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
  const key = nameKey(game.name);

  const previous = await env.DB.prepare('SELECT MAX(score) AS best FROM scores WHERE name_key = ?')
    .bind(key)
    .first<{ best: number | null }>();

  await env.DB.prepare(
    'INSERT INTO scores (game_id, name, name_key, score, placements, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(body.gameId, game.name, key, total, JSON.stringify(placements), Date.now())
    .run();

  const best = Math.max(total, previous?.best ?? 0);
  const better = await env.DB.prepare(`SELECT COUNT(*) AS n FROM (${BEST_PER_PLAYER}) WHERE score > ?`)
    .bind(best)
    .first<{ n: number }>();

  return json({
    score: total,
    best,
    isNewBest: previous?.best == null || total > previous.best,
    rank: (better?.n ?? 0) + 1,
  });
}
