import { loadCatalog } from './catalog';
import { MIN_GAME_MS } from './security';
import { badRequest, GAME_TTL_MS, json, LEADERBOARD_SIZE, nameKey, type Env } from './lib';
import { creditCoins, toLook } from './profile';
import { coinsForScore } from '../src/game/economy';
import { DEFAULT_MODE, isMode } from '../src/game/modes';
import { scoreGame, strengthRanks } from '../src/game/scoring';
import type { Character } from '../src/game/types';

/** Dia do ranking "Hoje": horário de Brasília (UTC−3, sem horário de verão). */
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Início do dia de hoje em Brasília, em epoch ms. */
export const startOfToday = (now = Date.now()) => Math.floor((now - BRT_OFFSET_MS) / DAY_MS) * DAY_MS + BRT_OFFSET_MS;
/** Mesmo dia em SQL (created_at em ms → data de Brasília). */
const SQL_DAY = `date(created_at / 1000 - ${BRT_OFFSET_MS / 1000}, 'unixepoch')`;
/** Partidas sem tempo (antigas) ficam atrás no desempate. */
const SQL_DURATION = 'COALESCE(duration_ms, 9000000000000000)';

export type Period = 'today' | 'total';
const isPeriod = (value: unknown): value is Period => value === 'today' || value === 'total';

/**
 * "Hoje": melhor partida de cada conta desde o início do dia (parâmetros: modo, início do dia).
 * Empate: menor tempo, depois quem fez primeiro. Só contas: partidas de convidados (player_id NULL) ficam
 * gravadas, mas não entram no ranking. A conta segue a mesma depois de trocar de nick.
 */
const BEST_TODAY = `
  SELECT player_id, score, duration_ms, created_at FROM (
    SELECT player_id, score, duration_ms, created_at,
           ROW_NUMBER() OVER (
             PARTITION BY player_id ORDER BY score DESC, ${SQL_DURATION} ASC, created_at ASC
           ) AS rn
    FROM scores WHERE mode = ? AND player_id IS NOT NULL AND created_at >= ?
  ) WHERE rn = 1`;

/**
 * "Acumulado": soma do melhor resultado de cada dia (máx. 1000 por dia: premia constância, não volume).
 * Empate: quem precisou de menos dias. Parâmetro: modo.
 */
const TOTAL = `
  SELECT player_id, SUM(best) AS score, COUNT(*) AS days FROM (
    SELECT player_id, MAX(score) AS best FROM scores
    WHERE mode = ? AND player_id IS NOT NULL
    GROUP BY player_id, ${SQL_DAY}
  ) GROUP BY player_id`;

interface LeaderboardRow {
  name: string;
  score: number;
  duration_ms: number | null;
  days: number | null;
  avatar: string | null;
  name_color: string | null;
  frame: string | null;
  title: string | null;
}

/**
 * GET /api/scores?mode=anime&period=today|total: top do ranking, uma linha por conta (com o nick atual e o
 * visual equipado). "today" traz o tempo da partida (`durationMs`); "total", quantos dias somaram (`days`).
 */
export async function getLeaderboard(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const mode = params.get('mode') ?? DEFAULT_MODE;
  if (!isMode(mode)) return badRequest('Categoria inválida');
  const period = params.get('period') ?? 'today';
  if (!isPeriod(period)) return badRequest('Período inválido');

  const look = 'p.name, p.avatar, p.name_color, p.frame, p.title';
  const query =
    period === 'today'
      ? env.DB.prepare(
          `SELECT ${look}, b.score, b.duration_ms, NULL AS days
           FROM (${BEST_TODAY}) b JOIN players p ON p.id = b.player_id
           ORDER BY b.score DESC, ${SQL_DURATION.replace('duration_ms', 'b.duration_ms')} ASC, b.created_at ASC
           LIMIT ?`,
        ).bind(mode, startOfToday(), LEADERBOARD_SIZE)
      : env.DB.prepare(
          `SELECT ${look}, t.score, NULL AS duration_ms, t.days
           FROM (${TOTAL}) t JOIN players p ON p.id = t.player_id
           ORDER BY t.score DESC, t.days ASC, t.player_id ASC
           LIMIT ?`,
        ).bind(mode, LEADERBOARD_SIZE);

  const { results } = await query.all<LeaderboardRow>();
  return json({
    scores: results.map(({ name, score, duration_ms, days, ...look }) => ({
      name,
      score,
      ...(duration_ms !== null ? { durationMs: duration_ms } : {}),
      ...(days !== null ? { days } : {}),
      look: toLook(look),
    })),
  });
}

/**
 * POST /api/scores: { gameId, placements } → { score, durationMs, best, isNewBest, rank, coinsEarned, coins }.
 * `placements` são os ids na ordem escolhida (posição 1 primeiro). Nick e modo vêm da partida
 * e a pontuação é recalculada aqui. `best`/`isNewBest`/`rank` são do ranking de hoje.
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
     RETURNING character_ids, name, player_id, mode, created_at`,
  )
    .bind(body.gameId, Date.now() - GAME_TTL_MS)
    .first<{ character_ids: string; name: string; player_id: number | null; mode: string; created_at: number }>();
  if (!game) return badRequest('Partida inexistente, expirada ou já enviada');

  const drawn: string[] = JSON.parse(game.character_ids);
  const samePlayers =
    placements.length === drawn.length &&
    new Set(placements).size === drawn.length &&
    placements.every((id) => drawn.includes(id));
  if (!samePlayers) return badRequest('placements não corresponde à partida');

  // O catálogo guarda também os inativos: partida sorteada antes de um personagem sair continua valendo.
  const { byId } = await loadCatalog(env);
  const slots = placements.map((id) => byId.get(id));
  if (slots.some((c) => !c)) return badRequest('Personagem desconhecido');

  const { total } = scoreGame(slots as Character[]);
  // O site recebe a ordem correta (quantos são mais fortes que cada um), nunca o valor de `power`.
  const ranks = strengthRanks(slots as Character[]);
  const key = nameKey(game.name);
  const playerId = game.player_id;
  const now = Date.now();
  // Do sorteio ao envio, medido aqui (o cliente não informa tempo).
  const durationMs = now - game.created_at;
  // Ninguém posiciona 10 personagens em menos de alguns segundos: é script. A partida já foi consumida.
  if (durationMs < MIN_GAME_MS) return json({ error: 'Partida rápida demais para valer.', code: 'too_fast' }, { status: 400 });
  const insert = (coins: number) =>
    env.DB.prepare(
      `INSERT INTO scores (game_id, name, name_key, player_id, mode, score, placements, coins, duration_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(body.gameId, game.name, key, playerId, game.mode, total, JSON.stringify(placements), coins, durationMs, now)
      .run();

  // Convidado (partida sem conta): a partida fica gravada, mas não entra no ranking nem rende moedas.
  if (playerId === null) {
    await insert(0);
    return json({ score: total, ranks, durationMs, best: total, isNewBest: false, rank: null, coinsEarned: 0, coins: null });
  }

  const today = startOfToday(now);
  const previous = await env.DB.prepare('SELECT MAX(score) AS best FROM scores WHERE mode = ? AND player_id = ? AND created_at >= ?')
    .bind(game.mode, playerId, today)
    .first<{ best: number | null }>();

  const coinsEarned = coinsForScore(total);
  await insert(coinsEarned);
  const coins = await creditCoins(env, playerId, coinsEarned);

  // Posição no ranking de hoje: quem tem mais pontos, ou os mesmos pontos em menos tempo, fica na frente.
  const mine = await env.DB.prepare(`SELECT score, ${SQL_DURATION} AS duration FROM (${BEST_TODAY}) WHERE player_id = ?`)
    .bind(game.mode, today, playerId)
    .first<{ score: number; duration: number }>();
  const best = mine?.score ?? total;
  const ahead = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM (${BEST_TODAY}) WHERE score > ? OR (score = ? AND ${SQL_DURATION} < ?)`,
  )
    .bind(game.mode, today, best, best, mine?.duration ?? durationMs)
    .first<{ n: number }>();

  return json({
    score: total,
    ranks,
    durationMs,
    best,
    isNewBest: previous?.best == null || total > previous.best,
    rank: (ahead?.n ?? 0) + 1,
    coinsEarned,
    coins,
  });
}
