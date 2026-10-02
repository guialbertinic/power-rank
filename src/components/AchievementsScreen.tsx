import { useEffect, useState } from 'react';
import { fetchAchievements } from '../api';
import {
  ACHIEVEMENT_GROUPS,
  achievementProgress,
  ACHIEVEMENTS,
  ECLECTIC_MIN_SCORE,
  type Achievement,
  type AchievementsState,
} from '../game/achievements';
import { cosmeticById } from '../game/cosmetics';
import { MODES } from '../game/modes';
import { cosmeticLabel, useI18n } from '../i18n';
import { AchievementReward } from './AchievementUnlocked';

/** Conquistas da conta: resumo no topo e cartões por grupo (partidas, pontuação, desafio, party, categorias). */
export default function AchievementsScreen({ token }: { token: string }) {
  const { t, lang } = useI18n();
  const [state, setState] = useState<AchievementsState | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAchievements(token)
      .then((s) => {
        if (!cancelled) setState(s);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const date = (ms: number) => new Date(ms).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US');
  const unlockedCount = state ? ACHIEVEMENTS.filter((a) => state.unlocked[a.id]).length : 0;

  const card = (a: Achievement, s: AchievementsState) => {
    const at = s.unlocked[a.id];
    const progress = achievementProgress(a, s.stats);
    const reward = cosmeticById(a.reward);
    return (
      <li key={a.id} className={`achievement-card${at ? ' done' : ''}`} data-achievement={a.id}>
        <AchievementReward itemId={a.reward} locked={!at} />
        <div className="achievement-card-body">
          <strong className="achievement-card-name">{t(`ach.${a.id}.name`)}</strong>
          <p className="achievement-card-desc">{t(`ach.${a.id}.desc`, { n: MODES.length, min: ECLECTIC_MIN_SCORE })}</p>
          {reward && (
            <p className="achievement-card-reward">
              {reward.slot === 'badge' ? t('ach.rewardBadge') : t('ach.rewardTitle')}
              <span>{cosmeticLabel(reward, lang)}</span>
            </p>
          )}
          {at ? (
            <p className="achievement-date">{t('ach.done', { date: date(at) })}</p>
          ) : (
            <div className="achievement-progress">
              <span className="achievement-bar" aria-hidden="true">
                <span style={{ width: `${(progress / a.goal) * 100}%` }} />
              </span>
              <span className="achievement-count">
                {progress}/{a.goal}
              </span>
            </div>
          )}
        </div>
      </li>
    );
  };

  return (
    <section className="achievements">
      <div className="panel achievements-summary">
        <p className="achievements-summary-value">
          {state ? unlockedCount : '–'}
          <span>/{ACHIEVEMENTS.length}</span>
        </p>
        <p className="achievements-summary-label">{t('ach.unlockedLabel')}</p>
        <span className="achievement-bar" aria-hidden="true">
          <span style={{ width: `${(unlockedCount / ACHIEVEMENTS.length) * 100}%` }} />
        </span>
        <p className="muted achievements-hint">{t('ach.hint')}</p>
      </div>

      {error && <p className="error achievements-error">{t('ach.error')}</p>}

      {state &&
        ACHIEVEMENT_GROUPS.map((group) => (
          <section key={group} className="panel achievements-group">
            <h2 className="section-title">{t(`ach.group.${group}`)}</h2>
            <ul className="achievements-grid">{ACHIEVEMENTS.filter((a) => a.group === group).map((a) => card(a, state))}</ul>
          </section>
        ))}
    </section>
  );
}
