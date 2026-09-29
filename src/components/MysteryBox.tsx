import { useState } from 'react';
import { equipItem, openBox, type BoxResult } from '../api';
import { characterIdOfAvatar, cosmeticById, type Profile } from '../game/cosmetics';
import { BOX_PRICE, COMMON_AVATAR_CHANCE, GACHA_POOLS, RARITIES, RARITIES_BY_ID } from '../game/gacha';
import { cosmeticLabel, serverText, useI18n } from '../i18n';
import type { Identity } from '../nick';
import { POOL_BY_ID } from '../data';
import Avatar from './Avatar';
import Coins from './Coins';

interface Props {
  identity: Identity & { token: string };
  profile: Profile;
  onProfileChange: (profile: Profile) => void;
}

/** Tempo mínimo da caixa tremendo antes de abrir (suspense), mesmo se o servidor responder antes. */
const MIN_SHAKE_MS = 1200;

const pct = (n: number) => `${Math.round(n * 100)}%`;

type Phase = 'idle' | 'opening' | 'revealed';

/** Prévia do item sorteado: avatar, nome da cor com o efeito, moldura vazia ou o texto do título. */
function ItemPreview({ itemId }: { itemId: string }) {
  const { t, lang } = useI18n();
  const characterId = characterIdOfAvatar(itemId);
  if (characterId !== null) {
    const character = POOL_BY_ID.get(characterId);
    return (
      <div className="gacha-item">
        {character && <Avatar character={character} size={96} />}
        <span className="gacha-item-name">{t('box.avatar', { name: character?.name ?? characterId })}</span>
      </div>
    );
  }
  const item = cosmeticById(itemId);
  if (!item) return null;
  if (item.slot === 'nameColor') {
    return (
      <div className="gacha-item">
        <span className={`shop-color-sample gacha-color cosmetic-${item.id}`}>{cosmeticLabel(item, lang)}</span>
        <span className="gacha-item-name">{t('shop.tab.nameColor')}</span>
      </div>
    );
  }
  if (item.slot === 'frame') {
    return (
      <div className="gacha-item">
        <span className={`player-frame cosmetic-${item.id}`}>
          <span className="player-frame-border">
            <span className="shop-frame-empty gacha-frame-empty" />
          </span>
        </span>
        <span className="gacha-item-name">{t('box.frame', { name: cosmeticLabel(item, lang) })}</span>
      </div>
    );
  }
  return (
    <div className="gacha-item">
      <span className="gacha-title">{cosmeticLabel(item, lang)}</span>
      <span className="gacha-item-name">{t('shop.tab.title')}</span>
    </div>
  );
}

/**
 * Mystery Box (aba do cassino): paga a caixa, o servidor sorteia a raridade e o item. A caixa treme enquanto
 * espera, abre na cor da raridade e mostra o item (ou as moedas devolvidas, se já era seu).
 */
export default function MysteryBox({ identity, profile, onProfileChange }: Props) {
  const { t, lang } = useI18n();
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<BoxResult | null>(null);
  const [equipped, setEquipped] = useState(false);
  const [equipping, setEquipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const canOpen = phase !== 'opening' && profile.coins >= BOX_PRICE;

  const onOpen = () => {
    if (!canOpen) return;
    const startedAt = Date.now();
    setPhase('opening');
    setResult(null);
    setEquipped(false);
    setError(null);
    openBox(identity.token)
      .then((r) => {
        setTimeout(
          () => {
            setResult(r);
            onProfileChange(r.profile);
            setPhase('revealed');
          },
          Math.max(0, MIN_SHAKE_MS - (Date.now() - startedAt)),
        );
      })
      .catch((err) => {
        setPhase('idle');
        setError(err instanceof TypeError ? t('common.offline') : serverText(err.message, lang));
      });
  };

  const onEquip = () => {
    if (!result) return;
    const slot = characterIdOfAvatar(result.itemId) !== null ? 'avatar' : cosmeticById(result.itemId)!.slot;
    setEquipping(true);
    equipItem(identity, slot, result.itemId)
      .then((p) => {
        onProfileChange(p);
        setEquipped(true);
      })
      .catch((err) => setError(err instanceof Error ? serverText(err.message, lang) : t('box.equipError')))
      .finally(() => setEquipping(false));
  };

  const rarity = result ? RARITIES_BY_ID.get(result.rarity)! : null;
  const exclusives = GACHA_POOLS.legendary;

  return (
    <section className="casino">
      <div className="casino-marquee">
        <span className="casino-title">Mystery Box</span>
        <button
          className="leaderboard-help-toggle"
          onClick={() => setHelpOpen((open) => !open)}
          aria-expanded={helpOpen}
          aria-label={t('box.helpAria')}
        >
          ?
        </button>
      </div>

      {helpOpen && (
        <div className="panel casino-help">
          <table className="casino-table">
            <thead>
              <tr>
                <th>{t('box.rarity')}</th>
                <th>{t('box.chance')}</th>
                <th>{t('box.drops')}</th>
              </tr>
            </thead>
            <tbody>
              {RARITIES.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className={`gacha-dot rarity-${r.id}`} /> {t(`rarity.${r.id}`)}
                  </td>
                  <td>{pct(r.chance)}</td>
                  <td>
                    {r.id === 'common'
                      ? t('box.dropsCommon')
                      : r.id === 'rare'
                        ? t('box.dropsRare')
                        : r.id === 'epic'
                          ? t('box.dropsEpic')
                          : t('box.dropsLegendary')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>{t('box.helpPrice', { price: BOX_PRICE, pct: pct(COMMON_AVATAR_CHANCE) })}</p>
          <p>
            <strong>{t('box.dropsLegendary')}</strong>{' '}
            {t('box.helpExclusives', { list: exclusives.map((c) => cosmeticLabel(c, lang)).join(', ') })}
          </p>
        </div>
      )}

      <div className="gacha-stage">
        {phase === 'revealed' && result && rarity ? (
          <div className={`gacha-reveal rarity-${result.rarity}`} aria-live="polite">
            <span className="gacha-rarity">{t(`rarity.${rarity.id}`)}</span>
            <ItemPreview itemId={result.itemId} />
            {result.duplicate ? (
              <p className="gacha-duplicate">
                {t('box.duplicate')} <Coins amount={result.refund} prefix="+" />
              </p>
            ) : (
              <button
                className="btn btn-secondary btn-sm"
                onClick={onEquip}
                disabled={equipped || equipping}
                aria-busy={equipping}
              >
                {equipped ? t('box.equipped') : t('box.equipNow')}
              </button>
            )}
          </div>
        ) : (
          <div className={`gacha-box${phase === 'opening' ? ' opening' : ''}`} aria-hidden="true">
            <span>?</span>
          </div>
        )}
      </div>

      <div className="gacha-controls">
        <button className="btn btn-primary btn-lg gacha-open" onClick={onOpen} disabled={!canOpen}>
          {phase === 'revealed' ? t('box.openAnother') : t('box.open')} · <Coins amount={BOX_PRICE} />
        </button>
        <span className="casino-hint">
          {t('box.balance')} <Coins amount={profile.coins} />
        </span>
        {profile.coins < BOX_PRICE && phase !== 'opening' && (
          <span className="casino-hint">{t('box.notEnough')}</span>
        )}
      </div>
      {error && <p className="error casino-error">{error}</p>}
    </section>
  );
}
