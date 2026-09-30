import { useEffect, useState } from 'react';
import type { Economy } from '../../game/admin';
import { characterIdOfAvatar, cosmeticById } from '../../game/cosmetics';
import { cosmeticLabel, useI18n, type Key } from '../../i18n';
import { fetchEconomy } from './api';
import { errorText, numberText, percentText } from './format';

const RARITY_LABEL: Record<Economy['box']['rarities'][number]['rarity'], Key> = {
  common: 'rarity.common',
  rare: 'rarity.rare',
  epic: 'rarity.epic',
  legendary: 'rarity.legendary',
};

/** Painel da economia: saldos, de onde as moedas vêm e para onde vão (tudo e últimos 7 dias). Só leitura. */
export default function EconomyPanel() {
  const { t, lang } = useI18n();
  const [economy, setEconomy] = useState<Economy | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    fetchEconomy()
      .then(setEconomy)
      .catch((err) => setError(errorText(err, lang)));
  };
  useEffect(load, []);

  if (error) return <p className="error">{error}</p>;
  if (!economy) return <p className="muted">{t('admin.loading')}</p>;

  const num = (n: number) => numberText(n, lang);
  const signed = (n: number) => `${n > 0 ? '+' : ''}${num(n)}`;
  const { slots, box } = economy;
  const rtp = (p: { bet: number; prize: number }) => (p.bet ? percentText(p.prize / p.bet, lang) : '—');
  // Fluxo do ponto de vista dos saldos: positivo = moedas que entraram nas contas.
  const flows: { label: Key; total: number; week: number }[] = [
    { label: 'admin.economy.earned', total: economy.earned.total, week: economy.earned.week },
    { label: 'admin.economy.granted', total: economy.granted.total, week: economy.granted.week },
    {
      label: 'admin.economy.slotsNet',
      total: slots.total.prize - slots.total.bet,
      week: slots.week.prize - slots.week.bet,
    },
    {
      label: 'admin.economy.boxNet',
      total: box.total.refunded - box.total.spent,
      week: box.week.refunded - box.week.spent,
    },
  ];
  const openings = box.rarities.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="admin-stack">
      <section className="admin-tiles">
        <Tile label={t('admin.economy.accounts')} value={num(economy.accounts)} />
        <Tile label={t('admin.economy.circulating')} value={num(economy.circulating)} />
        <Tile label={t('admin.economy.avgBalance')} value={num(economy.avgBalance)} />
        <Tile label={t('admin.economy.maxBalance')} value={num(economy.maxBalance)} />
      </section>

      <section className="panel admin-section">
        <h2 className="section-title">{t('admin.economy.flow')}</h2>
        <p className="muted admin-small">{t('admin.economy.flowHint')}</p>
        <table className="admin-table">
          <thead>
            <tr>
              <th />
              <th>{t('admin.economy.total')}</th>
              <th>{t('admin.economy.week')}</th>
            </tr>
          </thead>
          <tbody>
            {flows.map((f) => (
              <tr key={f.label}>
                <td>{t(f.label)}</td>
                <td>{signed(f.total)}</td>
                <td>{signed(f.week)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted admin-small">{t('admin.economy.shopHint')}</p>
      </section>

      <section className="panel admin-section">
        <h2 className="section-title">{t('admin.feature.slots')}</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th />
              <th>{t('admin.economy.total')}</th>
              <th>{t('admin.economy.week')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{t('admin.economy.spins')}</td>
              <td>{num(slots.total.spins)}</td>
              <td>{num(slots.week.spins)}</td>
            </tr>
            <tr>
              <td>{t('admin.economy.bet')}</td>
              <td>{num(slots.total.bet)}</td>
              <td>{num(slots.week.bet)}</td>
            </tr>
            <tr>
              <td>{t('admin.economy.paid')}</td>
              <td>{num(slots.total.prize)}</td>
              <td>{num(slots.week.prize)}</td>
            </tr>
            <tr>
              <td>{t('admin.economy.rtp')}</td>
              <td>{rtp(slots.total)}</td>
              <td>{rtp(slots.week)}</td>
            </tr>
            <tr>
              <td>{t('admin.economy.jackpots')}</td>
              <td>{num(slots.total.jackpots)}</td>
              <td>{num(slots.week.jackpots)}</td>
            </tr>
          </tbody>
        </table>
        <p className="admin-small">
          {t('admin.economy.pot')} <strong>{num(slots.pot)}</strong> · <span className="muted">{t('admin.economy.rtpHint')}</span>
        </p>
      </section>

      <section className="panel admin-section">
        <h2 className="section-title">{t('admin.feature.mystery_box')}</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th />
              <th>{t('admin.economy.total')}</th>
              <th>{t('admin.economy.week')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{t('admin.economy.openings')}</td>
              <td>{num(box.total.openings)}</td>
              <td>{num(box.week.openings)}</td>
            </tr>
            <tr>
              <td>{t('admin.economy.spent')}</td>
              <td>{num(box.total.spent)}</td>
              <td>{num(box.week.spent)}</td>
            </tr>
            <tr>
              <td>{t('admin.economy.refunded')}</td>
              <td>{num(box.total.refunded)}</td>
              <td>{num(box.week.refunded)}</td>
            </tr>
          </tbody>
        </table>
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('admin.economy.rarity')}</th>
              <th>{t('admin.economy.count')}</th>
              <th>{t('admin.economy.observed')}</th>
              <th>{t('admin.economy.expected')}</th>
            </tr>
          </thead>
          <tbody>
            {box.rarities.map((r) => (
              <tr key={r.rarity}>
                <td>{t(RARITY_LABEL[r.rarity])}</td>
                <td>{num(r.count)}</td>
                <td>{openings ? percentText(r.count / openings, lang) : '—'}</td>
                <td>{percentText(r.chance, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel admin-section">
        <h2 className="section-title">{t('admin.economy.topItems')}</h2>
        <table className="admin-table">
          <tbody>
            {economy.topItems.map((item) => (
              <tr key={item.itemId}>
                <td>{itemName(item.itemId, lang)}</td>
                <td>{t('admin.economy.owners', { n: num(item.owners) })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <button className="btn btn-secondary btn-sm admin-refresh" onClick={load}>
        {t('admin.refresh')}
      </button>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel admin-tile">
      <span className="muted admin-small">{label}</span>
      <strong className="admin-tile-value">{value}</strong>
    </div>
  );
}

/** Nome do item na loja; avatar vira "Avatar: <id do personagem>" (a tela de admin não carrega o catálogo). */
function itemName(itemId: string, lang: 'pt' | 'en'): string {
  const character = characterIdOfAvatar(itemId);
  if (character !== null) return `Avatar: ${character}`;
  const item = cosmeticById(itemId);
  return item ? cosmeticLabel(item, lang) : itemId;
}
