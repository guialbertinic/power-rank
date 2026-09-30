import { useEffect, useState } from 'react';
import { ApiError } from '../../api';
import { I18nProvider, useI18n, type Key } from '../../i18n';
import ActionsPanel from './ActionsPanel';
import { fetchAdminMe } from './api';
import EconomyPanel from './EconomyPanel';
import FeaturesPanel from './FeaturesPanel';
import PlayersPanel from './PlayersPanel';

type Tab = 'features' | 'economy' | 'players' | 'actions';

const TABS: { id: Tab; label: Key }[] = [
  { id: 'features', label: 'admin.tab.features' },
  { id: 'economy', label: 'admin.tab.economy' },
  { id: 'players', label: 'admin.tab.players' },
  { id: 'actions', label: 'admin.tab.actions' },
];

type Access = { status: 'loading' } | { status: 'ok'; email: string } | { status: 'denied' } | { status: 'offline' };

/**
 * Tela de admin em /admin (carregada à parte, fora do pacote do jogo). Em produção o Cloudflare Access pede o login
 * antes de abrir a página e as rotas /api/admin/*; o servidor confere de novo em toda rota.
 */
export default function AdminApp() {
  return (
    <I18nProvider>
      <Admin />
    </I18nProvider>
  );
}

function Admin() {
  const { t } = useI18n();
  const [access, setAccess] = useState<Access>({ status: 'loading' });
  const [tab, setTab] = useState<Tab>('features');

  useEffect(() => {
    fetchAdminMe()
      .then(({ email }) => setAccess({ status: 'ok', email }))
      .catch((err) => setAccess({ status: err instanceof ApiError && err.status === 403 ? 'denied' : 'offline' }));
  }, []);

  return (
    <main className="app admin">
      <header className="admin-header">
        <h1 className="admin-title">
          Power <em>Rank</em> · Admin
        </h1>
        {access.status === 'ok' && <span className="muted admin-email">{access.email}</span>}
        <a className="btn btn-secondary btn-sm" href="/">
          {t('admin.backToGame')}
        </a>
      </header>

      {access.status === 'loading' && <p className="muted">{t('admin.loading')}</p>}
      {access.status === 'denied' && (
        <section className="panel admin-message">
          <p>{t('admin.denied')}</p>
        </section>
      )}
      {access.status === 'offline' && (
        <section className="panel admin-message">
          <p className="error">{t('admin.offline')}</p>
        </section>
      )}
      {access.status === 'ok' && (
        <>
          <div className="shop-tabs admin-tabs" role="tablist">
            {TABS.map((item) => (
              <button
                key={item.id}
                role="tab"
                aria-selected={tab === item.id}
                className={`mode-option${tab === item.id ? ' selected' : ''}`}
                onClick={() => setTab(item.id)}
              >
                {t(item.label)}
              </button>
            ))}
          </div>
          {tab === 'features' && <FeaturesPanel />}
          {tab === 'economy' && <EconomyPanel />}
          {tab === 'players' && <PlayersPanel />}
          {tab === 'actions' && <ActionsPanel />}
        </>
      )}
    </main>
  );
}
