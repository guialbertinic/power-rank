import { describe, expect, it } from 'vitest';
import { achievementOfReward, achievementProgress, ACHIEVEMENTS, EMPTY_STATS, reachedAchievements } from './achievements';
import { COSMETICS, cosmeticById } from './cosmetics';

describe('conquistas', () => {
  it('cada conquista dá um item próprio, que só sai dela', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(new Set(ACHIEVEMENTS.map((a) => a.reward)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      const item = cosmeticById(a.reward);
      expect(item?.achievement, a.reward).toBe(true);
      expect(achievementOfReward(a.reward)?.id).toBe(a.id);
    }
    // Todo item de conquista tem uma conquista que o dá.
    expect(COSMETICS.filter((c) => c.achievement).every((c) => achievementOfReward(c.id))).toBe(true);
  });

  it('desbloqueia pelos contadores', () => {
    expect(reachedAchievements(EMPTY_STATS)).toEqual([]);
    const ids = (stats: Partial<typeof EMPTY_STATS>) => reachedAchievements({ ...EMPTY_STATS, ...stats }).map((a) => a.id);
    expect(ids({ games: 1 })).toEqual(['first-game']);
    expect(ids({ games: 1, bestScore: 860 })).toEqual(['first-game', 'score-700', 'score-850']);
    expect(ids({ bestScore: 1000 })).toContain('perfect');
    expect(ids({ dailyStreak: 7 })).toEqual(['daily-3', 'daily-7']);
    expect(ids({ partyWins: 5 })).toEqual(['party-win', 'party-win-5']);
    expect(ids({ modes700: 4 })).toEqual([]);
    expect(ids({ modes700: 5 })).toEqual(['eclectic']);
  });

  it('progresso limitado à meta', () => {
    const veteran = ACHIEVEMENTS.find((a) => a.id === 'veteran')!;
    expect(achievementProgress(veteran, { ...EMPTY_STATS, games: 37 })).toBe(37);
    expect(achievementProgress(veteran, { ...EMPTY_STATS, games: 250 })).toBe(100);
  });
});
