import { useEffect, useRef, useState } from 'react';
import type { Profile } from '../game/cosmetics';
import { EMPTY_LOOK } from '../game/cosmetics';
import { useI18n } from '../i18n';
import type { Identity } from '../nick';
import { SUPPORT_URL } from '../links';
import Coins from './Coins';
import NavIcon, { type NavId } from './NavIcon';
import PlayerTag from './PlayerTag';
import { useWholePixelWidths } from '../ui/useWholePixelWidths';

interface Props {
  identity: Identity;
  /** Saldo e visual (null enquanto carrega ou sem conexão). */
  profile: Profile | null;
  /** Tela atual (botão destacado); null = nenhuma das da navegação (ex: Minha conta). */
  current: NavId | null;
  onHome: () => void;
  onOpenShop: () => void;
  onOpenAchievements: () => void;
  /** Abre o Arcade; sem ele, o botão não aparece (todos os minigames desligados). */
  onOpenArcade?: () => void;
  /** Abre "Mais jogos"; sem ele, o botão não aparece (nenhum jogo ligado). */
  onOpenExtras?: () => void;
  /** Abre a tela Minha conta (nick, senha, aparelhos, excluir). */
  onOpenAccount: () => void;
  /** Conta: sair dela neste navegador. Convidado: ir para a tela do nick entrar numa conta. */
  onLeave: () => void;
  disabled?: boolean;
}

/**
 * Canto superior direito da home, da loja, das conquistas, do Arcade e da conta: quem está jogando, saldo e a navegação
 * (Início / Loja / Conquistas / Jogos / Arcade, colados, a tela atual destacada). "Minha conta" (nick, senha, aparelhos) e
 * sair/entrar numa conta ficam num menu que abre ao tocar no nick (são usados raramente).
 * No celular a faixa (nick e saldo) fica acima do título, a navegação vira uma barra de abas fixa no rodapé e o menu
 * abre como sanfona.
 */
export default function ProfileBar(props: Props) {
  const { identity, profile, current, onHome, onOpenShop, onOpenAchievements, onOpenArcade, onOpenExtras, onOpenAccount, onLeave, disabled } =
    props;
  const { t, lang } = useI18n();
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

  // Loja, Conquistas e Arcade dependem do perfil (saldo, itens): sem ele (carregando, sem conexão), só o Início.
  const nav: { id: NavId; label: string; onClick: () => void }[] = [
    { id: 'home', label: t('app.home'), onClick: onHome },
    ...(profile
      ? [
          { id: 'shop' as const, label: t('profile.shop'), onClick: onOpenShop },
          { id: 'achievements' as const, label: t('ach.title'), onClick: onOpenAchievements },
          ...(onOpenExtras ? [{ id: 'extras' as const, label: t('profile.extras'), onClick: onOpenExtras }] : []),
          ...(onOpenArcade ? [{ id: 'arcade' as const, label: t('profile.arcade'), onClick: onOpenArcade }] : []),
        ]
      : []),
  ];
  const navRef = useRef<HTMLElement>(null);
  useWholePixelWidths(navRef, [lang, nav.length]);

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

      {profile && <Coins amount={profile.coins} />}

      <nav className="profile-nav" ref={navRef} aria-label={t('profile.nav')}>
        {nav.map(({ id, label, onClick }) => (
          <button
            key={id}
            className={`btn btn-secondary btn-sm profile-nav-button${id === current ? ' current' : ''}`}
            data-nav={id}
            onClick={onClick}
            disabled={disabled}
            aria-current={id === current ? 'page' : undefined}
            title={label}
          >
            <NavIcon id={id} />
            <span className="profile-nav-label">{label}</span>
          </button>
        ))}
      </nav>

      {menuOpen && (
        <div className="panel profile-menu" role="menu">
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
