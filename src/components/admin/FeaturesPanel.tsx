import { useEffect, useState } from 'react';
import type { AdminFeature } from '../../game/admin';
import type { FeatureId } from '../../game/features';
import { useI18n } from '../../i18n';
import { fetchFeatures, setFeature } from './api';
import { dateTimeText, errorText, FEATURE_LABEL } from './format';

/** Chaves dos minigames: ligar/desligar sem deploy. Vale para quem voltar à home do jogo. */
export default function FeaturesPanel() {
  const { t, lang } = useI18n();
  const [features, setFeatures] = useState<AdminFeature[] | null>(null);
  const [busy, setBusy] = useState<FeatureId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFeatures()
      .then(setFeatures)
      .catch((err) => setError(errorText(err, lang)));
  }, []);

  const toggle = async (feature: AdminFeature) => {
    setBusy(feature.id);
    setError(null);
    try {
      setFeatures(await setFeature(feature.id, !feature.enabled));
    } catch (err) {
      setError(errorText(err, lang));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="panel admin-section">
      <h2 className="section-title">{t('admin.tab.features')}</h2>
      <p className="muted">{t('admin.features.hint')}</p>
      {!features && !error && <p className="muted">{t('admin.loading')}</p>}
      <ul className="admin-list">
        {features?.map((f) => (
          <li key={f.id} className="admin-feature">
            <div>
              <strong>{t(FEATURE_LABEL[f.id])}</strong> <code className="muted">{f.id}</code>
              <div className="muted admin-small">
                {f.updatedAt ? t('admin.features.updated', { date: dateTimeText(f.updatedAt, lang) }) : t('admin.features.noRow')}
              </div>
            </div>
            <span className={`admin-status${f.enabled ? ' on' : ''}`}>{t(f.enabled ? 'admin.on' : 'admin.off')}</span>
            <button
              className={`btn btn-sm ${f.enabled ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => toggle(f)}
              disabled={busy !== null}
              aria-busy={busy === f.id}
            >
              {t(f.enabled ? 'admin.features.turnOff' : 'admin.features.turnOn')}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
