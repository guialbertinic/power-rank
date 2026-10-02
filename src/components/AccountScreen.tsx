import { useState } from 'react';
import { logoutAll } from '../api';
import { EMPTY_LOOK, type Profile } from '../game/cosmetics';
import { serverText, useI18n } from '../i18n';
import type { Identity } from '../nick';
import ChangeNick from './ChangeNick';
import ChangePassword from './ChangePassword';
import CreateAccountForm from './CreateAccountForm';
import DeleteAccount from './DeleteAccount';
import PlayerTag from './PlayerTag';

interface Props {
  identity: Identity;
  /** Perfil da conta (null para convidado, enquanto carrega ou sem conexão). */
  profile: Profile | null;
  /** Trocou o nick ou o convidado criou a conta. */
  onIdentityChange: (identity: Identity) => void;
  /** Recarrega o perfil do servidor (forçar sincronização, aparelhos). Rejeita se falhar. */
  onRefresh: () => Promise<void>;
  /** Conta: sair dela neste navegador (também depois de "sair de todos" e de excluir). Convidado: entrar numa conta. */
  onLeave: () => void;
}

type SyncStatus = 'idle' | 'syncing' | 'done' | 'error';

/**
 * "Minha conta": nick, senha (criar ou trocar), aparelhos conectados (sincronizar, sair de todos) e excluir a conta.
 * Convidado: trocar de nick, criar a conta ou entrar numa conta.
 */
export default function AccountScreen({ identity, profile, onIdentityChange, onRefresh, onLeave }: Props) {
  const { t, lang } = useI18n();
  const [sync, setSync] = useState<SyncStatus>('idle');
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const token = identity.token;

  const forceSync = () => {
    setSync('syncing');
    onRefresh().then(
      () => setSync('done'),
      () => setSync('error'),
    );
  };

  const onLogoutAll = () => {
    if (!token) return;
    setLogoutBusy(true);
    setLogoutError(null);
    logoutAll(token)
      .then(onLeave)
      .catch((err) => setLogoutError(err instanceof TypeError ? t('common.offline') : serverText(err.message, lang)))
      .finally(() => setLogoutBusy(false));
  };

  return (
    <section className="account">
      <header className="shop-header">
        <PlayerTag name={identity.name} look={profile?.look ?? EMPTY_LOOK} size={56} />
        {!token && <span className="profile-guest">{t('profile.guest')}</span>}
      </header>

      <section className="panel account-section">
        <h2 className="section-title">{t('account.nick')}</h2>
        <ChangeNick identity={identity} onChanged={onIdentityChange} />
      </section>

      {!token && (
        <section className="panel account-section">
          <h2 className="section-title">{t('sync.createAccount')}</h2>
          <CreateAccountForm identity={identity} onRefresh={onRefresh} onAccountCreated={onIdentityChange} />
          <button className="link-button" onClick={onLeave}>
            {t('profile.login')}
          </button>
        </section>
      )}

      {token && profile && (
        <>
          <section className="panel account-section">
            <h2 className="section-title">{t('account.password')}</h2>
            {profile.hasPassword ? (
              <ChangePassword name={identity.name} token={token} onChanged={() => onRefresh().catch(() => {})} />
            ) : (
              <CreateAccountForm identity={identity} onRefresh={onRefresh} onAccountCreated={onIdentityChange} />
            )}
          </section>

          <section className="panel account-section">
            <h2 className="section-title">{t('account.devices')}</h2>
            <p className="account-devices">
              {profile.devices > 1 ? t('account.devicesMany', { n: profile.devices }) : t('account.devicesOne')}
            </p>
            {profile.hasPassword && (
              <p className="muted account-note">
                {t('sync.otherDeviceBefore')}
                <strong>{identity.name}</strong>
                {t('sync.otherDeviceAfter')}
              </p>
            )}
            <div className="account-actions">
              <button
                className="btn btn-secondary btn-sm"
                onClick={forceSync}
                disabled={sync === 'syncing'}
                aria-busy={sync === 'syncing'}
              >
                {t('sync.force')}
              </button>
              {profile.hasPassword && !confirmLogout && (
                <button className="btn btn-secondary btn-sm" onClick={() => setConfirmLogout(true)}>
                  {t('account.logoutAll')}
                </button>
              )}
            </div>
            {(sync === 'done' || sync === 'error') && (
              <p className="muted account-note">{sync === 'done' ? t('sync.done') : t('sync.error')}</p>
            )}
            {confirmLogout && (
              <div className="account-confirm">
                <p className="account-note">{t('account.logoutAllConfirm')}</p>
                <div className="change-nick-actions">
                  <button className="btn btn-danger btn-sm" onClick={onLogoutAll} disabled={logoutBusy} aria-busy={logoutBusy}>
                    {t('account.logoutAllYes')}
                  </button>
                  <button className="link-button" onClick={() => setConfirmLogout(false)} disabled={logoutBusy}>
                    {t('common.cancel')}
                  </button>
                </div>
                {logoutError && <p className="error">{logoutError}</p>}
              </div>
            )}
          </section>

          <section className="panel account-section">
            <button className="link-button account-logout" onClick={onLeave}>
              {t('profile.logout')}
            </button>
            <DeleteAccount token={token} hasPassword={profile.hasPassword} onDeleted={onLeave} />
          </section>
        </>
      )}
    </section>
  );
}
