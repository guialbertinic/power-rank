/**
 * Auto Battle: roguelike de montar time (estilo TFT / Super Auto Pets), compartilhado entre o site e o Worker.
 * Lógica pura, sem DOM. A cada rodada o jogador compra personagens numa loja sorteada, cópias repetidas sobem a
 * estrela, e a luta se resolve sozinha contra o time salvo de outro jogador ("fantasma"). A vida do time é uma
 * barra só (soma dos personagens) e todos batem ao mesmo tempo.
 *
 * O `power` do ranking nunca vem para cá: o servidor manda só um fator por personagem (`powerFactors`, de 0,85 a
 * 1,15, relativo à própria obra), e os atributos saem de tier + estrelas + papel + esse fator.
 */

export type Role = 'attacker' | 'tank' | 'crit' | 'fast' | 'rage' | 'burn' | 'heal' | 'shield' | 'weaken' | 'haste';
export type Tier = 1 | 2 | 3;
export type SeriesId = 'onepiece' | 'naruto' | 'bleach' | 'jjk' | 'dragonball' | 'hxh' | 'mha' | 'kny';

export interface RosterEntry {
  /** Id do personagem no catálogo (`characters.id`). */
  id: string;
  series: SeriesId;
  /** Custo na loja e faixa de força dentro da obra. */
  tier: Tier;
  role: Role;
}

/** Obras do elenco, na ordem em que aparecem na tela. O nome é próprio (não traduz); `short` cabe no cartão. */
export const SERIES: { id: SeriesId; name: string; short: string }[] = [
  { id: 'onepiece', name: 'One Piece', short: 'One Piece' },
  { id: 'naruto', name: 'Naruto', short: 'Naruto' },
  { id: 'bleach', name: 'Bleach', short: 'Bleach' },
  { id: 'jjk', name: 'Jujutsu Kaisen', short: 'JJK' },
  { id: 'dragonball', name: 'Dragon Ball', short: 'DB' },
  { id: 'hxh', name: 'Hunter x Hunter', short: 'HxH' },
  { id: 'mha', name: 'My Hero Academia', short: 'MHA' },
  { id: 'kny', name: 'Demon Slayer', short: 'KnY' },
];

const entry = (series: SeriesId, tier: Tier, id: string, role: Role): RosterEntry => ({ id, series, tier, role });

/** Elenco fixo: 8 obras × 7 personagens (3 de tier 1, 2 de tier 2, 2 de tier 3). */
export const ROSTER: RosterEntry[] = [
  entry('onepiece', 1, 'nami', 'haste'),
  entry('onepiece', 1, 'usopp', 'crit'),
  entry('onepiece', 1, 'franky', 'tank'),
  entry('onepiece', 2, 'zoro', 'crit'),
  entry('onepiece', 2, 'law', 'heal'),
  entry('onepiece', 3, 'luffy', 'rage'),
  entry('onepiece', 3, 'kaido', 'tank'),

  entry('naruto', 1, 'sakura', 'heal'),
  entry('naruto', 1, 'rock-lee', 'fast'),
  entry('naruto', 1, 'gaara', 'shield'),
  entry('naruto', 2, 'kakashi', 'weaken'),
  entry('naruto', 2, 'itachi', 'burn'),
  entry('naruto', 3, 'naruto', 'attacker'),
  entry('naruto', 3, 'sasuke', 'crit'),

  entry('bleach', 1, 'orihime', 'heal'),
  entry('bleach', 1, 'chad', 'tank'),
  entry('bleach', 1, 'rukia', 'weaken'),
  entry('bleach', 2, 'byakuya', 'crit'),
  entry('bleach', 2, 'kenpachi', 'rage'),
  entry('bleach', 3, 'ichigo', 'attacker'),
  entry('bleach', 3, 'aizen', 'weaken'),

  entry('jjk', 1, 'nobara', 'burn'),
  entry('jjk', 1, 'nanami', 'crit'),
  entry('jjk', 1, 'megumi', 'tank'),
  entry('jjk', 2, 'yuji', 'attacker'),
  entry('jjk', 2, 'toji', 'fast'),
  entry('jjk', 3, 'gojo', 'shield'),
  entry('jjk', 3, 'sukuna', 'attacker'),

  entry('dragonball', 1, 'krillin', 'haste'),
  entry('dragonball', 1, 'yamcha', 'attacker'),
  entry('dragonball', 1, 'mr-satan', 'weaken'),
  entry('dragonball', 2, 'piccolo', 'heal'),
  entry('dragonball', 2, 'trunks', 'crit'),
  entry('dragonball', 3, 'goku', 'attacker'),
  entry('dragonball', 3, 'vegeta', 'rage'),

  entry('hxh', 1, 'leorio', 'heal'),
  entry('hxh', 1, 'kurapika', 'weaken'),
  entry('hxh', 1, 'biscuit', 'tank'),
  entry('hxh', 2, 'killua', 'fast'),
  entry('hxh', 2, 'hisoka', 'crit'),
  entry('hxh', 3, 'gon', 'rage'),
  entry('hxh', 3, 'meruem', 'tank'),

  entry('mha', 1, 'uraraka', 'weaken'),
  entry('mha', 1, 'aizawa', 'weaken'),
  entry('mha', 1, 'hawks', 'fast'),
  entry('mha', 2, 'bakugo', 'attacker'),
  entry('mha', 2, 'todoroki', 'burn'),
  entry('mha', 3, 'deku', 'rage'),
  entry('mha', 3, 'allmight', 'shield'),

  entry('kny', 1, 'zenitsu', 'fast'),
  entry('kny', 1, 'inosuke', 'attacker'),
  entry('kny', 1, 'nezuko', 'heal'),
  entry('kny', 2, 'tanjiro', 'attacker'),
  entry('kny', 2, 'rengoku', 'burn'),
  entry('kny', 3, 'yoriichi', 'crit'),
  entry('kny', 3, 'muzan', 'heal'),
];

export const ROSTER_BY_ID = new Map(ROSTER.map((e) => [e.id, e]));

// ---------- Regras da run ----------

/** A run tem este número de rodadas... */
export const MAX_ROUNDS = 10;
/** ...e acaba antes ao perder todas as vidas (uma por derrota; empate não tira vida nem dá vitória). */
export const MAX_LIVES = 3;
export const MAX_SLOTS = 6;
/** Banco de reservas: personagens guardados, que não lutam nem contam para a sinergia. */
export const BENCH_SIZE = 5;
export const SHOP_SIZE = 5;
export const REROLL_COST = 1;
/** Cópias para cada estrela: 1 = 1★, 3 = 2★, 9 = 3★ (máximo). */
export const MAX_COPIES = 9;

/** Espaços do time na rodada: 3 na primeira, mais um por rodada até 6. */
export const slotsFor = (round: number) => Math.min(MAX_SLOTS, 2 + round);
/** Moedas da run recebidas no começo da rodada (o que sobrou da anterior fica). */
export const incomeFor = (round: number) => Math.min(10, 5 + round);

export const starsOf = (copies: number): 1 | 2 | 3 => (copies >= 9 ? 3 : copies >= 3 ? 2 : 1);
/** Cópias que faltam para a próxima estrela, como "2/3" na tela: [tem, precisa]. null na estrela máxima. */
export function starProgress(copies: number): [number, number] | null {
  if (copies >= MAX_COPIES) return null;
  return copies >= 3 ? [copies - 3, 6] : [copies, 3];
}

/** Vender devolve o que as cópias custaram, menos 1 se o personagem já subiu de estrela. */
export const sellValue = (tier: Tier, copies: number) => tier * copies - (copies >= 3 ? 1 : 0);

/** Chance (%) de cada tier aparecer na loja, por rodada: os fortes chegam mais tarde. */
export function shopOdds(round: number): [number, number, number] {
  if (round <= 2) return [80, 20, 0];
  if (round <= 4) return [65, 30, 5];
  if (round <= 6) return [50, 35, 15];
  if (round <= 9) return [40, 38, 22];
  return [30, 40, 30];
}

/** Moedas de verdade pagas no fim da run, pelo número de vitórias (índice = vitórias). */
export const REWARD_BY_WINS = [0, 0, 0, 10, 15, 25, 35, 50, 65, 80, 100];
export const rewardFor = (wins: number) => REWARD_BY_WINS[Math.max(0, Math.min(REWARD_BY_WINS.length - 1, wins))];

// ---------- Atributos ----------

/** Força base por tier e multiplicador por estrela. */
const TIER_POWER: Record<Tier, number> = { 1: 20, 2: 30, 3: 42 };
const STAR_MULT = [1, 1.8, 3.2];
/** Vida por ponto de força: com times parecidos, a luta dura uns 15 s. */
const HP_PER_POWER = 15;
/** Habilidades de time (enfraquece, acelera) crescem menos com a estrela do que vida e ataque. */
const AURA_STAR_MULT = [1, 1.35, 1.8];

/** Como cada papel divide a força: vida, ataque e intervalo entre golpes (1 = 1 s). */
const ROLE_SHAPE: Record<Role, { hp: number; atk: number; interval: number }> = {
  attacker: { hp: 0.9, atk: 1.35, interval: 1 },
  tank: { hp: 1.7, atk: 0.6, interval: 1 },
  crit: { hp: 0.85, atk: 1, interval: 1 },
  fast: { hp: 0.9, atk: 0.85, interval: 0.6 },
  rage: { hp: 0.9, atk: 0.8, interval: 1 },
  burn: { hp: 0.95, atk: 0.6, interval: 1 },
  heal: { hp: 1, atk: 0.5, interval: 1 },
  shield: { hp: 1, atk: 0.6, interval: 1 },
  weaken: { hp: 1, atk: 0.7, interval: 1 },
  haste: { hp: 0.95, atk: 0.7, interval: 1 },
};

/** Crítico: chance (%) e multiplicador do golpe. */
export const CRIT_CHANCE = 30;
export const CRIT_MULT = 2.5;
/** Fúria: quanto do ataque base o personagem ganha a cada golpe que dá (%). */
export const RAGE_STEP = 7;
/** Cura: intervalo entre as curas. */
export const HEAL_EVERY_MS = 3000;
const WEAKEN_BY_TIER: Record<Tier, number> = { 1: 6, 2: 9, 3: 13 };
const HASTE_BY_TIER: Record<Tier, number> = { 1: 8, 2: 11, 3: 15 };

export interface UnitStats {
  hp: number;
  atk: number;
  /** Tempo entre golpes, em ms. */
  interval: number;
  /**
   * Valor da habilidade do papel: crit = chance (%), rage = ganho por golpe (%), burn = dano que ignora escudo,
   * heal = cura a cada 3 s, shield = escudo inicial, weaken / haste = % no time. 0 para quem não tem habilidade.
   */
  ability: number;
}

/** Fator de força de cada personagem (0,85 a 1,15). Sem fator = 1. */
export type Factors = Record<string, number>;

/**
 * Fatores a partir do `power` do ranking (só o servidor tem): dentro de cada obra, o mais fraco dos 7 fica com
 * 0,85 e o mais forte com 1,15, em degraus iguais pela ordem de poder. Pela ordem (e não pelo valor) porque as
 * escalas diferem (Dragon Ball vive em 90+) e assim toda obra tem a mesma soma de fatores.
 */
export function powerFactors(powerOf: (id: string) => number | undefined): Factors {
  const factors: Factors = {};
  for (const { id: series } of SERIES) {
    const known = ROSTER.filter((e) => e.series === series)
      .map((e) => ({ id: e.id, power: powerOf(e.id) }))
      .filter((e): e is { id: string; power: number } => typeof e.power === 'number');
    for (const e of known) {
      // Posição entre os da obra (empate = posição média), de 0 (mais fraco) a 1 (mais forte).
      const weaker = known.filter((o) => o.power < e.power).length;
      const tied = known.filter((o) => o.power === e.power).length - 1;
      const rel = known.length > 1 ? (weaker + tied / 2) / (known.length - 1) : 0.5;
      factors[e.id] = Math.round((0.85 + 0.3 * rel) * 1000) / 1000;
    }
  }
  return factors;
}

/** Atributos de um personagem do elenco com `copies` cópias. */
export function unitStats(e: RosterEntry, copies: number, factors: Factors): UnitStats {
  const star = starsOf(copies) - 1;
  const power = TIER_POWER[e.tier] * STAR_MULT[star] * (factors[e.id] ?? 1);
  const shape = ROLE_SHAPE[e.role];
  const aura = AURA_STAR_MULT[star];
  const ability: Record<Role, number> = {
    attacker: 0,
    tank: 0,
    fast: 0,
    crit: CRIT_CHANCE,
    rage: RAGE_STEP,
    burn: Math.round(power * 0.7),
    heal: Math.round(power * HP_PER_POWER * 0.17),
    shield: Math.round(power * HP_PER_POWER * 0.75),
    weaken: Math.round(WEAKEN_BY_TIER[e.tier] * aura),
    haste: Math.round(HASTE_BY_TIER[e.tier] * aura),
  };
  return {
    hp: Math.round(power * HP_PER_POWER * shape.hp),
    atk: Math.round(power * shape.atk),
    interval: Math.round(1000 * shape.interval),
    ability: ability[e.role],
  };
}

// ---------- Sinergia de obra ----------

export type SynergyKind = 'hp' | 'atk' | 'crit' | 'weaken' | 'ramp' | 'haste' | 'clutch' | 'lifesteal';

/** Quantos personagens diferentes da obra ligam cada nível da sinergia. */
export const SYNERGY_STEPS = [2, 4, 6];

/**
 * Efeito de cada obra e o valor (%) em cada nível:
 * hp = vida do time · atk = ataque do time · crit = chance de qualquer golpe dobrar · weaken = menos dano inimigo ·
 * ramp = dano a mais por segundo de luta · haste = velocidade de ataque · clutch = dano a mais com o time abaixo de
 * metade da vida · lifesteal = cura do dano causado.
 */
export const SYNERGY: Record<SeriesId, { kind: SynergyKind; values: [number, number, number] }> = {
  onepiece: { kind: 'hp', values: [10, 24, 42] },
  naruto: { kind: 'atk', values: [10, 24, 42] },
  bleach: { kind: 'crit', values: [10, 22, 38] },
  jjk: { kind: 'weaken', values: [9, 19, 30] },
  dragonball: { kind: 'ramp', values: [1.2, 2.8, 5] },
  hxh: { kind: 'haste', values: [10, 24, 42] },
  mha: { kind: 'clutch', values: [20, 48, 85] },
  kny: { kind: 'lifesteal', values: [10, 22, 36] },
};

/** Nível da sinergia (0 a 3) para `count` personagens da obra no time. */
export const synergyLevel = (count: number) => SYNERGY_STEPS.filter((step) => count >= step).length;

export interface RunUnit {
  id: string;
  copies: number;
}

/** Personagens de cada obra no time (a tela mostra todas as que têm pelo menos um). */
export function seriesCounts(team: RunUnit[]): Partial<Record<SeriesId, number>> {
  const counts: Partial<Record<SeriesId, number>> = {};
  for (const unit of team) {
    const e = ROSTER_BY_ID.get(unit.id);
    if (e) counts[e.series] = (counts[e.series] ?? 0) + 1;
  }
  return counts;
}

// ---------- Sorteio ----------

/** Gerador determinístico (mulberry32): a mesma semente dá a mesma luta no servidor e no site. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(list: T[], random: () => number): T => list[Math.floor(random() * list.length)];

function drawTier(round: number, random: () => number): Tier {
  const [t1, t2] = shopOdds(round);
  const roll = random() * 100;
  return roll < t1 ? 1 : roll < t1 + t2 ? 2 : 3;
}

/** Ofertas da loja da rodada (ids do elenco; pode repetir). */
export function rollShop(round: number, random: () => number): string[] {
  return Array.from({ length: SHOP_SIZE }, () => {
    const tier = drawTier(round, random);
    return pick(
      ROSTER.filter((e) => e.tier === tier),
      random,
    ).id;
  });
}

// ---------- Estado da run ----------

export interface RunState {
  /** Rodada atual (1 = primeira). */
  round: number;
  wins: number;
  losses: number;
  /** Moedas da run (não são as moedas da conta). */
  gold: number;
  /** Quem luta (até `slotsFor(round)`). */
  team: RunUnit[];
  /** Banco de reservas (até `BENCH_SIZE`). Um personagem está no time ou no banco, nunca nos dois. */
  bench: RunUnit[];
  /** Ofertas da loja; null = já comprada. */
  shop: (string | null)[];
  /** Resultado de cada rodada já lutada, na ordem (a trilha das rodadas pinta por ele). */
  history: Outcome[];
}

export type RunError = 'no_gold' | 'no_slot' | 'no_offer' | 'max_stars' | 'not_owned' | 'bench_full';
export type Outcome = 'win' | 'loss' | 'draw';

export const isRunOver = (run: RunState) => run.losses >= MAX_LIVES || run.round > MAX_ROUNDS;
/** A run chegou ao fim das rodadas com vida sobrando (venceu o chefe final). */
export const isRunCleared = (run: RunState) => run.round > MAX_ROUNDS && run.losses < MAX_LIVES;

export function newRun(random: () => number): RunState {
  return { round: 1, wins: 0, losses: 0, gold: incomeFor(1), team: [], bench: [], shop: rollShop(1, random), history: [] };
}

/**
 * Compra a oferta `index`: cópia de quem o jogador já tem (no time ou no banco) soma nele e sobe a estrela;
 * personagem novo vai para o time se houver espaço, senão para o banco.
 */
export function buyOffer(run: RunState, index: number): RunState | RunError {
  const id = run.shop[index];
  const e = id ? ROSTER_BY_ID.get(id) : undefined;
  if (!id || !e) return 'no_offer';
  if (run.gold < e.tier) return 'no_gold';
  const owned = [...run.team, ...run.bench].find((u) => u.id === id);
  if (owned && owned.copies >= MAX_COPIES) return 'max_stars';
  const toTeam = run.team.length < slotsFor(run.round);
  if (!owned && !toTeam && run.bench.length >= BENCH_SIZE) return 'no_slot';
  const stack = (units: RunUnit[]) => units.map((u) => (u === owned ? { id, copies: u.copies + 1 } : u));
  return {
    ...run,
    gold: run.gold - e.tier,
    team: owned ? stack(run.team) : toTeam ? [...run.team, { id, copies: 1 }] : run.team,
    bench: owned ? stack(run.bench) : toTeam ? run.bench : [...run.bench, { id, copies: 1 }],
    shop: run.shop.map((offer, i) => (i === index ? null : offer)),
  };
}

/** Passa o personagem do time para o banco ou do banco para o time (se couber do outro lado). */
export function moveUnit(run: RunState, id: string): RunState | RunError {
  const onTeam = run.team.find((u) => u.id === id);
  if (onTeam) {
    if (run.bench.length >= BENCH_SIZE) return 'bench_full';
    return { ...run, team: run.team.filter((u) => u !== onTeam), bench: [...run.bench, onTeam] };
  }
  const onBench = run.bench.find((u) => u.id === id);
  if (!onBench) return 'not_owned';
  if (run.team.length >= slotsFor(run.round)) return 'no_slot';
  return { ...run, team: [...run.team, onBench], bench: run.bench.filter((u) => u !== onBench) };
}

export function sellUnit(run: RunState, id: string): RunState | RunError {
  const unit = [...run.team, ...run.bench].find((u) => u.id === id);
  const e = ROSTER_BY_ID.get(id);
  if (!unit || !e) return 'not_owned';
  return {
    ...run,
    gold: run.gold + sellValue(e.tier, unit.copies),
    team: run.team.filter((u) => u !== unit),
    bench: run.bench.filter((u) => u !== unit),
  };
}

export function rerollShop(run: RunState, random: () => number): RunState | RunError {
  if (run.gold < REROLL_COST) return 'no_gold';
  return { ...run, gold: run.gold - REROLL_COST, shop: rollShop(run.round, random) };
}

/**
 * Depois da luta: conta o resultado e, se a run continua, abre a próxima rodada (moedas + loja nova).
 * Contra um chefe é preciso vencer: derrota ou empate tira todas as vidas e a run acaba ali.
 */
export function afterBattle(run: RunState, outcome: Outcome, random: () => number): RunState {
  const failedBoss = bossFor(run.round) !== null && outcome !== 'win';
  const next = {
    ...run,
    round: run.round + 1,
    wins: run.wins + (outcome === 'win' ? 1 : 0),
    losses: failedBoss ? MAX_LIVES : run.losses + (outcome === 'loss' ? 1 : 0),
    history: [...run.history, outcome],
  };
  if (isRunOver(next)) return { ...next, shop: [] };
  return { ...next, gold: next.gold + incomeFor(next.round), shop: rollShop(next.round, random) };
}

/** Time válido vindo de fora (banco de dados, fantasma antigo): só personagens do elenco, sem repetir, até `max`. */
export function sanitizeTeam(raw: unknown, max = MAX_SLOTS): RunUnit[] {
  if (!Array.isArray(raw)) return [];
  const team: RunUnit[] = [];
  for (const item of raw) {
    const { id, copies } = (item ?? {}) as { id?: unknown; copies?: unknown };
    if (typeof id !== 'string' || !ROSTER_BY_ID.has(id) || team.some((u) => u.id === id)) continue;
    const n = typeof copies === 'number' && Number.isInteger(copies) ? Math.max(1, Math.min(MAX_COPIES, copies)) : 1;
    team.push({ id, copies: n });
    if (team.length >= max) break;
  }
  return team;
}

/**
 * Time de bot para a rodada (quando não há fantasma): gasta uns 75% do que um jogador teria recebido até ali,
 * puxando para uma obra (para ter sinergia).
 */
export function botTeam(round: number, random: () => number): RunUnit[] {
  let budget = 0;
  for (let r = 1; r <= round; r++) budget += incomeFor(r);
  budget = Math.floor(budget * 0.75);
  const favorite = pick(SERIES, random).id;
  const team: RunUnit[] = [];
  const slots = slotsFor(round);
  for (let tries = 0; team.length < slots && tries < 60; tries++) {
    const tier = drawTier(round, random);
    const options = ROSTER.filter((e) => e.tier === tier && !team.some((u) => u.id === e.id));
    const fromFavorite = options.filter((e) => e.series === favorite);
    const chosen = pick(fromFavorite.length && random() < 0.6 ? fromFavorite : options, random);
    team.push({ id: chosen.id, copies: 1 });
    budget -= tier;
  }
  for (let tries = 0; budget > 0 && tries < 80; tries++) {
    const unit = pick(team, random);
    const tier = ROSTER_BY_ID.get(unit.id)!.tier;
    if (unit.copies >= MAX_COPIES || tier > budget) continue;
    unit.copies++;
    budget -= tier;
  }
  return team;
}

// ---------- Chefes ----------

export type BossId = 'mid' | 'final';

export interface Boss {
  id: BossId;
  /** Id do personagem no catálogo (de fora do elenco: não aparece na loja). */
  unit: string;
  /** O chefe luta sozinho, com atributos próprios (não vêm de tier, estrela nem do `power`). */
  role: Role;
  stats: UnitStats;
}

/**
 * Chefes: nas rodadas 5 e 10 o adversário é um personagem só, no lugar do fantasma de outro jogador.
 * Madara (fúria: cada golpe aumenta o ataque, então luta longa é derrota) e Saitama (crítico: golpes de 2,5×).
 * Calibrados simulando: um time montado ao acaso (`botTeam`) vence cada um em ~20% das vezes; um time bem
 * montado vence o da rodada 5 em ~80% e o final em ~70%.
 */
export const BOSSES: Record<number, Boss> = {
  5: { id: 'mid', unit: 'madara', role: 'rage', stats: { hp: 5400, atk: 100, interval: 500, ability: 3 } },
  10: { id: 'final', unit: 'saitama', role: 'crit', stats: { hp: 7200, atk: 172, interval: 500, ability: 30 } },
};

const BOSS_BY_UNIT = new Map(Object.values(BOSSES).map((boss) => [boss.unit, boss]));

/** Chefe da rodada (null nas rodadas comuns). */
export const bossFor = (round: number): Boss | null => BOSSES[round] ?? null;
/** O "time" do chefe: ele sozinho. */
export const bossTeam = (boss: Boss): RunUnit[] => [{ id: boss.unit, copies: 1 }];

// ---------- Luta ----------

/** Tempo máximo de luta: passou disso, ganha quem tem mais vida (em % do total). */
export const BATTLE_LIMIT_MS = 60_000;
/** Pisos dos efeitos acumulados: o dano inimigo não cai abaixo de 40% e o intervalo de ataque não cai abaixo de 50%. */
const MIN_DAMAGE_TAKEN = 0.4;
const MIN_INTERVAL = 0.5;
const CLUTCH_BELOW = 0.5;

export interface BattleEvent {
  /** Momento da luta em ms. */
  t: number;
  /** Lado que agiu (0 = jogador, 1 = adversário) e qual personagem do time dele. */
  side: 0 | 1;
  unit: number;
  kind: 'hit' | 'heal';
  /** hit: personagem do outro time que "recebe" o golpe (só visual: a vida é do time). */
  target: number;
  /** hit: dano total (com a queimadura); heal: vida recuperada. */
  amount: number;
  crit: boolean;
  /** Vida e escudo dos dois times depois do evento. */
  hp: [number, number];
  shield: [number, number];
}

export interface BattleResult {
  /** 0 = jogador, 1 = adversário, null = empate. */
  winner: 0 | 1 | null;
  events: BattleEvent[];
  maxHp: [number, number];
  /** Escudo de cada time no começo da luta. */
  startShield: [number, number];
  durationMs: number;
}

interface Fighter {
  role: Role;
  stats: UnitStats;
  /** Golpes dados (a fúria cresce com eles). */
  hits: number;
  nextAt: number;
  nextHealAt: number;
}

interface Side {
  fighters: Fighter[];
  hp: number;
  maxHp: number;
  shield: number;
  /** Bônus das sinergias (frações: 0,1 = 10%). */
  atkBonus: number;
  critBonus: number;
  ramp: number;
  clutch: number;
  lifesteal: number;
  /** Multiplicador do dano que este time causa no outro (enfraquecimentos do adversário já aplicados). */
  damageDealt: number;
}

function buildSide(team: RunUnit[], factors: Factors, random: () => number) {
  const bonus = (kind: SynergyKind) => {
    let total = 0;
    const counts = seriesCounts(team);
    for (const { id } of SERIES) {
      const level = synergyLevel(counts[id] ?? 0);
      if (level && SYNERGY[id].kind === kind) total += SYNERGY[id].values[level - 1] / 100;
    }
    return total;
  };
  const units = team.flatMap((u) => {
    const boss = BOSS_BY_UNIT.get(u.id);
    if (boss) return [{ role: boss.role, stats: boss.stats }];
    const e = ROSTER_BY_ID.get(u.id);
    return e ? [{ role: e.role, stats: unitStats(e, u.copies, factors) }] : [];
  });
  const auraOf = (role: Role) => units.filter((u) => u.role === role).reduce((mult, u) => mult * (1 - u.stats.ability / 100), 1);
  // Intervalo do time: acelerações dos aliados (com piso) e a sinergia de velocidade.
  const intervalMult = Math.max(MIN_INTERVAL, auraOf('haste')) / (1 + bonus('haste'));
  const maxHp = Math.round(units.reduce((sum, u) => sum + u.stats.hp, 0) * (1 + bonus('hp')));
  const side: Side = {
    fighters: units.map((u) => {
      const interval = Math.max(150, Math.round(u.stats.interval * intervalMult));
      return {
        role: u.role,
        stats: { ...u.stats, interval },
        hits: 0,
        // Começo dessincronizado: cada um dá o primeiro golpe entre meio e um intervalo.
        nextAt: Math.round(interval * (0.5 + random() * 0.5)),
        nextHealAt: HEAL_EVERY_MS,
      };
    }),
    hp: maxHp,
    maxHp,
    shield: units.filter((u) => u.role === 'shield').reduce((sum, u) => sum + u.stats.ability, 0),
    atkBonus: bonus('atk'),
    critBonus: bonus('crit'),
    ramp: bonus('ramp'),
    clutch: bonus('clutch'),
    lifesteal: bonus('lifesteal'),
    damageDealt: 1,
  };
  // Quanto este time enfraquece o dano do outro (aplicado no outro lado em `simulateBattle`).
  const weakening = auraOf('weaken') * (1 - bonus('weaken'));
  return { side, weakening };
}

/**
 * Resolve a luta entre dois times. Determinística para a mesma semente: o servidor decide o resultado e o site
 * roda de novo só para animar. Cada personagem bate no seu ritmo e o dano sai da barra do outro time (escudo
 * primeiro); o time que zerar a vida perde.
 */
export function simulateBattle(mine: RunUnit[], theirs: RunUnit[], factors: Factors, seed: number): BattleResult {
  const random = seededRandom(seed);
  const a = buildSide(mine, factors, random);
  const b = buildSide(theirs, factors, random);
  const sides: [Side, Side] = [a.side, b.side];
  sides[0].damageDealt = Math.max(MIN_DAMAGE_TAKEN, b.weakening);
  sides[1].damageDealt = Math.max(MIN_DAMAGE_TAKEN, a.weakening);
  const maxHp: [number, number] = [sides[0].maxHp, sides[1].maxHp];
  const startShield: [number, number] = [sides[0].shield, sides[1].shield];
  const events: BattleEvent[] = [];
  const snapshot = () => ({
    hp: [sides[0].hp, sides[1].hp] as [number, number],
    shield: [sides[0].shield, sides[1].shield] as [number, number],
  });

  let now = 0;
  const alive = () => sides[0].hp > 0 && sides[1].hp > 0;
  while (alive() && sides[0].fighters.length + sides[1].fighters.length > 0) {
    // Próxima ação: o menor horário entre golpes e curas dos dois times (empate: jogador, na ordem do time).
    let action = { at: Infinity, side: 0 as 0 | 1, unit: 0, heal: false };
    for (const s of [0, 1] as const) {
      for (let unit = 0; unit < sides[s].fighters.length; unit++) {
        const f = sides[s].fighters[unit];
        if (f.nextAt < action.at) action = { at: f.nextAt, side: s, unit, heal: false };
        if (f.role === 'heal' && f.nextHealAt < action.at) action = { at: f.nextHealAt, side: s, unit, heal: true };
      }
    }
    if (action.at > BATTLE_LIMIT_MS) break;
    now = action.at;
    const own = sides[action.side];
    const foe = sides[action.side === 0 ? 1 : 0];
    const fighter = own.fighters[action.unit];

    if (action.heal) {
      fighter.nextHealAt += HEAL_EVERY_MS;
      const amount = Math.min(fighter.stats.ability, own.maxHp - own.hp);
      if (amount <= 0) continue;
      own.hp += amount;
      events.push({ t: now, side: action.side, unit: action.unit, kind: 'heal', target: 0, amount, crit: false, ...snapshot() });
      continue;
    }

    fighter.nextAt += fighter.stats.interval;
    const rage = fighter.role === 'rage' ? 1 + (fighter.hits * fighter.stats.ability) / 100 : 1;
    fighter.hits++;
    let crit = 1;
    if (fighter.role === 'crit' && random() * 100 < fighter.stats.ability) crit = CRIT_MULT;
    else if (own.critBonus > 0 && random() < own.critBonus) crit = 2;
    const mult =
      (1 + own.atkBonus) *
      rage *
      crit *
      (1 + (own.ramp * now) / 1000) *
      (own.hp < own.maxHp * CLUTCH_BELOW ? 1 + own.clutch : 1) *
      own.damageDealt;
    const hit = Math.max(1, Math.round(fighter.stats.atk * mult));
    // Queimadura: parte do dano vai direto na vida, sem passar pelo escudo.
    const burn = fighter.role === 'burn' ? Math.round(fighter.stats.ability * mult) : 0;
    const absorbed = Math.min(foe.shield, hit);
    foe.shield -= absorbed;
    foe.hp = Math.max(0, foe.hp - (hit - absorbed) - burn);
    if (own.lifesteal > 0) own.hp = Math.min(own.maxHp, own.hp + Math.round((hit + burn) * own.lifesteal));
    events.push({
      t: now,
      side: action.side,
      unit: action.unit,
      kind: 'hit',
      target: Math.floor(random() * Math.max(1, foe.fighters.length)),
      amount: hit + burn,
      crit: crit > 1,
      ...snapshot(),
    });
  }

  // Ninguém zerou (tempo esgotado ou time vazio): ganha quem tem a maior fração de vida.
  const fraction = (s: Side) => (s.maxHp > 0 ? s.hp / s.maxHp : 0);
  const winner = sides[1].hp <= 0 && sides[0].hp > 0 ? 0 : sides[0].hp <= 0 && sides[1].hp > 0 ? 1 : null;
  const byFraction = fraction(sides[0]) > fraction(sides[1]) ? 0 : fraction(sides[1]) > fraction(sides[0]) ? 1 : null;
  return { winner: alive() ? byFraction : winner, events, maxHp, startShield, durationMs: now };
}

export const outcomeOf = (result: BattleResult): Outcome => (result.winner === 0 ? 'win' : result.winner === 1 ? 'loss' : 'draw');
