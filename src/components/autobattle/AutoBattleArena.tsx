import { useEffect, useMemo, useRef, useState } from 'react';
import type { AutoBattleFight } from '../../api';
import { EMPTY_LOOK } from '../../game/cosmetics';
import { ROSTER_BY_ID, simulateBattle, type Factors, type RunUnit } from '../../game/autobattle';
import { useI18n, type Key } from '../../i18n';
import PlayerTag from '../PlayerTag';
import { Portrait, Stars, TIER_CLASS, unitName } from './UnitCard';

interface Props {
  fight: AutoBattleFight;
  factors: Factors;
  /** Nick do jogador (o lado de baixo). */
  nick: string;
  onDone: () => void;
}

const OUTCOME_TEXT: Record<AutoBattleFight['outcome'], Key> = { win: 'ab.win', loss: 'ab.loss', draw: 'ab.draw' };
const SPEEDS = [1, 2, 4];

/**
 * A luta, animada. O resultado já foi decidido no servidor: aqui a mesma simulação roda de novo (mesma semente)
 * e os eventos são tocados no tempo, mexendo as duas barras de vida. Dá para acelerar ou pular.
 */
export default function AutoBattleArena({ fight, factors, nick, onDone }: Props) {
  const { t } = useI18n();
  const result = useMemo(
    () => simulateBattle(fight.team, fight.opponent.team, factors, fight.seed),
    [fight, factors],
  );
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  // Quantos eventos já foram tocados (a vida mostrada é a do último).
  const [played, setPlayed] = useState(0);
  const skipRef = useRef(false);
  const unitRefs = useRef<[(HTMLSpanElement | null)[], (HTMLSpanElement | null)[]]>([[], []]);
  const finished = played >= result.events.length;

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let last = performance.now();
    let clock = 0;
    let index = 0;
    const tick = (now: number) => {
      clock += (now - last) * speedRef.current;
      last = now;
      if (skipRef.current) clock = Infinity;
      const from = index;
      while (index < result.events.length && result.events[index].t <= clock) index++;
      if (index !== from) {
        // Só os últimos eventos do quadro ganham animação (pulando ou em 4×, a maioria não seria vista).
        if (!reduced && !skipRef.current) {
          for (const e of result.events.slice(Math.max(from, index - 6), index)) {
            const el = unitRefs.current[e.side][e.unit];
            const dir = e.side === 0 ? -1 : 1;
            if (e.kind === 'hit') {
              el?.animate(
                [{ transform: 'translateY(0)' }, { transform: `translateY(${dir * (e.crit ? 14 : 8)}px)` }, { transform: 'translateY(0)' }],
                { duration: 220, easing: 'ease-out' },
              );
              unitRefs.current[e.side === 0 ? 1 : 0][e.target]?.animate(
                [{ filter: 'brightness(1)' }, { filter: `brightness(${e.crit ? 2.4 : 1.7})` }, { filter: 'brightness(1)' }],
                { duration: 220 },
              );
            } else {
              el?.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.8) saturate(1.6)' }, { filter: 'brightness(1)' }], {
                duration: 400,
              });
            }
          }
        }
        setPlayed(index);
      }
      if (index < result.events.length) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [result]);

  const last = played > 0 ? result.events[played - 1] : null;
  const hp = last ? last.hp : result.maxHp;
  const shield = last ? last.shield : result.startShield;

  const side = (index: 0 | 1, team: RunUnit[]) => (
    <div className={`ab-side ab-side-${index === 0 ? 'mine' : 'foe'}`}>
      <div className="ab-side-head">
        {index === 0 ? (
          <strong className="ab-side-name">{nick}</strong>
        ) : fight.opponent.name ? (
          <PlayerTag name={fight.opponent.name} look={fight.opponent.look ?? EMPTY_LOOK} size={24} />
        ) : (
          <strong className={`ab-side-name${fight.opponent.boss ? ' ab-boss-name' : ''}`}>
            {fight.opponent.boss ? `${t('ab.boss')} · ${unitName(fight.opponent.team[0]?.id ?? '')}` : t('ab.bot')}
          </strong>
        )}
        <span className="ab-hp-text" data-ab={`hp-${index}`}>
          {hp[index]}
          {shield[index] > 0 && <span className="ab-shield-text"> +{shield[index]}</span>}
          <span className="muted"> / {result.maxHp[index]}</span>
        </span>
      </div>
      <div className="ab-bar" role="img" aria-label={`${hp[index]} / ${result.maxHp[index]}`}>
        <span
          className="ab-bar-fill"
          style={{ width: `${result.maxHp[index] ? (100 * hp[index]) / result.maxHp[index] : 0}%` }}
        />
        {result.startShield[index] > 0 && (
          <span
            className="ab-bar-shield"
            style={{ width: `${Math.min(100, (100 * shield[index]) / Math.max(1, result.maxHp[index]))}%` }}
          />
        )}
      </div>
      <div className="ab-fighters">
        {team.map((unit, i) => {
          const entry = ROSTER_BY_ID.get(unit.id);
          // O chefe não é do elenco: um retrato só, grande.
          if (!entry) {
            return (
              <span key={unit.id} className="ab-fighter ab-fighter-boss">
                <span className="ab-photo">
                  <Portrait
                    id={unit.id}
                    imgRef={(el) => {
                      unitRefs.current[index][i] = el;
                    }}
                  />
                </span>
              </span>
            );
          }
          return (
            <span key={unit.id} className={`ab-fighter ${TIER_CLASS[entry.tier]}`}>
              <span className="ab-photo">
                <Portrait
                  id={unit.id}
                  imgRef={(el) => {
                    unitRefs.current[index][i] = el;
                  }}
                />
                <Stars copies={unit.copies} />
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="panel ab-arena" data-ab="arena">
      {side(1, fight.opponent.team)}
      <div className="ab-arena-mid">
        {finished ? (
          <strong className={`ab-outcome ab-outcome-${fight.outcome}`} data-ab="outcome">
            {t(OUTCOME_TEXT[fight.outcome])}
          </strong>
        ) : (
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}>
              {t('ab.speedBtn', { n: speed })}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              data-ab="skip"
              onClick={() => {
                skipRef.current = true;
              }}
            >
              {t('ab.skip')}
            </button>
          </>
        )}
      </div>
      {side(0, fight.team)}
      {finished && (
        <button className="btn btn-primary ab-continue" data-ab="continue" onClick={onDone}>
          {t('ab.continue')}
        </button>
      )}
    </div>
  );
}
