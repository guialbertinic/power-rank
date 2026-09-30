import { useEffect, useState } from 'react';
import type { AdminAction } from '../../game/admin';
import { useI18n } from '../../i18n';
import { fetchActions } from './api';
import { actionText, dateTimeText, errorText } from './format';

/** Registro das últimas ações de admin (quem, o quê, em quem, quando). */
export default function ActionsPanel() {
  const { t, lang } = useI18n();
  const [actions, setActions] = useState<AdminAction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchActions()
      .then(setActions)
      .catch((err) => setError(errorText(err, lang)));
  }, []);

  return (
    <section className="panel admin-section">
      <h2 className="section-title">{t('admin.tab.actions')}</h2>
      {error && <p className="error">{error}</p>}
      {actions && !actions.length && <p className="muted">{t('admin.none')}</p>}
      <ul className="admin-list admin-small">
        {actions?.map((a) => (
          <li key={a.id} className="admin-log-row">
            <span className="muted">{dateTimeText(a.createdAt, lang)}</span>
            <span>
              {a.playerName && <strong>{a.playerName}: </strong>}
              {actionText(a, t, lang)}
            </span>
            <span className="muted">{a.admin}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
