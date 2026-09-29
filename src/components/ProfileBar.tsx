import { useEffect, useRef, useState } from 'react';
import type { Profile } from '../game/cosmetics';
import { EMPTY_LOOK } from '../game/cosmetics';
import type { Identity } from '../nick';
import Coins from './Coins';
import PlayerTag from './PlayerTag';
import SyncDevice from './SyncDevice';

interface Props {
  identity: Identity;
  /** Saldo e visual (null enquanto carrega ou sem conexão). */
  profile: Profile | null;
  onOpenShop: () => void;
  onChangeNick: () => void;
  disabled?: boolean;
}

/**
 * Canto superior direito da home: quem está jogando, saldo e loja. "Trocar nick" e "Sincronizar dispositivo"
 * ficam num menu que abre ao tocar no nick (são usados raramente).
 */
export default function ProfileBar({ identity, profile, onOpenShop, onChangeNick, disabled }: Props) {
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

      {profile && (
        <>
          <Coins amount={profile.coins} />
          <button className="btn btn-secondary btn-sm" onClick={onOpenShop} disabled={disabled}>
            Loja
          </button>
        </>
      )}

      {menuOpen && (
        <div className="panel profile-menu" role="menu">
          <button
            className="link-button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onChangeNick();
            }}
          >
            Trocar nick
          </button>
          <SyncDevice identity={identity} />
          {profile && profile.coins > 0 && (
            <p className="muted sync-warning">Sincronize outro dispositivo para não perder suas moedas.</p>
          )}
        </div>
      )}
    </div>
  );
}
