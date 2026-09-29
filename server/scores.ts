import { badRequest, CHARACTERS_BY_ID, GAME_TTL_MS, json, LEADERBOARD_SIZE, nameKey, type Env } from './lib';
import { creditCoins, toLook } from './profile';
import { coinsForScore } from '../src/game/economy';
import { DEFAULT_MODE, isMode } from '../src/game/modes';
import { scoreGame } from '../src/game/scoring';
import type { Character } from '../src/game/types';

/** Melhor partida de cada jogador num modo (empate: quem chegou primeiro). Recebe o modo como parâmetro. */
const BEST_PER_PLAYER = `
  SELECT name_key, name, score, created_at FROM (
    SELECT name_key, name, score, created_at,
           ROW_NUMBER() OVER (PARTITION BY name_key ORDER BY score DESC, created_at ASC) AS rn
    FROM scores WHERE mode = ?
  ) WHERE rn = 1`;

/** GET /api/scores?mode=anime: top do ranking daquele modo, uma linha por jogador, com o visual equipado. */
export async function getLeaderboard(request: Request, env: Env): Promise<Response> {
  const mode = new URL(request.url).searchParams.get('mode') ?? DEFAULT_MODE;
  if (!isMode(mode)) return badRequest('Categoria inválida');

  const { results } = await env.DB.prepare(
    `SELECT b.name, b.score, b.created_at AS createdAt, p.avatar, p.name_color, p.frame
     FROM (${BEST_PER_PLAYER}) b LEFT JOIN players p ON p.name_key = b.name_key
     ORDER BY b.score DESC, b.created_at ASC LIMIT ?`,
  )
    .bind(mode, LEADERBOARD_SIZE)
    .all<{ name: string; score: number; createdAt: number; avatar: string | null; name_color: string | null; frame: string | null }>();
  return json({
    scores: results.map(({ name, score, createdAt, ...look }) => ({ name, score, createdAt, look: toLook(look) })),
  });
}

/**
 * POST /api/scores: { gameId, placements } → { score, best, isNewBest, rank, coinsEarned, coins }.
 * `placements` são os ids na ordem escolhida (posição 1 primeiro). Nick e modo vêm da partida
 * e a pontuação é recalculada aqui. `rank` é a posição do melhor resultado do jogador no modo.
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
     RETURNING character_ids, name, mode`,
  )
    .bind(body.gameId, Date.now() - GAME_TTL_MS)
    .first<{ character_ids: string; name: string; mode: string }>();
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

  const previous = await env.DB.prepare('SELECT MAX(score) AS best FROM scores WHERE mode = ? AND name_key = ?')
    .bind(game.mode, key)
    .first<{ best: number | null }>();

  const coinsEarned = coinsForScore(total);
  await env.DB.prepare(
    'INSERT INTO scores (game_id, name, name_key, mode, score, placements, coins, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(body.gameId, game.name, key, game.mode, total, JSON.stringify(placements), coinsEarned, Date.now())
    .run();
  const coins = await creditCoins(env, game.name, coinsEarned);

  const best = Math.max(total, previous?.best ?? 0);
  const better = await env.DB.prepare(`SELECT COUNT(*) AS n FROM (${BEST_PER_PLAYER}) WHERE score > ?`)
    .bind(game.mode, best)
    .first<{ n: number }>();

  return json({
    score: total,
    best,
    isNewBest: previous?.best == null || total > previous.best,
    rank: (better?.n ?? 0) + 1,
    coinsEarned,
    coins,
  });
}
