import { useMemo, useState } from 'react';
import { buyItem, equipItem } from '../api';
import { AVATAR_PRICE, avatarItemId, COSMETICS, type Cosmetic, type Profile } from '../game/cosmetics';
import type { Character } from '../game/types';
import type { Identity } from '../nick';
import { POOL } from '../data';
import Avatar from './Avatar';
import Coins from './Coins';
import PlayerTag from './PlayerTag';

type Tab = 'nameColor' | 'frame' | 'title' | 'avatar';

const TABS: { id: Tab; label: string }[] = [
  { id: 'nameColor', label: 'Cor do nick' },
  { id: 'frame', label: 'Moldura' },
  { id: 'title', label: 'Título' },
  { id: 'avatar', label: 'Avatar' },
];

interface Props {
  identity: Identity & { token: string };
  profile: Profile;
  onProfileChange: (profile: Profile) => void;
}

/** Loja e personalização do perfil: compra com moedas e equipa o visual que aparece no ranking e na party. */
export default function ShopScreen({ identity, profile, onProfileChange }: Props) {
  const [tab, setTab] = useState<Tab>('nameColor');
  const [confirming, setConfirming] = useState<string | null>(null);
  /** Item cuja compra/equipar está esperando o servidor: só o botão dele mostra o loading. */
  const [pending, setPending] = useState<string | null>(null);
  const busy = pending !== null;
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const owned = useMemo(() => new Set(profile.owned), [profile.owned]);

  const act = async (itemId: string, action: () => Promise<Profile>) => {
    setPending(itemId);
    setError(null);
    try {
      onProfileChange(await action());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado');
    } finally {
      setPending(null);
      setConfirming(null);
    }
  };

  const buy = (itemId: string) => {
    if (confirming !== itemId) return setConfirming(itemId);
    void act(itemId, () => buyItem(identity, itemId));
  };
  /** `button`: item cujo botão foi clicado (ao desequipar, itemId é null). */
  const equip = (slot: Tab, itemId: string | null, button: string) =>
    void act(button, () => equipItem(identity, slot, itemId));

  /** Botão de cada item: comprar (com confirmação), equipar ou "Equipado" (clique desequipa). */
  const itemButton = (slot: Tab, itemId: string, price: number, equipped: boolean) => {
    if (equipped) {
      return (
        <button
          className="shop-action equipped"
          onClick={() => equip(slot, null, itemId)}
          disabled={busy}
          aria-busy={pending === itemId}
        >
          Equipado
        </button>
      );
    }
    if (owned.has(itemId)) {
      return (
        <button
          className="shop-action"
          onClick={() => equip(slot, itemId, itemId)}
          disabled={busy}
          aria-busy={pending === itemId}
        >
          Equipar
        </button>
      );
    }
    const affordable = profile.coins >= price;
    return (
      <button
        className={`shop-action buy${confirming === itemId ? ' confirm' : ''}`}
        onClick={() => buy(itemId)}
        disabled={busy || !affordable}
        aria-busy={pending === itemId}
        title={affordable ? undefined : 'Moedas insuficientes'}
      >
        {confirming === itemId ? 'Confirmar?' : <Coins amount={price} />}
      </button>
    );
  };

  const cosmeticItem = (c: Cosmetic) => (
    <li key={c.id} className="shop-item">
      <PlayerTag name={identity.name} look={{ ...profile.look, [c.slot]: c.id }} size={40} avatarOnly={c.slot === 'frame'} />
      {/* No título, a prévia já mostra o texto. */}
      {c.slot !== 'title' && <span className="shop-item-label">{c.label}</span>}
      {itemButton(c.slot, c.id, c.price, profile.look[c.slot] === c.id)}
    </li>
  );

  /** Itens do espaço, do mais barato ao mais caro; títulos separados por grupo. */
  const cosmetics = (slot: Cosmetic['slot']) => {
    const items = COSMETICS.filter((c) => c.slot === slot).sort((a, b) => a.price - b.price);
    if (slot !== 'title') return <ol className="shop-list">{items.map(cosmeticItem)}</ol>;
    const groups = [...new Set(items.map((c) => c.group))];
    return groups.map((group) => (
      <section key={group} className="shop-group">
        <h3 className="shop-group-title">{group}</h3>
        <ol className="shop-list">{items.filter((c) => c.group === group).map(cosmeticItem)}</ol>
      </section>
    ));
  };

  const avatars = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = POOL.filter((c) => c.image && (!q || `${c.name} ${c.series}`.toLowerCase().includes(q)));
    // Os que você já tem primeiro, depois em ordem alfabética (nunca por poder).
    return list.sort(
      (a, b) =>
        Number(owned.has(avatarItemId(b.id))) - Number(owned.has(avatarItemId(a.id))) || a.name.localeCompare(b.name),
    );
  }, [query, owned]);

  const avatarItem = (c: Character) => (
    <li key={c.id} className="shop-avatar">
      <Avatar character={c} size={72} />
      <span className="shop-avatar-name">{c.name}</span>
      {itemButton('avatar', avatarItemId(c.id), AVATAR_PRICE, profile.look.avatar === c.id)}
    </li>
  );

  return (
    <section className="shop">
      <div className="panel shop-header">
        <PlayerTag name={identity.name} look={profile.look} size={64} />
        <p className="shop-balance">
          <Coins amount={profile.coins} />
        </p>
        <p className="muted shop-hint">Ganhe moedas fazendo 500+ pontos. O visual aparece no ranking e na party.</p>
      </div>

      <div className="shop-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`mode-option${tab === t.id ? ' selected' : ''}`}
            onClick={() => {
              setTab(t.id);
              setConfirming(null);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="error shop-error">{error}</p>}

      <div className="panel">
        {tab === 'avatar' ? (
          <>
            <input
              className="shop-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Buscar entre ${POOL.length} personagens`}
              aria-label="Buscar personagem"
            />
            <ol className="shop-avatars">{avatars.map(avatarItem)}</ol>
          </>
        ) : (
          cosmetics(tab)
        )}
      </div>
    </section>
  );
}
