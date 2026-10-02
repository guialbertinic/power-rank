import { logAccess } from './access';
import { loadCatalog } from './catalog';
import { MIN_GAME_MS } from './security';
import { badRequest, GAME_TTL_MS, json, LEADERBOARD_SIZE, nameKey, type Env } from './lib';
import { recordGame } from './achievements';
import { creditCoins, toLook } from './profile';
import { dayKey } from '../src/game/daily';
import { coinsForScore } from '../src/game/economy';
import { DEFAULT_MODE, isMode } from '../src/game/modes';
import { scoreGame, strengthRanks } from '../src/game/scoring';
import type { Character } from '../src/game/types';

/** Partidas sem tempo (antigas) ficam atrás no desempate. */
const SQL_DURATION = 'COALESCE(duration_ms, 9000000000000000)';

/** O ranking é só do Desafio Diário: o de hoje ("daily") e a soma de todos ("total"). Partida solo não entra. */
export type Period = 'daily' | 'total';
const isPeriod = (value: unknown): value is Period => value === 'daily' || value === 'total';

/**
 * "Acumulado": soma dos desafios diários da categoria (um por dia: premia constância). Empate: quem precisou de
 * menos dias. Só contas: convidados jogam, mas não entram no ranking. Parâmetro: modo.
 */
const TOTAL = `
  SELECT player_id, SUM(score) AS score, COUNT(*) AS days FROM scores
  WHERE mode = ? AND daily IS NOT NULL AND player_id IS NOT NULL
  GROUP BY player_id`;

/**
 * "Desafio": a partida de cada conta no desafio do dia da categoria (uma só por conta). Empate: menor tempo, depois
 * quem fez primeiro. A conta segue a mesma depois de trocar de nick. Parâmetros: dia (AAAA-MM-DD), modo.
 */
const DAILY = `
  SELECT player_id, score, duration_ms, created_at FROM scores
  WHERE daily = ? AND mode = ? AND player_id IS NOT NULL`;

interface LeaderboardRow {
  name: string;
  score: number;
  duration_ms: number | null;
  days: number | null;
  avatar: string | null;
  name_color: string | null;
  frame: string | null;
  title: string | null;
  badge: string | null;
}

/**
 * GET /api/scores?mode=anime&period=daily|total: top do ranking, uma linha por conta (com o nick atual e o
 * visual equipado). "daily" (padrão): o Desafio Diário de hoje da categoria, com o tempo (`durationMs`);
 * "total": a soma dos desafios, com quantos dias somaram (`days`).
 */
export async function getLeaderboard(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const mode = params.get('mode') ?? DEFAULT_MODE;
  if (!isMode(mode)) return badRequest('Categoria inválida');
  const period = params.get('period') ?? 'daily';
  if (!isPeriod(period)) return badRequest('Período inválido');

  const look = 'p.name, p.avatar, p.name_color, p.frame, p.title, p.badge';
  // Conta suspensa some do ranking enquanto durar a suspensão (número inteiro: seguro no SQL).
  const notBanned = `p.banned_until <= ${Date.now()}`;
  const query =
    period === 'daily'
      ? env.DB.prepare(
          `SELECT ${look}, b.score, b.duration_ms, NULL AS days
           FROM (${DAILY}) b JOIN players p ON p.id = b.player_id
           WHERE ${notBanned}
           ORDER BY b.score DESC, ${SQL_DURATION.replace('duration_ms', 'b.duration_ms')} ASC, b.created_at ASC
           LIMIT ?`,
        ).bind(dayKey(), mode, LEADERBOARD_SIZE)
      : env.DB.prepare(
          `SELECT ${look}, t.score, NULL AS duration_ms, t.days
           FROM (${TOTAL}) t JOIN players p ON p.id = t.player_id
           WHERE ${notBanned}
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
 * POST /api/scores: { gameId, placements } → { score, ranks, durationMs, rank, daily, coinsEarned, coins, achievements }.
 * `placements` são os ids na ordem escolhida (posição 1 primeiro). Nick e modo vêm da partida
 * e a pontuação é recalculada aqui. `rank` = posição no ranking do Desafio Diário (null em partida solo ou
 * de convidado, que não entram no ranking). `achievements` = conquistas desbloqueadas por esta partida.
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
     RETURNING character_ids, name, player_id, mode, daily, created_at`,
  )
    .bind(body.gameId, Date.now() - GAME_TTL_MS)
    .first<{
      character_ids: string;
      name: string;
      player_id: number | null;
      mode: string;
      daily: string | null;
      created_at: number;
    }>();
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
  await logAccess(env, request, 'score', { playerId, name: game.name });
  if (durationMs < MIN_GAME_MS) return json({ error: 'Partida rápida demais para valer.', code: 'too_fast' }, { status: 400 });
  const insert = (coins: number) =>
    env.DB.prepare(
      `INSERT INTO scores (game_id, name, name_key, player_id, mode, score, placements, coins, duration_ms, daily, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(body.gameId, game.name, key, playerId, game.mode, total, JSON.stringify(placements), coins, durationMs, game.daily, now)
      .run();

  // Convidado (partida sem conta): a partida fica gravada, mas não entra no ranking nem rende moedas.
  if (playerId === null) {
    await insert(0);
    return json({ score: total, ranks, durationMs, rank: null, daily: game.daily !== null, coinsEarned: 0, coins: null, achievements: [] });
  }

  const coinsEarned = coinsForScore(total);
  await insert(coinsEarned);
  const coins = await creditCoins(env, playerId, coinsEarned);
  // Conquistas: o aviso aparece no resultado (já conta como visto). Falha aqui não derruba o envio da pontuação.
  const achievements = await recordGame(env, playerId, { mode: game.mode, score: total, daily: game.daily }, true).catch(
    (err: unknown) => {
      console.error('conquistas: falha ao gravar', err);
      return [] as string[];
    },
  );

  // Desafio Diário: posição no ranking do desafio (quem tem mais pontos, ou os mesmos em menos tempo, fica na frente).
  let rank: number | null = null;
  if (game.daily !== null) {
    const ahead = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM (${DAILY}) WHERE score > ? OR (score = ? AND ${SQL_DURATION} < ?)`,
    )
      .bind(game.daily, game.mode, total, total, durationMs)
      .first<{ n: number }>();
    rank = (ahead?.n ?? 0) + 1;
  }

  return json({ score: total, ranks, durationMs, rank, daily: game.daily !== null, coinsEarned, coins, achievements });
}
