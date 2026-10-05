import { loadCatalog } from './catalog';
import { badRequest, json, type Env } from './lib';
import { sha256 } from './players';
import { creditCoins, toLook } from './profile';
import {
  afterBattle,
  BENCH_SIZE,
  bossFor,
  bossTeam,
  botTeam,
  buyOffer,
  isRunCleared,
  isRunOver,
  moveUnit,
  newRun,
  outcomeOf,
  powerFactors,
  rerollShop,
  rewardFor,
  sanitizeTeam,
  sellUnit,
  simulateBattle,
  type BossId,
  type Factors,
  type RunError,
  type RunState,
  type RunUnit,
} from '../src/game/autobattle';

export type AutoBattleAction = 'state' | 'start' | 'buy' | 'sell' | 'move' | 'reroll' | 'battle' | 'abandon';

/** [0, 1) com o gerador criptográfico: loja e semente da luta não podem ser previsíveis. */
function secureRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

interface RunRow {
  id: number;
  round: number;
  wins: number;
  losses: number;
  gold: number;
  team: string;
  bench: string;
  shop: string;
  history: string;
  version: number;
}

const ERROR_TEXT: Record<RunError, string> = {
  no_gold: 'Moedas da run insuficientes',
  no_slot: 'Time e banco cheios',
  no_offer: 'Oferta indisponível',
  max_stars: 'Esse personagem já está no máximo',
  not_owned: 'Você não tem esse personagem',
  bench_full: 'Banco cheio',
};

const NO_RUN = () => json({ error: 'Nenhuma run em andamento', code: 'no_run' }, { status: 409 });
const STALE = () => json({ error: 'Ação repetida. Tente de novo.', code: 'stale' }, { status: 409 });

function toState(row: RunRow): RunState {
  const shop = JSON.parse(row.shop) as unknown;
  const history = JSON.parse(row.history) as unknown;
  const team = sanitizeTeam(JSON.parse(row.team));
  return {
    round: row.round,
    wins: row.wins,
    losses: row.losses,
    gold: row.gold,
    team,
    bench: sanitizeTeam(JSON.parse(row.bench), BENCH_SIZE).filter((u) => !team.some((t) => t.id === u.id)),
    shop: Array.isArray(shop) ? shop.map((id) => (typeof id === 'string' ? id : null)) : [],
    history: Array.isArray(history) ? history.filter((o) => o === 'win' || o === 'loss' || o === 'draw') : [],
  };
}

/**
 * Tudo o que uma ação precisa ler, numa consulta só (cada ida ao D1 custa tempo, e a loja da run é clicada em
 * sequência): a conta do token (sem as suspensas), a chave do jogo e a run ativa.
 */
async function loadContext(env: Env, token: unknown) {
  if (typeof token !== 'string' || !token) return null;
  const row = await env.DB.prepare(
    `SELECT p.id AS player_id, (SELECT enabled FROM features WHERE id = 'autobattle') AS enabled,
            r.id, r.round, r.wins, r.losses, r.gold, r.team, r.bench, r.shop, r.history, r.version
       FROM player_tokens t JOIN players p ON p.id = t.player_id
       LEFT JOIN autobattle_runs r ON r.player_id = p.id AND r.status = 'active'
      WHERE t.token_hash = ? AND p.banned_until <= ?`,
  )
    .bind(await sha256(token), Date.now())
    .first<{ player_id: number; enabled: number | null } & Partial<RunRow>>();
  if (!row) return null;
  return { playerId: row.player_id, enabled: Boolean(row.enabled), run: row.id == null ? null : (row as RunRow) };
}

/** Fator de força de cada personagem do elenco, a partir do `power` do catálogo (que não sai do servidor). */
async function loadFactors(env: Env): Promise<Factors> {
  const { byId } = await loadCatalog(env);
  return powerFactors((id) => byId.get(id)?.power);
}

/**
 * Grava o novo estado da run só se ninguém mexeu nela desde a leitura (`version`): dois cliques simultâneos não
 * compram duas vezes nem lutam duas vezes. false = outra requisição chegou antes.
 */
async function saveRun(env: Env, row: RunRow, next: RunState, done: boolean, coinsEarned = 0): Promise<boolean> {
  const saved = await env.DB.prepare(
    `UPDATE autobattle_runs
        SET round = ?, wins = ?, losses = ?, gold = ?, team = ?, bench = ?, shop = ?, history = ?, status = ?,
            coins_earned = ?,
            version = version + 1, updated_at = ?
      WHERE id = ? AND version = ? AND status = 'active'`,
  )
    .bind(
      next.round,
      next.wins,
      next.losses,
      next.gold,
      JSON.stringify(next.team),
      JSON.stringify(next.bench),
      JSON.stringify(next.shop),
      JSON.stringify(next.history),
      done ? 'done' : 'active',
      coinsEarned,
      Date.now(),
      row.id,
      row.version,
    )
    .run();
  return saved.meta.changes > 0;
}

/** Fim da run: grava como encerrada e só então paga as moedas das vitórias (uma vez: a gravação é condicional). */
async function finishRun(env: Env, playerId: number, row: RunRow, state: RunState) {
  const reward = rewardFor(state.wins);
  if (!(await saveRun(env, row, state, true, reward))) return null;
  const coins = reward > 0 ? await creditCoins(env, playerId, reward) : null;
  return { wins: state.wins, losses: state.losses, reward, coins, cleared: isRunCleared(state) };
}

interface Opponent {
  /** Nick de quem montou o time; null = bot ou chefe. */
  name: string | null;
  /** Chefe da rodada (rodadas 5 e 10), no lugar de um fantasma: `team` é ele sozinho. */
  boss?: BossId;
  look: ReturnType<typeof toLook> | null;
  team: RunUnit[];
}

/**
 * Adversário da rodada: o chefe, nas rodadas dele; senão o fantasma (time salvo) de outra conta na mesma rodada,
 * com a campanha mais parecida; sem nenhum, um bot.
 */
async function findOpponent(env: Env, playerId: number, run: RunState): Promise<Opponent> {
  const boss = bossFor(run.round);
  if (boss) return { name: null, look: null, team: bossTeam(boss), boss: boss.id };
  const ghost = await env.DB.prepare(
    `SELECT g.team, p.name, p.avatar, p.name_color, p.frame, p.title, p.badge
       FROM autobattle_ghosts g JOIN players p ON p.id = g.player_id
      WHERE g.round = ?1 AND g.player_id != ?2 AND p.banned_until <= ?3
      ORDER BY ABS(g.wins - ?4), RANDOM() LIMIT 1`,
  )
    .bind(run.round, playerId, Date.now(), run.wins)
    .first<{ team: string; name: string } & Parameters<typeof toLook>[0]>();
  const team = ghost ? sanitizeTeam(JSON.parse(ghost.team)) : [];
  if (ghost && team.length) return { name: ghost.name, look: toLook(ghost), team };
  return { name: null, look: null, team: botTeam(run.round, secureRandom) };
}

/**
 * POST /api/autobattle/<ação>: { token, ... } → { run, ... }. Só contas, com a chave `autobattle` ligada.
 * O estado da run fica no servidor; o site só envia a escolha (comprar a oferta N, vender, mover, rolar, lutar).
 *   state   → run em andamento (ou null) + factors
 *   start   → começa uma run (se já há uma, devolve a que existe) + factors
 *   buy     { offer } · sell { id } · move { id } (time ↔ banco) · reroll → só a run (duas idas ao banco: ler e gravar)
 *   battle  → resolve a luta da rodada: { battle: { seed, team, opponent, outcome }, factors, ended? }
 *   abandon → encerra a run e paga pelas vitórias que ela tinha
 */
export async function autoBattle(request: Request, env: Env, action: AutoBattleAction): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { token?: unknown; offer?: unknown; id?: unknown } | null;
  const context = await loadContext(env, body?.token);
  if (!context) return json({ error: 'Nick não verificado' }, { status: 401 });
  if (!context.enabled) {
    return json({ error: 'Este minigame está desligado no momento.', code: 'feature_disabled' }, { status: 403 });
  }
  const { playerId, run: row } = context;

  if (action === 'state') return json({ run: row ? toState(row) : null, factors: await loadFactors(env) });

  if (action === 'start') {
    const factors = await loadFactors(env);
    if (row) return json({ run: toState(row), factors });
    const run = newRun(secureRandom);
    const now = Date.now();
    // O índice único (uma ativa por conta) segura dois "começar" simultâneos: o segundo cai no catch e relê.
    try {
      await env.DB.prepare(
        'INSERT INTO autobattle_runs (player_id, round, gold, team, bench, shop, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
        .bind(playerId, run.round, run.gold, '[]', '[]', JSON.stringify(run.shop), now, now)
        .run();
      return json({ run, factors });
    } catch {
      const existing = (await loadContext(env, body?.token))?.run;
      if (!existing) throw new Error('autobattle: não foi possível criar a run');
      return json({ run: toState(existing), factors });
    }
  }

  if (!row) return NO_RUN();
  const run = toState(row);

  if (action === 'abandon') {
    const ended = await finishRun(env, playerId, row, run);
    return ended ? json({ run: null, ended }) : STALE();
  }

  if (action === 'battle') {
    if (!run.team.length) return badRequest('Monte um time antes de lutar');
    const [opponent, factors] = await Promise.all([findOpponent(env, playerId, run), loadFactors(env)]);
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const outcome = outcomeOf(simulateBattle(run.team, opponent.team, factors, seed));
    const next = afterBattle(run, outcome, secureRandom);
    const battle = { seed, team: run.team, opponent, outcome };

    const over = isRunOver(next);
    const ended = over ? await finishRun(env, playerId, row, next) : null;
    if (over ? !ended : !(await saveRun(env, row, next, false))) return STALE();

    // O time desta rodada vira o fantasma da conta (o mais recente por rodada). Rodada de chefe não usa fantasma.
    if (!opponent.boss) {
      await env.DB.prepare(
        `INSERT INTO autobattle_ghosts (player_id, round, wins, team, created_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (player_id, round) DO UPDATE SET wins = excluded.wins, team = excluded.team, created_at = excluded.created_at`,
      )
        .bind(playerId, run.round, run.wins, JSON.stringify(run.team), Date.now())
        .run();
    }

    return json({ run: over ? null : next, factors, battle, ...(ended ? { ended } : {}) });
  }

  const id = typeof body?.id === 'string' ? body.id : '';
  const next =
    action === 'buy'
      ? Number.isInteger(body?.offer)
        ? buyOffer(run, body!.offer as number)
        : 'no_offer'
      : action === 'sell'
        ? sellUnit(run, id)
        : action === 'move'
          ? moveUnit(run, id)
          : rerollShop(run, secureRandom);
  if (typeof next === 'string') return json({ error: ERROR_TEXT[next], code: next }, { status: next === 'no_gold' ? 402 : 400 });
  if (!(await saveRun(env, row, next, false))) return STALE();
  return json({ run: next });
}
