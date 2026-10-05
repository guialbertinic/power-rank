import { describe, expect, it } from 'vitest';
import {
  afterBattle,
  BOSSES,
  bossFor,
  bossTeam,
  botTeam,
  BENCH_SIZE,
  buyOffer,
  incomeFor,
  isRunCleared,
  isRunOver,
  MAX_LIVES,
  MAX_ROUNDS,
  MAX_SLOTS,
  moveUnit,
  newRun,
  outcomeOf,
  powerFactors,
  rerollShop,
  rewardFor,
  rollShop,
  ROSTER,
  ROSTER_BY_ID,
  sanitizeTeam,
  seededRandom,
  sellUnit,
  sellValue,
  SERIES,
  seriesCounts,
  SHOP_SIZE,
  shopOdds,
  simulateBattle,
  slotsFor,
  starProgress,
  starsOf,
  synergyLevel,
  unitStats,
  type RunState,
} from './autobattle';

const NO_FACTORS = {};
const run = (over: Partial<RunState> = {}): RunState => ({
  round: 1,
  wins: 0,
  losses: 0,
  gold: 6,
  team: [],
  bench: [],
  shop: ['nami', 'zoro', 'luffy', 'nami', 'usopp'],
  history: [],
  ...over,
});

describe('elenco', () => {
  it('tem 8 obras com 7 personagens cada (3 / 2 / 2 por tier), sem repetir', () => {
    expect(new Set(ROSTER.map((e) => e.id)).size).toBe(ROSTER.length);
    for (const { id } of SERIES) {
      const tiers = ROSTER.filter((e) => e.series === id).map((e) => e.tier);
      expect([1, 2, 3].map((tier) => tiers.filter((t) => t === tier).length)).toEqual([3, 2, 2]);
    }
  });
});

describe('fatores de força', () => {
  it('ficam entre 0,85 e 1,15, com a mesma soma em toda obra (escalas de power diferentes não importam)', () => {
    // Dragon Ball em 90+, Demon Slayer em 30–60: a ordem dentro da obra é o que conta.
    const power = new Map(ROSTER.map((e, i) => [e.id, e.series === 'dragonball' ? 90 + (i % 7) : 30 + (i % 7) * 4]));
    const factors = powerFactors((id) => power.get(id));
    const sums = SERIES.map(({ id }) =>
      ROSTER.filter((e) => e.series === id).reduce((sum, e) => sum + factors[e.id], 0),
    );
    for (const value of Object.values(factors)) {
      expect(value).toBeGreaterThanOrEqual(0.85);
      expect(value).toBeLessThanOrEqual(1.15);
    }
    for (const sum of sums) expect(sum).toBeCloseTo(7, 5);
  });

  it('personagem sem power conhecido fica de fora (atributos com fator 1)', () => {
    const factors = powerFactors((id) => (id === 'goku' ? undefined : 50));
    expect(factors.goku).toBeUndefined();
    expect(unitStats(ROSTER_BY_ID.get('goku')!, 1, factors)).toEqual(unitStats(ROSTER_BY_ID.get('goku')!, 1, NO_FACTORS));
  });
});

describe('atributos', () => {
  it('estrela e tier aumentam vida e ataque', () => {
    const nami = ROSTER_BY_ID.get('nami')!;
    const luffy = ROSTER_BY_ID.get('luffy')!;
    expect(unitStats(nami, 3, NO_FACTORS).hp).toBeGreaterThan(unitStats(nami, 1, NO_FACTORS).hp);
    expect(unitStats(nami, 9, NO_FACTORS).atk).toBeGreaterThan(unitStats(nami, 3, NO_FACTORS).atk);
    expect(unitStats(luffy, 1, NO_FACTORS).hp).toBeGreaterThan(unitStats(nami, 1, NO_FACTORS).hp);
  });

  it('estrelas: 1, 3 e 9 cópias', () => {
    expect([1, 2, 3, 8, 9].map(starsOf)).toEqual([1, 1, 2, 2, 3]);
    expect(starProgress(2)).toEqual([2, 3]);
    expect(starProgress(5)).toEqual([2, 6]);
    expect(starProgress(9)).toBeNull();
  });
});

describe('loja e run', () => {
  it('regras da rodada: espaços, moedas e chances somando 100', () => {
    expect([1, 2, 3, 4, 9].map(slotsFor)).toEqual([3, 4, 5, MAX_SLOTS, MAX_SLOTS]);
    expect([1, 5, 12].map(incomeFor)).toEqual([6, 10, 10]);
    for (const round of [1, 3, 5, 8, 12]) expect(shopOdds(round).reduce((a, b) => a + b)).toBe(100);
  });

  it('a loja só oferece personagens do elenco, e tier 3 não sai na primeira rodada', () => {
    const random = seededRandom(7);
    for (let i = 0; i < 50; i++) {
      const shop = rollShop(1, random);
      expect(shop).toHaveLength(SHOP_SIZE);
      for (const id of shop) expect(ROSTER_BY_ID.get(id)!.tier).toBeLessThan(3);
    }
  });

  it('comprar debita o tier, ocupa um espaço e tira a oferta', () => {
    const next = buyOffer(run(), 1) as RunState;
    expect(next.gold).toBe(4);
    expect(next.team).toEqual([{ id: 'zoro', copies: 1 }]);
    expect(next.shop[1]).toBeNull();
    expect(buyOffer(next, 1)).toBe('no_offer');
  });

  it('com o time cheio, personagem novo vai para o banco; cópia repetida soma onde ele estiver', () => {
    const full = run({ team: [{ id: 'nami', copies: 2 }, { id: 'goku', copies: 1 }, { id: 'gojo', copies: 1 }] });
    const benched = buyOffer(full, 1) as RunState;
    expect(benched.team).toHaveLength(3);
    expect(benched.bench).toEqual([{ id: 'zoro', copies: 1 }]);
    const next = buyOffer(full, 0) as RunState;
    expect(next.team[0]).toEqual({ id: 'nami', copies: 3 });
    expect(starsOf(next.team[0].copies)).toBe(2);
    const onBench = buyOffer(run({ bench: [{ id: 'zoro', copies: 2 }] }), 1) as RunState;
    expect(onBench.bench).toEqual([{ id: 'zoro', copies: 3 }]);
    expect(onBench.team).toEqual([]);
  });

  it('time e banco cheios: só cabe cópia de quem já tem', () => {
    const team = ['goku', 'gojo', 'vegeta'].map((id) => ({ id, copies: 1 }));
    const bench = ['naruto', 'sasuke', 'ichigo', 'aizen', 'nami'].slice(0, BENCH_SIZE).map((id) => ({ id, copies: 1 }));
    expect(buyOffer(run({ team, bench }), 1)).toBe('no_slot');
    expect((buyOffer(run({ team, bench }), 0) as RunState).bench[4]).toEqual({ id: 'nami', copies: 2 });
  });

  it('mover: time ↔ banco, respeitando os espaços', () => {
    const start = run({ team: [{ id: 'goku', copies: 3 }], bench: [{ id: 'nami', copies: 1 }] });
    const benched = moveUnit(start, 'goku') as RunState;
    expect(benched.team).toEqual([]);
    expect(benched.bench.map((u) => u.id)).toEqual(['nami', 'goku']);
    expect((moveUnit(benched, 'nami') as RunState).team).toEqual([{ id: 'nami', copies: 1 }]);
    expect(moveUnit(start, 'zoro')).toBe('not_owned');
    const fullTeam = run({ team: ['goku', 'gojo', 'vegeta'].map((id) => ({ id, copies: 1 })), bench: [{ id: 'nami', copies: 1 }] });
    expect(moveUnit(fullTeam, 'nami')).toBe('no_slot');
    const fullBench = run({ team: [{ id: 'goku', copies: 1 }], bench: ['naruto', 'sasuke', 'ichigo', 'aizen', 'nami'].map((id) => ({ id, copies: 1 })) });
    expect(moveUnit(fullBench, 'goku')).toBe('bench_full');
  });

  it('vender também funciona para quem está no banco', () => {
    const sold = sellUnit(run({ gold: 0, bench: [{ id: 'luffy', copies: 1 }] }), 'luffy') as RunState;
    expect(sold.gold).toBe(3);
    expect(sold.bench).toEqual([]);
  });

  it('recusa sem moedas e na estrela máxima', () => {
    expect(buyOffer(run({ gold: 2 }), 2)).toBe('no_gold');
    expect(buyOffer(run({ team: [{ id: 'nami', copies: 9 }] }), 0)).toBe('max_stars');
  });

  it('vender devolve o custo das cópias (menos 1 depois de subir de estrela)', () => {
    expect(sellValue(2, 1)).toBe(2);
    expect(sellValue(1, 3)).toBe(2);
    const sold = sellUnit(run({ gold: 0, team: [{ id: 'zoro', copies: 3 }] }), 'zoro') as RunState;
    expect(sold.gold).toBe(5);
    expect(sold.team).toEqual([]);
    expect(sellUnit(run(), 'zoro')).toBe('not_owned');
  });

  it('rolar custa 1 e troca as ofertas', () => {
    const next = rerollShop(run(), seededRandom(1)) as RunState;
    expect(next.gold).toBe(5);
    expect(next.shop).toHaveLength(SHOP_SIZE);
    expect(rerollShop(run({ gold: 0 }), seededRandom(1))).toBe('no_gold');
  });

  it('depois da luta: conta o resultado, soma as moedas da rodada e abre loja nova', () => {
    const start = newRun(seededRandom(3));
    const won = afterBattle({ ...start, gold: 2 }, 'win', seededRandom(4));
    expect(won).toMatchObject({ round: 2, wins: 1, losses: 0, gold: 2 + incomeFor(2) });
    const draw = afterBattle(start, 'draw', seededRandom(4));
    expect(draw).toMatchObject({ round: 2, wins: 0, losses: 0 });
    // O resultado de cada rodada fica guardado, na ordem (a trilha das rodadas pinta por ele).
    expect(afterBattle(won, 'loss', seededRandom(5)).history).toEqual(['win', 'loss']);
  });

  it('a run tem 10 rodadas e 3 vidas, e paga pelas vitórias', () => {
    const cleared = afterBattle(run({ round: MAX_ROUNDS, wins: 9 }), 'win', seededRandom(1));
    expect(isRunOver(cleared)).toBe(true);
    expect(isRunCleared(cleared)).toBe(true);
    expect(cleared.shop).toEqual([]);
    const dead = afterBattle(run({ round: 3, losses: MAX_LIVES - 1 }), 'loss', seededRandom(1));
    expect(isRunOver(dead)).toBe(true);
    expect(isRunCleared(dead)).toBe(false);
    expect(isRunOver(run({ round: 9, wins: 8, losses: 2 }))).toBe(false);
    expect([0, 2, 3, 10, 99].map(rewardFor)).toEqual([0, 0, 10, 100, 100]);
  });

  it('chefes nas rodadas 5 e 10: é preciso vencer, senão a run acaba', () => {
    expect([1, 4, 5, 6, 10].map((round) => bossFor(round)?.id ?? null)).toEqual([null, null, 'mid', null, 'final']);
    // O chefe é de fora do elenco (não aparece na loja nem em fantasma) e luta sozinho.
    for (const boss of Object.values(BOSSES)) {
      expect(ROSTER_BY_ID.has(boss.unit)).toBe(false);
      expect(bossTeam(boss)).toEqual([{ id: boss.unit, copies: 1 }]);
      const fight = simulateBattle([{ id: 'nami', copies: 1 }], bossTeam(boss), NO_FACTORS, 1);
      expect(fight.maxHp[1]).toBe(boss.stats.hp);
      expect(outcomeOf(fight)).toBe('loss');
    }
    expect(isRunOver(afterBattle(run({ round: 5 }), 'win', seededRandom(1)))).toBe(false);
    for (const outcome of ['loss', 'draw'] as const) {
      const failed = afterBattle(run({ round: 5 }), outcome, seededRandom(1));
      expect(failed.losses).toBe(MAX_LIVES);
      expect(isRunOver(failed)).toBe(true);
    }
    // Fora do chefe, derrota tira uma vida só e empate não tira nenhuma.
    expect(afterBattle(run({ round: 4 }), 'loss', seededRandom(1)).losses).toBe(1);
    expect(afterBattle(run({ round: 4 }), 'draw', seededRandom(1)).losses).toBe(0);
    // Perder para o chefe final não conta como run completa.
    expect(isRunCleared(afterBattle(run({ round: MAX_ROUNDS }), 'loss', seededRandom(1)))).toBe(false);
  });

  it('time vindo de fora é limpo: só elenco, sem repetir, cópias de 1 a 9', () => {
    expect(
      sanitizeTeam([{ id: 'goku', copies: 50 }, { id: 'goku', copies: 1 }, { id: 'pikachu', copies: 1 }, { id: 'nami' }, null]),
    ).toEqual([
      { id: 'goku', copies: 9 },
      { id: 'nami', copies: 1 },
    ]);
    expect(sanitizeTeam('x')).toEqual([]);
  });

  it('bot respeita os espaços da rodada e não repete personagem', () => {
    const random = seededRandom(11);
    for (const round of [1, 2, 6, 12]) {
      const team = botTeam(round, random);
      expect(team).toHaveLength(slotsFor(round));
      expect(sanitizeTeam(team)).toEqual(team);
    }
  });
});

describe('sinergia', () => {
  it('níveis em 2, 4 e 6 personagens da obra', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(synergyLevel)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(seriesCounts([{ id: 'goku', copies: 1 }, { id: 'vegeta', copies: 3 }, { id: 'nami', copies: 1 }])).toEqual({
      dragonball: 2,
      onepiece: 1,
    });
  });
});

describe('luta', () => {
  const strong = [{ id: 'goku', copies: 9 }, { id: 'vegeta', copies: 9 }, { id: 'piccolo', copies: 3 }];
  const weak = [{ id: 'nami', copies: 1 }];

  it('é determinística para a mesma semente', () => {
    const a = simulateBattle(strong, weak, NO_FACTORS, 123);
    const b = simulateBattle(strong, weak, NO_FACTORS, 123);
    expect(a).toEqual(b);
  });

  it('o time muito mais forte ganha dos dois lados', () => {
    expect(outcomeOf(simulateBattle(strong, weak, NO_FACTORS, 1))).toBe('win');
    expect(outcomeOf(simulateBattle(weak, strong, NO_FACTORS, 1))).toBe('loss');
  });

  it('a vida nunca passa do máximo nem fica negativa, e a luta termina no tempo', () => {
    const random = seededRandom(99);
    for (let i = 0; i < 40; i++) {
      const result = simulateBattle(botTeam(8, random), botTeam(8, random), NO_FACTORS, i);
      expect(result.durationMs).toBeLessThanOrEqual(60_000);
      for (const e of result.events) {
        for (const side of [0, 1] as const) {
          expect(e.hp[side]).toBeGreaterThanOrEqual(0);
          expect(e.hp[side]).toBeLessThanOrEqual(result.maxHp[side]);
          expect(e.shield[side]).toBeGreaterThanOrEqual(0);
        }
      }
      const last = result.events[result.events.length - 1];
      if (result.winner !== null && result.durationMs < 60_000) expect(last.hp[result.winner === 0 ? 1 : 0]).toBe(0);
    }
  });

  it('escudo absorve o dano antes da vida, e a queimadura passa por ele', () => {
    // Gojo (escudo) contra um atacante sem queimadura: o primeiro golpe recebido não tira vida.
    const shielded = simulateBattle([{ id: 'gojo', copies: 1 }], [{ id: 'yamcha', copies: 1 }], NO_FACTORS, 5);
    const firstHit = shielded.events.find((e) => e.side === 1 && e.kind === 'hit')!;
    expect(shielded.startShield[0]).toBeGreaterThan(0);
    expect(firstHit.hp[0]).toBe(shielded.maxHp[0]);
    expect(firstHit.shield[0]).toBeLessThan(shielded.startShield[0]);
    // Contra a Nobara (queimadura), a vida cai já no primeiro golpe, com escudo sobrando.
    const burned = simulateBattle([{ id: 'gojo', copies: 1 }], [{ id: 'nobara', copies: 1 }], NO_FACTORS, 5);
    const firstBurn = burned.events.find((e) => e.side === 1 && e.kind === 'hit')!;
    expect(firstBurn.hp[0]).toBeLessThan(burned.maxHp[0]);
    expect(firstBurn.shield[0]).toBeGreaterThan(0);
  });

  it('sinergia de vida aumenta a barra do time', () => {
    const one = simulateBattle([{ id: 'nami', copies: 1 }], weak, NO_FACTORS, 1).maxHp[0];
    const usopp = simulateBattle([{ id: 'usopp', copies: 1 }], weak, NO_FACTORS, 1).maxHp[0];
    const both = simulateBattle([{ id: 'nami', copies: 1 }, { id: 'usopp', copies: 1 }], weak, NO_FACTORS, 1).maxHp[0];
    expect(both).toBeGreaterThan(one + usopp);
  });
});
