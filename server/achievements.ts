import {
  ACHIEVEMENTS,
  ECLECTIC_MIN_SCORE,
  reachedAchievements,
  type AchievementsState,
  type AchievementStats,
} from '../src/game/achievements';
import { dayKey } from '../src/game/daily';
import { json, type Env } from './lib';
import { authenticate } from './profile';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Dia anterior a uma chave 'AAAA-MM-DD'. */
const previousDay = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);

interface StatsRow {
  games: number;
  best_score: number;
  daily_streak: number;
  daily_last: string | null;
  party_wins: number;
  modes_700: string;
}

const STATS_COLUMNS = 'games, best_score, daily_streak, daily_last, party_wins, modes_700';

/** Sequência só vale se o último desafio foi hoje ou ontem; senão já quebrou (mostra 0). */
function toStats(row: StatsRow | null, today = dayKey()): AchievementStats {
  if (!row) return { games: 0, bestScore: 0, dailyStreak: 0, partyWins: 0, modes700: 0 };
  const alive = row.daily_last === today || row.daily_last === previousDay(today);
  return {
    games: row.games,
    bestScore: row.best_score,
    dailyStreak: alive ? row.daily_streak : 0,
    partyWins: row.party_wins,
    modes700: row.modes_700.split(',').filter(Boolean).length,
  };
}

/**
 * Grava as conquistas alcançadas (e o item de cada uma) que a conta ainda não tem. Devolve as novas.
 * `seen`: o jogador já vê o aviso agora (resultado do solo); a party avisa depois, na home.
 */
async function unlock(env: Env, playerId: number, stats: AchievementStats, seen: boolean): Promise<string[]> {
  const reached = reachedAchievements(stats);
  if (!reached.length) return [];
  const { results } = await env.DB.prepare('SELECT achievement_id FROM player_achievements WHERE player_id = ?')
    .bind(playerId)
    .all<{ achievement_id: string }>();
  const have = new Set(results.map((r) => r.achievement_id));
  const missing = reached.filter((a) => !have.has(a.id));
  if (!missing.length) return [];

  const now = Date.now();
  // INSERT OR IGNORE: duas partidas ao mesmo tempo não desbloqueiam duas vezes (só a que inseriu avisa).
  const writes = await env.DB.batch(
    missing.flatMap((a) => [
      env.DB.prepare(
        'INSERT OR IGNORE INTO player_achievements (player_id, achievement_id, unlocked_at, seen) VALUES (?, ?, ?, ?)',
      ).bind(playerId, a.id, now, seen ? 1 : 0),
      env.DB.prepare('INSERT OR IGNORE INTO player_items (player_id, item_id, acquired_at) VALUES (?, ?, ?)').bind(
        playerId,
        a.reward,
        now,
      ),
    ]),
  );
  return missing.filter((_, i) => writes[i * 2].meta.changes).map((a) => a.id);
}

/**
 * Partida que valeu (solo, desafio diário ou party) de uma conta: atualiza os contadores e desbloqueia o que
 * alcançou. `daily` = dia do desafio ('AAAA-MM-DD') ou null. Devolve as conquistas novas.
 */
export async function recordGame(
  env: Env,
  playerId: number,
  game: { mode: string; score: number; daily: string | null },
  seen: boolean,
): Promise<string[]> {
  const mode700 = game.score >= ECLECTIC_MIN_SCORE ? game.mode : null;
  const prev = game.daily && previousDay(game.daily);
  // Tudo num UPDATE só (contadores atômicos). Sequência: mesmo dia mantém, dia seguinte soma, buraco recomeça;
  // desafio de um dia anterior ao último (envio atrasado) não mexe.
  const row = await env.DB.prepare(
    `INSERT INTO player_stats (player_id, games, best_score, daily_streak, daily_last, modes_700)
     VALUES (?1, 1, ?2, CASE WHEN ?3 IS NULL THEN 0 ELSE 1 END, ?3, CASE WHEN ?4 IS NULL THEN ',' ELSE ',' || ?4 || ',' END)
     ON CONFLICT (player_id) DO UPDATE SET
       games = games + 1,
       best_score = MAX(best_score, ?2),
       daily_streak = CASE
         WHEN ?3 IS NULL OR daily_last >= ?3 THEN daily_streak
         WHEN daily_last = ?5 THEN daily_streak + 1
         ELSE 1 END,
       daily_last = CASE WHEN ?3 IS NULL OR daily_last >= ?3 THEN daily_last ELSE ?3 END,
       modes_700 = CASE WHEN ?4 IS NULL OR instr(modes_700, ',' || ?4 || ',') THEN modes_700 ELSE modes_700 || ?4 || ',' END
     RETURNING ${STATS_COLUMNS}`,
  )
    .bind(playerId, game.score, game.daily, mode700, prev)
    .first<StatsRow>();
  return unlock(env, playerId, toStats(row, game.daily ?? undefined), seen);
}

/** 1º lugar numa party com 2+ jogadores que terminaram. O aviso aparece na home. */
export async function recordPartyWin(env: Env, playerId: number): Promise<string[]> {
  const row = await env.DB.prepare(
    `INSERT INTO player_stats (player_id, party_wins) VALUES (?, 1)
     ON CONFLICT (player_id) DO UPDATE SET party_wins = party_wins + 1
     RETURNING ${STATS_COLUMNS}`,
  )
    .bind(playerId)
    .first<StatsRow>();
  return unlock(env, playerId, toStats(row), false);
}

/** Conquistas desbloqueadas que o jogador ainda não viu (vão no perfil, para o aviso na home). */
export async function unseenAchievements(env: Env, playerId: number): Promise<string[]> {
  const { results } = await env.DB.prepare(
    'SELECT achievement_id FROM player_achievements WHERE player_id = ? AND seen = 0 ORDER BY unlocked_at',
  )
    .bind(playerId)
    .all<{ achievement_id: string }>();
  return results.map((r) => r.achievement_id);
}

/** POST /api/achievements: { token } → AchievementsState (contadores e o que já desbloqueou). */
export async function getAchievements(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;
  const [stats, unlocked] = await env.DB.batch([
    env.DB.prepare(`SELECT ${STATS_COLUMNS} FROM player_stats WHERE player_id = ?`).bind(auth.id),
    env.DB.prepare('SELECT achievement_id, unlocked_at FROM player_achievements WHERE player_id = ?').bind(auth.id),
  ]);
  const known = new Set<string>(ACHIEVEMENTS.map((a) => a.id));
  const state: AchievementsState = {
    stats: toStats((stats.results[0] as StatsRow | undefined) ?? null),
    unlocked: Object.fromEntries(
      (unlocked.results as { achievement_id: string; unlocked_at: number }[])
        .filter((r) => known.has(r.achievement_id))
        .map((r) => [r.achievement_id, r.unlocked_at]),
    ),
  };
  return json(state);
}

/** POST /api/achievements/seen: { token } → { ok }. O jogador viu o aviso das conquistas novas. */
export async function markAchievementsSeen(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;
  await env.DB.prepare('UPDATE player_achievements SET seen = 1 WHERE player_id = ? AND seen = 0').bind(auth.id).run();
  return json({ ok: true });
}
