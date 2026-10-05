import { useState, type ReactNode } from 'react';
import {
  BENCH_SIZE,
  bossFor,
  MAX_COPIES,
  MAX_LIVES,
  MAX_ROUNDS,
  MAX_SLOTS,
  REROLL_COST,
  rewardFor,
  ROSTER_BY_ID,
  SERIES,
  SYNERGY,
  SYNERGY_STEPS,
  sellValue,
  seriesCounts,
  shopOdds,
  slotsFor,
  synergyLevel,
  type Factors,
  type RunState,
  type RunUnit,
  type Tier,
} from '../../game/autobattle';
import { useI18n } from '../../i18n';
import Coins from '../Coins';
import UnitCard, { numberText, Portrait, SYNERGY_DESC, TIER_CLASS, unitName } from './UnitCard';

interface Props {
  run: RunState;
  factors: Factors;
  /** Esperando o servidor (rolar, lutar): comprar, vender e mover mudam a tela na hora e não passam por aqui. */
  busy: boolean;
  error: string | null;
  onBuy: (offer: number) => void;
  onSell: (id: string) => void;
  /** Time ↔ banco. */
  onMove: (id: string) => void;
  onReroll: () => void;
  onBattle: () => void;
  onAbandon: () => void;
}

/** O que está selecionado: um personagem do jogador (time ou banco) ou uma oferta da loja. */
type Selection = { kind: 'unit'; id: string } | { kind: 'offer'; index: number } | null;

const TIERS: Tier[] = [1, 2, 3];

/** Botão de ação por cima do cartão selecionado (o toque não chega ao cartão, que tiraria a seleção). */
function Action(props: { name: string; primary?: boolean; disabled?: boolean; title?: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`ab-action${props.primary ? ' primary' : ''}`}
      data-ab={props.name}
      disabled={props.disabled}
      title={props.title}
      onClick={(e) => {
        e.stopPropagation();
        props.onClick();
      }}
    >
      {props.children}
    </button>
  );
}

/**
 * Preparação da rodada, no desenho de um autobattler: placar da run em cima; no meio, as sinergias numa coluna ao
 * lado do campo (o time, com o banco como uma prateleira embaixo); a loja embaixo, com as moedas da run, as chances
 * de cada tier e o botão de rolar no próprio cabeçalho. No celular vira uma coluna só.
 */
export default function AutoBattlePrep(props: Props) {
  const { run, factors, busy, error, onBuy, onSell, onMove, onReroll, onBattle, onAbandon } = props;
  const { t, lang } = useI18n();
  const [selection, setSelection] = useState<Selection>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const slots = slotsFor(run.round);
  const counts = seriesCounts(run.team);
  const synergies = SERIES.filter((s) => counts[s.id])
    // As ligadas primeiro, depois as mais perto de ligar.
    .sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0));
  const everyone = [...run.team, ...run.bench];
  const reward = rewardFor(run.wins);
  const odds = shopOdds(run.round);
  const boss = bossFor(run.round);

  const unitCard = (unit: RunUnit, onBench: boolean) => {
    const entry = ROSTER_BY_ID.get(unit.id);
    if (!entry) return null;
    const selected = selection?.kind === 'unit' && selection.id === unit.id;
    return (
      <UnitCard
        key={unit.id}
        entry={entry}
        copies={unit.copies}
        count={unit.copies}
        factors={factors}
        selected={selected}
        onSelect={() => setSelection(selected ? null : { kind: 'unit', id: unit.id })}
        actions={
          <>
            <Action
              name="move"
              primary
              disabled={busy || (onBench ? run.team.length >= slots : run.bench.length >= BENCH_SIZE)}
              onClick={() => {
                setSelection(null);
                onMove(unit.id);
              }}
            >
              {t(onBench ? 'ab.toTeam' : 'ab.toBench')}
            </Action>
            <Action
              name="sell"
              disabled={busy}
              onClick={() => {
                setSelection(null);
                onSell(unit.id);
              }}
            >
              {t('ab.sell', { value: sellValue(entry.tier, unit.copies) })}
            </Action>
          </>
        }
      />
    );
  };

  return (
    <div className="ab-prep">
      <div className="panel ab-status">
        <span className="ab-stat">
          <span className="ab-stat-label">{t('ab.round', { n: run.round })}</span>
          {/* Trilha das rodadas: cada uma pintada pelo resultado (vitória, derrota, empate), a atual e as de chefe. */}
          <span className="ab-track" aria-label={`${run.round}/${MAX_ROUNDS}`}>
            {Array.from({ length: MAX_ROUNDS }, (_, i) => (
              <span
                key={i}
                className={`ab-step${run.history[i] ? ` ${run.history[i]}` : i + 1 === run.round ? ' now' : ''}${bossFor(i + 1) ? ' boss' : ''}`}
              />
            ))}
          </span>
        </span>
        <span className="ab-stat">
          <span className="ab-stat-label">{t('ab.lives')}</span>
          <strong className="ab-lives" data-ab="lives" aria-label={String(MAX_LIVES - run.losses)}>
            {'♥'.repeat(MAX_LIVES - run.losses)}
            <span className="ab-lives-lost">{'♥'.repeat(run.losses)}</span>
          </strong>
        </span>
      </div>

      <div className="ab-board">
        <aside className="panel ab-traits">
          <h2 className="section-title">{t('ab.synergies')}</h2>
          {synergies.length === 0 && <p className="muted ab-hint">{t('ab.noSynergy')}</p>}
          <div className="ab-synergies">
            {synergies.map((s) => {
              const count = counts[s.id] ?? 0;
              const level = synergyLevel(count);
              const value = SYNERGY[s.id].values[Math.max(0, level - 1)];
              return (
                <p key={s.id} className={`ab-synergy${level ? ' active' : ''}`} data-synergy={s.id} data-level={level}>
                  <span className="ab-synergy-head">
                    <strong>{s.name}</strong>
                    {/* Degraus da sinergia: acesos os que o time já alcançou. */}
                    <span className="ab-pips" aria-label={`${count}/${SYNERGY_STEPS[Math.min(level, SYNERGY_STEPS.length - 1)]}`}>
                      {SYNERGY_STEPS.map((step) => (
                        <span key={step} className={`ab-pip${count >= step ? ' on' : ''}`}>
                          {step}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="ab-synergy-desc">{t(SYNERGY_DESC[SYNERGY[s.id].kind], { n: numberText(value, lang) })}</span>
                </p>
              );
            })}
          </div>
        </aside>

        <section className="panel ab-field">
          <h2 className="section-title">
            {t('ab.team')}
            <span className="ab-count">
              {run.team.length}/{slots}
            </span>
          </h2>
          <div className="ab-grid ab-team">
            {Array.from({ length: MAX_SLOTS }, (_, i) =>
              run.team[i] ? (
                unitCard(run.team[i], false)
              ) : (
                // Espaço ainda fechado: abre na rodada em que o time chega a esse tamanho.
                <span key={i} className={`ab-card ab-slot${i >= slots ? ' locked' : ''}`}>
                  {i >= slots ? t('ab.lockedSlot', { n: i - 1 }) : t('ab.emptySlot')}
                </span>
              ),
            )}
          </div>

          {/* Banco: prateleira embaixo do campo, com cartões menores. */}
          <div className="ab-shelf" title={t('ab.benchHint')}>
            <h2 className="section-title">
              {t('ab.bench')}
              <span className="ab-count">
                {run.bench.length}/{BENCH_SIZE}
              </span>
            </h2>
            <div className="ab-grid ab-bench">
              {Array.from({ length: BENCH_SIZE }, (_, i) =>
                run.bench[i] ? (
                  unitCard(run.bench[i], true)
                ) : (
                  <span key={i} className="ab-card ab-slot">
                    {t('ab.emptySlot')}
                  </span>
                ),
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="panel ab-shop-panel">
        <div className="ab-shop-head">
          <h2 className="section-title">{t('ab.shop')}</h2>
          {/* Chance de cada tier nesta rodada, na cor dele. */}
          <span className="ab-odds" title={t('ab.odds')}>
            {TIERS.map((tier) => (
              <span key={tier} className={`ab-odd ${TIER_CLASS[tier]}`}>
                {odds[tier - 1]}%
              </span>
            ))}
          </span>
          <span className="ab-purse" title={t('ab.gold')}>
            <span className="ab-purse-icon" aria-hidden="true" />
            <strong className="ab-gold" data-ab="gold" aria-label={`${t('ab.gold')}: ${run.gold}`}>
              {run.gold}
            </strong>
          </span>
          <button
            className="btn btn-secondary btn-sm ab-reroll"
            data-ab="reroll"
            onClick={() => {
              // A oferta selecionada vai mudar.
              if (selection?.kind === 'offer') setSelection(null);
              onReroll();
            }}
            disabled={busy || run.gold < REROLL_COST}
            aria-busy={busy}
          >
            {t('ab.reroll', { cost: REROLL_COST })}
          </button>
        </div>
        <div className="ab-grid ab-shop">
          {run.shop.map((id, index) => {
            const entry = id ? ROSTER_BY_ID.get(id) : undefined;
            if (!entry) {
              return (
                <span key={index} className="ab-card ab-slot">
                  {t('ab.sold')}
                </span>
              );
            }
            const selected = selection?.kind === 'offer' && selection.index === index;
            // Cópia de quem o jogador já tem não ocupa lugar; personagem novo precisa de espaço no time ou no banco.
            const owned = everyone.find((u) => u.id === entry.id);
            const noRoom = owned ? owned.copies >= MAX_COPIES : run.team.length >= slots && run.bench.length >= BENCH_SIZE;
            // Destaque: repetido (já tem) ou, melhor ainda, a cópia que falta para subir de estrela.
            const upgrade = owned && (owned.copies + 1 === 3 || owned.copies + 1 === MAX_COPIES);
            return (
              <UnitCard
                key={index}
                entry={entry}
                copies={1}
                count={owned?.copies}
                tipCopies={Math.min(MAX_COPIES, (owned?.copies ?? 0) + 1)}
                factors={factors}
                selected={selected}
                highlight={upgrade ? 'upgrade' : owned ? 'owned' : undefined}
                onSelect={() => setSelection(selected ? null : { kind: 'offer', index })}
                footer={
                  <>
                    <span className={`ab-cost${entry.tier > run.gold ? ' short' : ''}`}>{entry.tier}</span>
                    {upgrade && <span className="ab-upgrade">★ +1</span>}
                  </>
                }
                actions={
                  <Action
                    name="buy"
                    primary
                    disabled={busy || run.gold < entry.tier || noRoom}
                    title={noRoom && !owned ? t('ab.teamFull') : undefined}
                    onClick={() => {
                      setSelection(null);
                      onBuy(index);
                    }}
                  >
                    {t('ab.buy', { cost: entry.tier })}
                  </Action>
                }
              />
            );
          })}
        </div>
      </section>

      {error && <p className="error ab-error">{error}</p>}

      {boss && (
        <div className="ab-boss-alert" data-ab="boss">
          <Portrait id={boss.unit} />
          <p>
            <strong>{unitName(boss.unit)}</strong> {t('ab.bossAlert')}
          </p>
        </div>
      )}

      <div className="ab-fight-wrap">
        <button
          className="btn btn-primary ab-fight"
          data-ab="fight"
          onClick={onBattle}
          disabled={busy || run.team.length === 0}
          aria-busy={busy}
        >
          {t(boss ? 'ab.fightBoss' : 'ab.fight')}
        </button>
      </div>
      {run.team.length === 0 && <p className="muted ab-hint ab-fight-hint">{t('ab.fightEmpty')}</p>}

      <div className="ab-abandon">
        {confirmAbandon ? (
          <>
            <p className="muted ab-abandon-text">
              {t('ab.abandonConfirm')} {reward > 0 && <Coins amount={reward} prefix="+" />}
            </p>
            <button className="link-button" onClick={onAbandon} disabled={busy}>
              {t('ab.abandonYes')}
            </button>
            <button className="link-button" onClick={() => setConfirmAbandon(false)}>
              {t('common.cancel')}
            </button>
          </>
        ) : (
          <button className="link-button" onClick={() => setConfirmAbandon(true)}>
            {t('ab.abandon')}
          </button>
        )}
      </div>
    </div>
  );
}
