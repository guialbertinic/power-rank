import { useEffect, useRef, useState } from 'react';
import { dropPlinko, type PlinkoDrop } from '../api';
import type { Profile } from '../game/cosmetics';
import {
  BET_MAX,
  BET_MIN,
  distanceFromCenter,
  multipliersOf,
  multiplierText,
  RISKS,
  ROWS,
  SLOTS,
  slotChance,
  type Risk,
} from '../game/plinko';
import { serverText, useI18n, type Key, type Lang } from '../i18n';
import type { Identity } from '../nick';
import Coins from './Coins';

interface Props {
  identity: Identity & { token: string };
  profile: Profile;
  onProfileChange: (profile: Profile) => void;
}

// Geometria do tabuleiro (unidades do viewBox do SVG).
const GAP_X = 20;
const GAP_Y = 18;
const TOP = 16;
const WIDTH = (ROWS + 2) * GAP_X;
const BUCKET_Y = TOP + ROWS * GAP_Y;
const BUCKET_H = 20;
const HEIGHT = BUCKET_Y + BUCKET_H + 4;
const PEG_R = 2.2;
const BALL_R = 4.5;
/** Altura do "pulo" da bolinha entre dois pinos. */
const HOP = 6;

/** Tempo de cada trecho (queda até o 1º pino, cada pino, a casa). Com "reduzir movimento", bem mais rápido. */
const SEGMENT_MS = 100;
const SEGMENT_MS_REDUCED = 20;
/** Bolinhas ao mesmo tempo na tela (inclusive as que esperam o servidor). */
const MAX_BALLS = 4;
/** Resultados recentes na faixa de histórico. */
const HISTORY_SIZE = 6;

const RISK_LABEL: Record<Risk, Key> = { low: 'plinko.risk.low', medium: 'plinko.risk.medium', high: 'plinko.risk.high' };
/** Cor de cada casa pela distância até o meio: pontas = SS (dourado), meio = D (cinza). */
const TIER_BY_DISTANCE = ['d', 'd', 'c', 'b', 'a', 's', 'ss'];

const pegX = (row: number, index: number) => WIDTH / 2 + (index - (row + 2) / 2) * GAP_X;
const pegY = (row: number) => TOP + row * GAP_Y;
const slotX = (slot: number) => WIDTH / 2 + (slot - ROWS / 2) * GAP_X;

/** Pontos por onde a bolinha passa: em cima de cada pino e, no fim, dentro da casa. */
function waypoints(path: (0 | 1)[]): [number, number][] {
  const points: [number, number][] = [[WIDTH / 2, -BALL_R]];
  let rights = 0;
  path.forEach((step, row) => {
    points.push([WIDTH / 2 + (rights - row / 2) * GAP_X, pegY(row) - PEG_R - BALL_R]);
    rights += step;
  });
  points.push([slotX(rights), BUCKET_Y + BUCKET_H / 2]);
  return points;
}

/** Posição da bolinha `elapsed` ms depois de solta (null = já chegou). */
function ballPosition(points: [number, number][], elapsed: number, segmentMs: number): [number, number] | null {
  // O quadro do requestAnimationFrame pode ter começado um pouco antes de a bolinha ser solta: tempo negativo = no topo.
  elapsed = Math.max(0, elapsed);
  const segment = Math.floor(elapsed / segmentMs);
  if (segment >= points.length - 1) return null;
  const t = (elapsed % segmentMs) / segmentMs;
  const [x0, y0] = points[segment];
  const [x1, y1] = points[segment + 1];
  // O primeiro trecho é só queda; os outros quicam num arco.
  const hop = segment === 0 ? 0 : HOP * 4 * t * (1 - t);
  return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t * t - hop];
}

interface Ball extends PlinkoDrop {
  id: number;
  bet: number;
  risk: Risk;
  points: [number, number][];
  startedAt: number;
}

interface Landed {
  id: number;
  slot: number;
  multiplier: number;
  prize: number;
  bet: number;
}

const pct = (n: number, lang: Lang) =>
  n.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US', { style: 'percent', maximumFractionDigits: n < 0.01 ? 2 : 1 });

/**
 * Plinko (aba do Arcade). O servidor sorteia o caminho e acerta as moedas; aqui a bolinha só percorre esse caminho.
 * Várias bolinhas podem cair ao mesmo tempo. O saldo na tela desconta a aposta ao soltar e soma o prêmio quando a
 * bolinha chega na casa.
 */
export default function PlinkoBoard({ identity, profile, onProfileChange }: Props) {
  const { t, lang } = useI18n();
  const decimal = lang === 'pt' ? ',' : '.';
  const [bet, setBet] = useState(BET_MIN);
  const [risk, setRisk] = useState<Risk>('medium');
  const [balls, setBalls] = useState<Ball[]>([]);
  /** Apostas enviadas que ainda esperam a resposta do servidor. */
  const [pending, setPending] = useState<number[]>([]);
  const [history, setHistory] = useState<Landed[]>([]);
  const [hit, setHit] = useState<{ slot: number; id: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [now, setNow] = useState(() => performance.now());
  const nextId = useRef(0);
  /** Ordem dos pedidos: resposta mais velha que a última aplicada não mexe no saldo. */
  const appliedSeq = useRef(-1);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const [segmentMs] = useState(() =>
    matchMedia('(prefers-reduced-motion: reduce)').matches ? SEGMENT_MS_REDUCED : SEGMENT_MS,
  );

  // Enquanto houver bolinha caindo, redesenha a cada quadro e tira as que chegaram.
  useEffect(() => {
    if (!balls.length) return;
    const frame = requestAnimationFrame((time) => {
      setNow(time);
      const arrived = balls.filter((b) => ballPosition(b.points, time - b.startedAt, segmentMs) === null);
      if (!arrived.length) return;
      setBalls((all) => all.filter((b) => !arrived.includes(b)));
      setHistory((h) =>
        [...arrived.reverse().map((b) => ({ id: b.id, slot: b.slot, multiplier: b.multiplier, prize: b.prize, bet: b.bet })), ...h].slice(
          0,
          HISTORY_SIZE,
        ),
      );
      const last = arrived[0];
      setHit({ slot: last.slot, id: last.id });
    });
    return () => cancelAnimationFrame(frame);
  }, [balls, now]);

  const inPlay = balls.length + pending.length;
  // Saldo na tela: o do servidor menos as apostas ainda sem resposta e os prêmios das bolinhas que não chegaram.
  const shownCoins =
    profile.coins - pending.reduce((sum, b) => sum + b, 0) - balls.reduce((sum, b) => sum + b.prize, 0);
  const canDrop = inPlay < MAX_BALLS && shownCoins >= bet;

  const onDrop = () => {
    if (!canDrop) return;
    const seq = nextId.current++;
    const ballBet = bet;
    const ballRisk = risk;
    setPending((p) => [...p, ballBet]);
    setError(null);
    const removePending = () =>
      setPending((p) => {
        const i = p.indexOf(ballBet);
        return i < 0 ? p : [...p.slice(0, i), ...p.slice(i + 1)];
      });
    dropPlinko(identity.token, ballBet, ballRisk)
      .then((r) => {
        removePending();
        const startedAt = performance.now();
        setNow(startedAt);
        setBalls((all) => [...all, { ...r, id: seq, bet: ballBet, risk: ballRisk, points: waypoints(r.path), startedAt }]);
        if (seq > appliedSeq.current) {
          appliedSeq.current = seq;
          onProfileChange({ ...profileRef.current, coins: r.coins });
        }
      })
      .catch((err) => {
        removePending();
        setError(err instanceof TypeError ? t('common.offline') : serverText(err.message, lang));
      });
  };

  const changeBet = (delta: number) => setBet((b) => Math.min(BET_MAX, Math.max(BET_MIN, b + delta)));
  const multipliers = multipliersOf(risk);
  const last = history[0];
  // Tabela do "?": uma linha por distância até o meio (pontas → meio), chance somando os dois lados.
  const helpRows = Array.from({ length: ROWS / 2 + 1 }, (_, i) => ROWS / 2 - i).map((distance) => ({
    distance,
    chance: distance ? 2 * slotChance(ROWS / 2 - distance) : slotChance(ROWS / 2),
  }));

  return (
    <section className="casino plinko">
      <div className="casino-marquee">
        <span className="casino-title">Power Plinko</span>
        <button
          className="leaderboard-help-toggle"
          onClick={() => setHelpOpen((open) => !open)}
          aria-expanded={helpOpen}
          aria-label={t('plinko.helpAria')}
        >
          ?
        </button>
      </div>

      {helpOpen && (
        <div className="panel casino-help">
          <p>{t('plinko.helpRules', { rows: ROWS })}</p>
          <table className="casino-table plinko-table">
            <thead>
              <tr>
                <th>{t('plinko.chance')}</th>
                {RISKS.map((r) => (
                  <th key={r}>{t(RISK_LABEL[r])}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {helpRows.map(({ distance, chance }) => (
                <tr key={distance}>
                  <td>
                    <span className={`plinko-dot tier-${TIER_BY_DISTANCE[distance]}`} aria-hidden="true" />
                    {pct(chance, lang)}
                  </td>
                  {RISKS.map((r) => (
                    <td key={r}>{multiplierText(multipliersOf(r)[ROWS / 2 - distance], decimal)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p>{t('plinko.helpRound', { min: BET_MIN, max: BET_MAX })}</p>
          <p className="muted">{t('plinko.helpReturn')}</p>
        </div>
      )}

      <div className="casino-machine">
        <div className="plinko-board">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={t('plinko.boardAria')}>
            {Array.from({ length: ROWS }, (_, row) =>
              Array.from({ length: row + 3 }, (_, i) => (
                <circle key={`${row}-${i}`} className="plinko-peg" cx={pegX(row, i)} cy={pegY(row)} r={PEG_R} />
              )),
            )}
            {Array.from({ length: SLOTS }, (_, slot) => (
              <g
                // A chave muda a cada bolinha que cai aqui: reinicia a animação de "acerto".
                key={hit?.slot === slot ? `${slot}-${hit.id}` : slot}
                className={`plinko-bucket tier-${TIER_BY_DISTANCE[distanceFromCenter(slot)]}${hit?.slot === slot ? ' hit' : ''}`}
              >
                <rect x={slotX(slot) - GAP_X / 2 + 1} y={BUCKET_Y} width={GAP_X - 2} height={BUCKET_H} rx={2} />
                <text x={slotX(slot)} y={BUCKET_Y + BUCKET_H / 2}>
                  {multiplierText(multipliers[slot], decimal)}
                </text>
              </g>
            ))}
            {balls.map((b) => {
              const pos = ballPosition(b.points, now - b.startedAt, segmentMs);
              return pos && <circle key={b.id} className="plinko-ball" cx={pos[0]} cy={pos[1]} r={BALL_R} />;
            })}
          </svg>
        </div>

        <button className="btn btn-primary btn-lg casino-spin plinko-drop" onClick={onDrop} disabled={!canDrop}>
          {t('plinko.drop')}
        </button>

        <p className={`casino-result${last && last.prize > last.bet ? ' win' : ''}`} aria-live="polite">
          {last
            ? t('plinko.result', { prize: last.prize })
            : inPlay
              ? t('plinko.falling')
              : t('slots.goodLuck')}
        </p>
        {history.length > 0 && (
          <ol className="plinko-history" aria-label={t('plinko.history')}>
            {history.map((h) => (
              <li key={h.id} className={`tier-${TIER_BY_DISTANCE[distanceFromCenter(h.slot)]}`}>
                {multiplierText(h.multiplier, decimal)}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="casino-panel">
        <div className="casino-side plinko-risk">
          <span className="casino-label">{t('plinko.risk')}</span>
          <div className="plinko-risks" role="radiogroup" aria-label={t('plinko.risk')}>
            {RISKS.map((r) => (
              <button
                key={r}
                role="radio"
                aria-checked={risk === r}
                className={`shop-filter-option${risk === r ? ' selected' : ''}`}
                onClick={() => setRisk(r)}
                // Trocar o risco com bolinhas caindo mudaria as casas embaixo delas.
                disabled={inPlay > 0}
              >
                {t(RISK_LABEL[r])}
              </button>
            ))}
          </div>
        </div>

        <div className="casino-side casino-wallet">
          <span className="casino-label">{t('slots.balance')}</span>
          <span className="casino-balance">
            <Coins amount={shownCoins} />
          </span>
          <div className="casino-bet" aria-label={t('slots.bet')}>
            <button className="shop-filter-option" onClick={() => changeBet(-1)} disabled={bet <= BET_MIN}>
              −
            </button>
            <span className="casino-bet-value">
              <Coins amount={bet} />
            </span>
            <button className="shop-filter-option" onClick={() => changeBet(1)} disabled={bet >= BET_MAX}>
              +
            </button>
            <button className="shop-filter-option" onClick={() => setBet(BET_MAX)} disabled={bet === BET_MAX}>
              {t('slots.max')}
            </button>
          </div>
          {shownCoins < bet && inPlay === 0 && <span className="casino-hint">{t('slots.notEnough')}</span>}
        </div>
      </div>
      {error && <p className="error casino-error">{error}</p>}
    </section>
  );
}
