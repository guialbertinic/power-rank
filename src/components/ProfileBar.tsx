import { useEffect, useRef, useState } from 'react';
import type { Profile } from '../game/cosmetics';
import { EMPTY_LOOK } from '../game/cosmetics';
import { useI18n } from '../i18n';
import type { Identity } from '../nick';
import { SUPPORT_URL } from '../links';
import Coins from './Coins';
import PlayerTag from './PlayerTag';

interface Props {
  identity: Identity;
  /** Saldo e visual (null enquanto carrega ou sem conexão). */
  profile: Profile | null;
  onOpenShop: () => void;
  /** Abre o Arcade; sem ele, o botão não aparece (todos os minigames desligados). */
  onOpenArcade?: () => void;
  /** Abre a tela Minha conta (nick, senha, aparelhos, excluir). */
  onOpenAccount: () => void;
  /** Conta: sair dela neste navegador. Convidado: ir para a tela do nick entrar numa conta. */
  onLeave: () => void;
  disabled?: boolean;
}

/**
 * Canto superior direito da home: quem está jogando, saldo e loja. "Minha conta" (nick, senha, aparelhos) e
 * sair/entrar numa conta ficam num menu que abre ao tocar no nick (são usados raramente).
 * No celular a faixa mostra só o nick e o saldo; Loja e Arcade vão para o menu, que abre como sanfona.
 */
export default function ProfileBar(props: Props) {
  const { identity, profile, onOpenShop, onOpenArcade, onOpenAccount, onLeave, disabled } = props;
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

  const actions = (
    <>
      <button className="btn btn-secondary btn-sm" onClick={onOpenShop} disabled={disabled}>
        {t('profile.shop')}
      </button>
      {onOpenArcade && (
        <button className="btn btn-secondary btn-sm" onClick={onOpenArcade} disabled={disabled}>
          {t('profile.arcade')}
        </button>
      )}
    </>
  );

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
          <div className="profile-bar-actions">{actions}</div>
        </>
      )}

      {menuOpen && (
        <div className="panel profile-menu" role="menu">
          {profile && <div className="profile-menu-actions">{actions}</div>}
          <button
            className="btn btn-secondary btn-sm profile-account"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onOpenAccount();
            }}
          >
            {identity.token ? t('account.title') : t('account.guestOpen')}
          </button>
          {(!identity.token || (profile && !profile.hasPassword && profile.coins > 0)) && (
            <p className="muted sync-warning">{identity.token ? t('profile.passwordWarning') : t('profile.guestWarning')}</p>
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
          {SUPPORT_URL && (
            <a className="link-button profile-support" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
              {t('support.button')}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
