import { useEffect, useState, type ReactNode, type Ref } from 'react';
import { POOL_BY_ID } from '../../data';
import {
  MAX_COPIES,
  SERIES,
  starProgress,
  starsOf,
  SYNERGY,
  SYNERGY_STEPS,
  unitStats,
  type Factors,
  type Role,
  type RosterEntry,
  type SynergyKind,
  type Tier,
} from '../../game/autobattle';
import { useI18n, type I18n, type Key } from '../../i18n';
import { characterImageUrl, fallbackBackground, initials } from '../../ui/fallback';

/** Cor de cada tier do elenco (classes de tier do design system): 1 cinza, 2 azul, 3 laranja. */
export const TIER_CLASS: Record<Tier, string> = { 1: 'tier-d', 2: 'tier-b', 3: 'tier-ss' };

const ROLE_NAME: Record<Role, Key> = {
  attacker: 'ab.role.attacker',
  tank: 'ab.role.tank',
  crit: 'ab.role.crit',
  fast: 'ab.role.fast',
  rage: 'ab.role.rage',
  burn: 'ab.role.burn',
  heal: 'ab.role.heal',
  shield: 'ab.role.shield',
  weaken: 'ab.role.weaken',
  haste: 'ab.role.haste',
};

const ROLE_DESC: Record<Role, Key> = {
  attacker: 'ab.roleDesc.attacker',
  tank: 'ab.roleDesc.tank',
  crit: 'ab.roleDesc.crit',
  fast: 'ab.roleDesc.fast',
  rage: 'ab.roleDesc.rage',
  burn: 'ab.roleDesc.burn',
  heal: 'ab.roleDesc.heal',
  shield: 'ab.roleDesc.shield',
  weaken: 'ab.roleDesc.weaken',
  haste: 'ab.roleDesc.haste',
};

export const SYNERGY_DESC: Record<SynergyKind, Key> = {
  hp: 'ab.syn.hp',
  atk: 'ab.syn.atk',
  crit: 'ab.syn.crit',
  weaken: 'ab.syn.weaken',
  ramp: 'ab.syn.ramp',
  haste: 'ab.syn.haste',
  clutch: 'ab.syn.clutch',
  lifesteal: 'ab.syn.lifesteal',
};

const SERIES_BY_ID = new Map(SERIES.map((s) => [s.id, s]));

/** Número no idioma da tela (1,2 em português; 1.2 em inglês). */
export const numberText = (n: number, lang: I18n['lang']) => n.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US');

/** Nome do personagem pelo catálogo público (o elenco só guarda o id). */
export const unitName = (id: string) => POOL_BY_ID.get(id)?.name ?? id;

/**
 * Estrelas do personagem (uma por fusão: sem estrela vazia) e, com `count`, as cópias que ele tem rumo à próxima
 * estrela ("2/3", "5/9"; nada na estrela máxima).
 */
export function Stars({ copies, count }: { copies: number; count?: number }) {
  const stars = starsOf(copies);
  return (
    <span className="ab-rank">
      <span className="ab-stars" aria-label={`${stars}★`}>
        {'★'.repeat(stars)}
      </span>
      {count !== undefined && count < MAX_COPIES && (
        <span className="ab-copies">
          {count}/{count >= 3 ? MAX_COPIES : 3}
        </span>
      )}
    </span>
  );
}

/** Retrato do personagem (imagem do catálogo ou iniciais). */
export function Portrait({ id, imgRef }: { id: string; imgRef?: Ref<HTMLSpanElement> }) {
  const info = POOL_BY_ID.get(id);
  const src = info ? characterImageUrl(info) : null;
  return (
    <span className="ab-portrait" ref={imgRef}>
      {src ? (
        <img src={src} alt="" loading="lazy" />
      ) : (
        <span className="ab-portrait-fallback" style={{ background: fallbackBackground(id) }}>
          {initials(unitName(id))}
        </span>
      )}
    </span>
  );
}

interface Props {
  entry: RosterEntry;
  /** Cópias mostradas no cartão (estrelas). */
  copies: number;
  /** Cópias que o jogador tem, mostradas ao lado das estrelas (na loja: só se já tem o personagem). */
  count?: number;
  /** Cópias usadas na dica: na loja, como o personagem fica depois da compra. */
  tipCopies?: number;
  factors: Factors;
  selected?: boolean;
  /** Toque no cartão: seleciona (ou tira a seleção). */
  onSelect: () => void;
  /** Botões que aparecem por cima do cartão selecionado (comprar, vender, mover). */
  actions?: ReactNode;
  /** Selo no canto da foto (ex: o custo na loja). */
  footer?: ReactNode;
  /** Oferta de quem o jogador já tem (`owned`) ou a cópia que falta para subir de estrela (`upgrade`). */
  highlight?: 'owned' | 'upgrade';
}

/**
 * Cartão de personagem do time, do banco ou da loja: foto com as estrelas e as cópias por cima, nome e obra
 * (abreviada); a cor do cartão é o tier. O "?" abre a dica (o que o papel faz, a sinergia da obra e os atributos);
 * selecionado, as ações ficam por cima do próprio cartão.
 */
export default function UnitCard(props: Props) {
  const { entry, copies, count, tipCopies = copies, factors, selected, onSelect, actions, footer, highlight } = props;
  const { t, lang } = useI18n();
  const stats = unitStats(entry, tipCopies, factors);
  const progress = starProgress(tipCopies);
  const synergy = SYNERGY[entry.series];
  const series = SERIES_BY_ID.get(entry.series);
  const [tipOpen, setTipOpen] = useState(false);
  // A dica fecha no próximo toque em qualquer lugar (o "?" trata o próprio toque).
  useEffect(() => {
    if (!tipOpen) return;
    const close = () => setTipOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [tipOpen]);
  return (
    <div
      className={`ab-card ${TIER_CLASS[entry.tier]}${selected ? ' selected' : ''}${tipOpen ? ' tip-open' : ''}${highlight ? ` mark-${highlight}` : ''}`}
      data-unit={entry.id}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        onSelect();
      }}
    >
      <span className="ab-photo">
        <Portrait id={entry.id} />
        <Stars copies={copies} count={count} />
        {footer}
        <button
          type="button"
          className="ab-help"
          aria-label={t('ab.help')}
          aria-expanded={tipOpen}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setTipOpen((open) => !open);
          }}
        >
          ?
        </button>
      </span>
      <span className="ab-card-name">{unitName(entry.id)}</span>
      <span className="ab-card-series" title={series?.name}>
        {series?.short}
      </span>

      <div className="ab-tip" role="tooltip">
        <p className="ab-tip-head">
          <strong>{unitName(entry.id)}</strong>
          <span className="muted">
            {progress ? t('ab.copies', { have: progress[0], need: progress[1], stars: starsOf(tipCopies) + 1 }) : t('ab.maxStars')}
          </span>
        </p>
        <p>
          <strong className="ab-tip-role">{t(ROLE_NAME[entry.role])}:</strong>{' '}
          {t(ROLE_DESC[entry.role], { n: numberText(stats.ability, lang) })}
        </p>
        <p>
          <strong className="ab-tip-series">
            {series?.name} ({SYNERGY_STEPS.join('/')}):
          </strong>{' '}
          {t(SYNERGY_DESC[synergy.kind], { n: synergy.values.map((v) => numberText(v, lang)).join(' / ') })}
        </p>
        <p className="ab-tip-stats">
          {t('ab.hp')} <strong>{stats.hp}</strong> · {t('ab.atk')} <strong>{stats.atk}</strong> · {t('ab.speed')}{' '}
          <strong>{numberText(Math.round(10000 / stats.interval) / 10, lang)}</strong>
        </p>
      </div>

      {selected && actions && <div className="ab-actions">{actions}</div>}
    </div>
  );
}
