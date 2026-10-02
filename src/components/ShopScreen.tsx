import { useCallback, useMemo, useState } from 'react';
import { buyItem, equipItem } from '../api';
import { achievementOfReward } from '../game/achievements';
import { AVATAR_PRICE, avatarItemId, COSMETICS, type Cosmetic, type Profile } from '../game/cosmetics';
import { MIN_SCORE_FOR_COINS } from '../game/economy';
import type { CharacterInfo } from '../game/types';
import type { Identity } from '../nick';
import { cosmeticLabel, serverText, useI18n, type Key } from '../i18n';
import Avatar from './Avatar';
import BadgeIcon from './BadgeIcon';
import Coins from './Coins';
import PlayerTag from './PlayerTag';
import ShopAvatars from './ShopAvatars';

type Tab = 'nameColor' | 'frame' | 'title' | 'badge' | 'avatar';

const TABS: { id: Tab; label: Key }[] = [
  { id: 'nameColor', label: 'shop.tab.nameColor' },
  { id: 'frame', label: 'shop.tab.frame' },
  { id: 'title', label: 'shop.tab.title' },
  { id: 'badge', label: 'shop.tab.badge' },
  { id: 'avatar', label: 'shop.tab.avatar' },
];

type Filter = 'all' | 'owned' | 'missing';

const FILTERS: { id: Filter; label: Key }[] = [
  { id: 'all', label: 'shop.filter.all' },
  { id: 'owned', label: 'shop.filter.owned' },
  { id: 'missing', label: 'shop.filter.missing' },
];

interface Props {
  identity: Identity & { token: string };
  profile: Profile;
  onProfileChange: (profile: Profile) => void;
}

/** Loja e personalização do perfil: compra com moedas e equipa o visual que aparece no ranking e na party. */
export default function ShopScreen({ identity, profile, onProfileChange }: Props) {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<Tab>('nameColor');
  const [confirming, setConfirming] = useState<string | null>(null);
  /** Item cuja compra/equipar está esperando o servidor: só o botão dele mostra o loading. */
  const [pending, setPending] = useState<string | null>(null);
  const busy = pending !== null;
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const owned = useMemo(() => new Set(profile.owned), [profile.owned]);

  const act = async (itemId: string, action: () => Promise<Profile>) => {
    setPending(itemId);
    setError(null);
    try {
      onProfileChange(await action());
    } catch (err) {
      setError(err instanceof Error ? serverText(err.message, lang) : t('common.error'));
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
          {t('shop.equipped')}
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
          {t('shop.equip')}
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
        title={affordable ? undefined : t('shop.notEnough')}
      >
        {confirming === itemId ? t('shop.confirm') : <Coins amount={price} />}
      </button>
    );
  };

  /** Filtro "Todos / Obtidos / Não obtidos". */
  const visible = useCallback(
    (itemId: string) => filter === 'all' || (filter === 'owned' ? owned.has(itemId) : !owned.has(itemId)),
    [filter, owned],
  );

  /** Recompensa de conquista que o jogador ainda não tem: em vez do preço, diz qual conquista dá o item. */
  const button = (c: Cosmetic) => {
    const achievement = c.achievement && !owned.has(c.id) ? achievementOfReward(c.id) : undefined;
    if (achievement) {
      return (
        <span className="shop-lock">{t('shop.achievementLock', { name: t(`ach.${achievement.id}.name`) })}</span>
      );
    }
    return itemButton(c.slot, c.id, c.price, profile.look[c.slot] === c.id);
  };

  /** Cor: o próprio nome da cor escrito com o efeito. Moldura: um quadro vazio com a moldura. Emblema: o ícone. */
  const cosmeticItem = (c: Cosmetic) => (
    <li key={c.id} className="shop-item" data-label={c.label}>
      {c.slot === 'nameColor' ? (
        <span className={`shop-color-sample cosmetic-${c.id}`}>{cosmeticLabel(c, lang)}</span>
      ) : c.slot === 'badge' ? (
        <>
          <span className="shop-badge-sample">
            <BadgeIcon id={c.id} />
          </span>
          <span className="shop-item-label">{cosmeticLabel(c, lang)}</span>
        </>
      ) : (
        <>
          <span className={`player-frame cosmetic-${c.id}`}>
            <span className="player-frame-border">
              <span className="shop-frame-empty" />
            </span>
          </span>
          <span className="shop-item-label">{cosmeticLabel(c, lang)}</span>
        </>
      )}
      {c.exclusive && <span className="shop-exclusive">{t('shop.exclusive')}</span>}
      {button(c)}
    </li>
  );

  /** Título: uma linha por título, sem prévia do jogador. */
  const titleRow = (c: Cosmetic) => (
    <li key={c.id} className="shop-row" data-label={c.label}>
      <span className="shop-title-text">
        {cosmeticLabel(c, lang)}
        {c.exclusive && <span className="shop-exclusive">{t('shop.exclusive')}</span>}
      </span>
      {button(c)}
    </li>
  );

  /** Itens do espaço, do mais barato ao mais caro; títulos separados por categoria (2 por linha). */
  const cosmetics = (slot: Cosmetic['slot']) => {
    // Exclusivos (Mystery Box) só aparecem para quem já tem; recompensas de conquista, para todos (com o
    // cadeado). Ordem: à venda, conquistas, exclusivos.
    const order = (c: Cosmetic) => (c.exclusive ? 2 : c.achievement ? 1 : 0);
    const items = COSMETICS.filter((c) => c.slot === slot && visible(c.id) && (!c.exclusive || owned.has(c.id))).sort(
      (a, b) => order(a) - order(b) || a.price - b.price,
    );
    if (!items.length) return <p className="muted shop-empty">{t('shop.emptyItems')}</p>;
    if (slot !== 'title') return <ol className="shop-list">{items.map(cosmeticItem)}</ol>;
    const groups = [...new Set(items.map((c) => c.group))];
    return groups.map((group) => (
      <section key={group} className="shop-group">
        <h3 className="shop-group-title">{group}</h3>
        <ol className="shop-rows">{items.filter((c) => c.group === group).map(titleRow)}</ol>
      </section>
    ));
  };

  const avatarItem = (c: CharacterInfo) => (
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
        <p className="muted shop-hint">{t('shop.hint', { min: MIN_SCORE_FOR_COINS })}</p>
      </div>

      <div className="shop-tabs" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            className={`mode-option${tab === item.id ? ' selected' : ''}`}
            onClick={() => {
              setTab(item.id);
              setConfirming(null);
            }}
          >
            {t(item.label)}
          </button>
        ))}
      </div>

      {error && <p className="error shop-error">{error}</p>}

      <div className="panel">
        <div className="shop-filter" role="radiogroup" aria-label={t('shop.filter.aria')}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="radio"
              aria-checked={filter === f.id}
              className={`shop-filter-option${filter === f.id ? ' selected' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {t(f.label)}
            </button>
          ))}
        </div>
        {tab === 'avatar' ? (
          <ShopAvatars owned={owned} visible={visible} equipped={profile.look.avatar} renderItem={avatarItem} />
        ) : (
          cosmetics(tab)
        )}
      </div>
    </section>
  );
}
