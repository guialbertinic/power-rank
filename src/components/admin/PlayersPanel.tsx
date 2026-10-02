import { useEffect, useState } from 'react';
import type { AdminPlayerRow } from '../../game/admin';
import { useI18n } from '../../i18n';
import { searchPlayers } from './api';
import { dateTimeText, errorText, numberText } from './format';
import PlayerDetail from './PlayerDetail';

/**
 * Busca de contas (por parte do nick) e, ao escolher uma, os detalhes e as ações. `initialId`: abre direto uma conta
 * (vindo da fila de moderação).
 */
export default function PlayersPanel({ initialId = null }: { initialId?: number | null }) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'coins'>('recent');
  const [players, setPlayers] = useState<AdminPlayerRow[] | null>(null);
  const [selected, setSelected] = useState<number | null>(initialId);
  const [error, setError] = useState<string | null>(null);

  // Busca enquanto digita, com uma pequena espera; volta a buscar ao sair dos detalhes (nick/saldo podem ter mudado).
  useEffect(() => {
    if (selected !== null) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchPlayers(query.trim(), sort)
        .then((rows) => {
          if (!cancelled) {
            setPlayers(rows);
            setError(null);
          }
        })
        .catch((err) => !cancelled && setError(errorText(err, lang)));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, sort, selected]);

  if (selected !== null) return <PlayerDetail id={selected} onBack={() => setSelected(null)} />;

  return (
    <section className="panel admin-section">
      <h2 className="section-title">{t('admin.tab.players')}</h2>
      <div className="admin-toolbar">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('admin.players.search')}
          aria-label={t('admin.players.search')}
        />
        <div className="shop-filter" role="radiogroup" aria-label={t('admin.players.sort')}>
          {(['recent', 'coins'] as const).map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={sort === s}
              className={`shop-filter-option${sort === s ? ' selected' : ''}`}
              onClick={() => setSort(s)}
            >
              {t(s === 'recent' ? 'admin.players.recent' : 'admin.players.richest')}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {players && !players.length && <p className="muted">{t('admin.players.none')}</p>}
      <ul className="admin-list">
        {players?.map((p) => (
          <li key={p.id}>
            <button className="admin-player-row" onClick={() => setSelected(p.id)}>
              <strong className="admin-player-name">{p.name}</strong>
              <span className="admin-small muted">#{p.id}</span>
              <span className="admin-small">{t('admin.players.coins', { n: numberText(p.coins, lang) })}</span>
              <span className="admin-small muted">{dateTimeText(p.createdAt, lang)}</span>
              <PlayerBadges player={p} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PlayerBadges({ player }: { player: AdminPlayerRow }) {
  const { t } = useI18n();
  return (
    <span className="admin-badges">
      {!player.hasPassword && <span className="admin-badge">{t('admin.players.noPassword')}</span>}
      {player.adult && <span className="admin-badge">18+</span>}
      {player.lockedUntil > Date.now() && <span className="admin-badge warn">{t('admin.players.locked')}</span>}
      {player.bannedUntil > Date.now() && <span className="admin-badge warn">{t('admin.players.banned')}</span>}
    </span>
  );
}
