import { useEffect, useState, type FormEvent } from 'react';
import { ADMIN_COINS_MAX, type AdminPlayer } from '../../game/admin';
import { MODES } from '../../game/modes';
import { useI18n } from '../../i18n';
import { adjustCoins, fetchPlayer, renamePlayer, resetPassword } from './api';
import { actionText, dateTimeText, errorText, numberText } from './format';
import { PlayerBadges } from './PlayersPanel';

/** Detalhes de uma conta e as ações do admin: moedas, nick e senha temporária. Toda ação fica no registro. */
export default function PlayerDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const { t, lang } = useI18n();
  const [player, setPlayer] = useState<AdminPlayer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [newName, setNewName] = useState('');
  const [password, setPassword] = useState<string | null>(null);

  useEffect(() => {
    fetchPlayer(id)
      .then((p) => {
        setPlayer(p);
        setNewName(p.name);
      })
      .catch((err) => setError(errorText(err, lang)));
  }, [id]);

  /** Roda uma ação; se der certo, mostra o jogador atualizado. */
  const run = async (action: () => Promise<AdminPlayer>) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await action();
      setPlayer(updated);
      setNewName(updated.name);
      return true;
    } catch (err) {
      setError(errorText(err, lang));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onCoins = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(() => adjustCoins(id, Number(delta), reason))) {
      setDelta('');
      setReason('');
    }
  };

  const onRename = (e: FormEvent) => {
    e.preventDefault();
    run(() => renamePlayer(id, newName));
  };

  const onPassword = () => {
    if (!player || !window.confirm(t('admin.player.passwordConfirm', { name: player.name }))) return;
    run(async () => {
      const result = await resetPassword(id);
      setPassword(result.password);
      return result.player;
    });
  };

  const num = (n: number) => numberText(n, lang);
  const deltaValue = Number(delta);
  const deltaValid = Number.isInteger(deltaValue) && deltaValue !== 0 && Math.abs(deltaValue) <= ADMIN_COINS_MAX;

  return (
    <div className="admin-stack">
      <button className="btn btn-ghost btn-sm admin-back" onClick={onBack}>
        ← {t('admin.player.back')}
      </button>
      {error && <p className="error">{error}</p>}
      {!player && !error && <p className="muted">{t('admin.loading')}</p>}
      {player && (
        <>
          <section className="panel admin-section">
            <h2 className="admin-player-title">
              {player.name} <span className="muted admin-small">#{player.id}</span>
            </h2>
            <PlayerBadges player={player} />
            <dl className="admin-facts">
              <Fact label={t('admin.player.coins')} value={num(player.coins)} />
              <Fact label={t('admin.player.created')} value={dateTimeText(player.createdAt, lang)} />
              <Fact label={t('admin.player.games')} value={num(player.games)} />
              <Fact label={t('admin.player.earned')} value={num(player.earned)} />
              <Fact label={t('admin.player.items')} value={num(player.items)} />
              <Fact label={t('admin.player.devices')} value={num(player.devices)} />
              <Fact
                label={t('admin.feature.slots')}
                value={t('admin.player.slots', { spins: num(player.slots.spins), bet: num(player.slots.bet), prize: num(player.slots.prize) })}
              />
              <Fact
                label={t('admin.feature.plinko')}
                value={t('admin.player.plinko', { drops: num(player.plinko.drops), bet: num(player.plinko.bet), prize: num(player.plinko.prize) })}
              />
              <Fact
                label={t('admin.feature.mystery_box')}
                value={t('admin.player.box', { openings: num(player.box.openings), spent: num(player.box.spent), refunded: num(player.box.refunded) })}
              />
            </dl>
          </section>

          <section className="panel admin-section">
            <h3 className="section-title">{t('admin.player.coinsTitle')}</h3>
            <form className="admin-form" onSubmit={onCoins}>
              <input
                type="number"
                inputMode="numeric"
                step={1}
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                placeholder={t('admin.player.deltaPlaceholder')}
                aria-label={t('admin.player.delta')}
              />
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
                placeholder={t('admin.player.reason')}
                aria-label={t('admin.player.reason')}
              />
              <button className="btn btn-primary btn-sm" disabled={busy || !deltaValid || !reason.trim()}>
                {t('admin.player.apply')}
              </button>
            </form>
          </section>

          <section className="panel admin-section">
            <h3 className="section-title">{t('admin.player.renameTitle')}</h3>
            <form className="admin-form" onSubmit={onRename}>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={20} aria-label={t('admin.player.renameTitle')} />
              <button className="btn btn-primary btn-sm" disabled={busy || !newName.trim() || newName.trim() === player.name}>
                {t('admin.player.rename')}
              </button>
            </form>
          </section>

          <section className="panel admin-section">
            <h3 className="section-title">{t('admin.player.passwordTitle')}</h3>
            <p className="muted admin-small">{t('admin.player.passwordHint')}</p>
            {password ? (
              <p className="admin-password">
                {t('admin.player.passwordNew')} <code>{password}</code>
              </p>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={onPassword} disabled={busy}>
                {t('admin.player.passwordReset')}
              </button>
            )}
          </section>

          <section className="panel admin-section">
            <h3 className="section-title">{t('admin.player.recentGames')}</h3>
            {!player.recentScores.length && <p className="muted">{t('admin.none')}</p>}
            <ul className="admin-list admin-small">
              {player.recentScores.map((s, i) => (
                <li key={i} className="admin-log-row">
                  <span className="muted">{dateTimeText(s.createdAt, lang)}</span>
                  <span>
                    {MODES.find((m) => m.id === s.mode)?.label ?? s.mode}
                    {s.daily && ` · ${t('admin.player.daily')}`}
                  </span>
                  <span>
                    {t('admin.player.score', { score: num(s.score), coins: num(s.coins) })}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel admin-section">
            <h3 className="section-title">{t('admin.player.recentAccess')}</h3>
            {!player.recentAccess.length && <p className="muted">{t('admin.none')}</p>}
            <ul className="admin-list admin-small">
              {player.recentAccess.map((a, i) => (
                <li key={i} className="admin-log-row">
                  <span className="muted">{dateTimeText(a.createdAt, lang)}</span>
                  <code>{a.event}</code>
                  <span>
                    {a.ip}
                    {a.country && ` · ${a.country}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel admin-section">
            <h3 className="section-title">{t('admin.tab.actions')}</h3>
            {!player.actions.length && <p className="muted">{t('admin.none')}</p>}
            <ul className="admin-list admin-small">
              {player.actions.map((a) => (
                <li key={a.id} className="admin-log-row">
                  <span className="muted">{dateTimeText(a.createdAt, lang)}</span>
                  <span>{actionText(a, t, lang)}</span>
                  <span className="muted">{a.admin}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-fact">
      <dt className="muted admin-small">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
