import { useEffect, useRef, useState } from 'react';
import type { Profile } from '../game/cosmetics';
import { EMPTY_LOOK } from '../game/cosmetics';
import { useI18n } from '../i18n';
import type { Identity } from '../nick';
import ChangeNick from './ChangeNick';
import Coins from './Coins';
import PlayerTag from './PlayerTag';
import SyncDevice from './SyncDevice';

interface Props {
  identity: Identity;
  /** Saldo e visual (null enquanto carrega ou sem conexão). */
  profile: Profile | null;
  onOpenShop: () => void;
  onOpenCasino: () => void;
  /** Trocou o nick ou o convidado criou a conta pelo menu. */
  onIdentityChange: (identity: Identity) => void;
  /** Conta: sair dela neste navegador. Convidado: ir para a tela do nick entrar numa conta. */
  onLeave: () => void;
  /** Forçar sincronização: recarrega o perfil do servidor. */
  onRefresh: () => Promise<void>;
  disabled?: boolean;
}

/**
 * Canto superior direito da home: quem está jogando, saldo e loja. "Trocar nick", "Sincronizar dispositivo" e
 * sair/entrar numa conta ficam num menu que abre ao tocar no nick (são usados raramente).
 */
export default function ProfileBar({ identity, profile, onOpenShop, onOpenCasino, onIdentityChange, onLeave, onRefresh, disabled }: Props) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fecha o menu ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <div className="profile-bar" ref={ref}>
      <button
        className="profile-bar-me"
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-haspopup="true"
        disabled={disabled}
      >
        <PlayerTag name={identity.name} look={profile?.look ?? EMPTY_LOOK} size={28} />
        <span className="profile-bar-caret" aria-hidden="true" />
      </button>

      {!identity.token && <span className="profile-guest">{t('profile.guest')}</span>}

      {profile && (
        <>
          <Coins amount={profile.coins} />
          <button className="btn btn-secondary btn-sm" onClick={onOpenShop} disabled={disabled}>
            {t('profile.shop')}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onOpenCasino} disabled={disabled}>
            {t('profile.casino')}
          </button>
        </>
      )}

      {menuOpen && (
        <div className="panel profile-menu" role="menu">
          <ChangeNick identity={identity} onChanged={onIdentityChange} />
          <SyncDevice identity={identity} profile={profile} onRefresh={onRefresh} onAccountCreated={onIdentityChange} />
          {profile && !profile.hasPassword && profile.coins > 0 && (
            <p className="muted sync-warning">{t('profile.passwordWarning')}</p>
          )}
          <button
            className="link-button profile-leave"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onLeave();
            }}
          >
            {identity.token ? t('profile.logout') : t('profile.login')}
          </button>
        </div>
      )}
    </div>
  );
}
