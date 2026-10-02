import { useEffect, useState } from 'react';
import type { ReportGroup } from '../../game/admin';
import type { ReportReason } from '../../game/reports';
import { useI18n } from '../../i18n';
import { closeReports, fetchReports } from './api';
import { CharacterThumb } from './CharactersPanel';
import { dateTimeText, errorText } from './format';

interface Props {
  /** Abre a conta denunciada na aba Jogadores (renomear, suspender). */
  onOpenPlayer: (id: number) => void;
  /** Abre o personagem na aba Personagens (trocar imagem, desativar). */
  onOpenCharacter: (id: string) => void;
}

/**
 * Fila de moderação: denúncias abertas de nick e pedidos de remoção de imagem, juntas por alvo (mais denunciados
 * primeiro). O admin age pela conta ou pelo personagem e fecha o grupo como resolvido, ou descarta.
 */
export default function ModerationPanel({ onOpenPlayer, onOpenCharacter }: Props) {
  const { t, lang } = useI18n();
  const [groups, setGroups] = useState<ReportGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchReports()
      .then(setGroups)
      .catch((err) => setError(errorText(err, lang)));
  }, []);

  const close = (group: ReportGroup, status: 'resolved' | 'dismissed') => {
    setBusy(true);
    setError(null);
    closeReports(group, status)
      .then(setGroups)
      .catch((err) => setError(errorText(err, lang)))
      .finally(() => setBusy(false));
  };

  return (
    <section className="panel admin-section">
      <h2 className="section-title">{t('admin.tab.moderation')}</h2>
      {error && <p className="error">{error}</p>}
      {groups && !groups.length && <p className="muted">{t('admin.moderation.empty')}</p>}
      <ul className="admin-list">
        {groups?.map((g) => (
          <li key={`${g.kind}:${g.target}`} className="admin-report">
            {g.kind === 'image' && g.character && <CharacterThumb character={g.character} size={48} />}
            <div className="admin-report-body">
              <p>
                <span className="admin-badge">{t(g.kind === 'nick' ? 'admin.moderation.nick' : 'admin.moderation.image')}</span>{' '}
                <strong>{g.targetName}</strong>
                {g.kind === 'nick' && g.playerId === null && <span className="muted admin-small"> · {t('admin.moderation.guest')}</span>}
              </p>
              <p className="admin-small">
                {t('admin.moderation.count', { n: g.count })} ·{' '}
                {(Object.entries(g.reasons) as [ReportReason, number][])
                  .map(([reason, n]) => `${t(`report.reason.${reason}`)} (${n})`)
                  .join(', ')}
              </p>
              <p className="muted admin-small">{dateTimeText(g.lastAt, lang)}</p>
              <div className="admin-report-actions">
                {g.kind === 'nick' && g.playerId !== null && (
                  <button className="btn btn-secondary btn-sm" onClick={() => onOpenPlayer(g.playerId!)}>
                    {t('admin.moderation.openPlayer')}
                  </button>
                )}
                {g.kind === 'image' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => onOpenCharacter(g.target)}>
                    {t('admin.moderation.openCharacter')}
                  </button>
                )}
                <button className="btn btn-primary btn-sm" onClick={() => close(g, 'resolved')} disabled={busy}>
                  {t('admin.moderation.resolve')}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => close(g, 'dismissed')} disabled={busy}>
                  {t('admin.moderation.dismiss')}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
