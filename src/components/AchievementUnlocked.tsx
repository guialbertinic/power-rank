import { achievementById, ECLECTIC_MIN_SCORE } from '../game/achievements';
import { cosmeticById } from '../game/cosmetics';
import { MODES } from '../game/modes';
import { cosmeticLabel, useI18n } from '../i18n';
import BadgeIcon from './BadgeIcon';

interface Props {
  /** Ids das conquistas desbloqueadas. */
  ids: string[];
  /** Aviso na home: botão para fechar (marca como visto). Sem ele, fica fixo (resultado da partida). */
  onClose?: () => void;
}

/** "Conquista desbloqueada!": nome, meta e o prêmio de cada uma. */
export default function AchievementUnlocked({ ids, onClose }: Props) {
  const { t, lang } = useI18n();
  const achievements = ids.flatMap((id) => achievementById(id) ?? []);
  if (!achievements.length) return null;

  return (
    <section className="achievement-unlocked" role="status">
      <h2 className="achievement-unlocked-title">{achievements.length > 1 ? t('ach.unlockedMany') : t('ach.unlocked')}</h2>
      <ul className="achievement-unlocked-list">
        {achievements.map((a) => {
          const reward = cosmeticById(a.reward);
          return (
            <li key={a.id} className="achievement-unlocked-item" data-achievement={a.id}>
              <AchievementReward itemId={a.reward} />
              <span className="achievement-text">
                <strong>{t(`ach.${a.id}.name`)}</strong>
                <span className="muted">
                  {t(`ach.${a.id}.desc`, { n: MODES.length, min: ECLECTIC_MIN_SCORE })}
                </span>
                {reward && (
                  <span className="achievement-reward-name">
                    {t('ach.reward', { item: cosmeticLabel(reward, lang) })} · {t('ach.equipHint')}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {onClose && (
        <button className="btn btn-primary btn-sm" onClick={onClose}>
          {t('ach.ok')}
        </button>
      )}
    </section>
  );
}

/** Ícone do prêmio: o emblema, ou uma faixa para título. */
export function AchievementReward({ itemId, locked }: { itemId: string; locked?: boolean }) {
  const item = cosmeticById(itemId);
  return (
    <span className={`achievement-icon${locked ? ' locked' : ''}`}>
      {item?.slot === 'badge' ? (
        <BadgeIcon id={item.id} />
      ) : (
        // Título: uma faixa (o texto do título aparece no nome do prêmio).
        <svg className="badge-icon achievement-title-mark" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2 7h20v8H2z" />
          <path d="M2 15l2.5 3L7 15zM22 15l-2.5 3L17 15z" />
        </svg>
      )}
    </span>
  );
}
