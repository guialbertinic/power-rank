import { useEffect, useRef, useState } from 'react';
import { fetchCasino, spinCasino, type CasinoState, type SpinResult } from '../api';
import {
  BET_MAX,
  BET_MIN,
  BET_STEP,
  JACKPOT_SYMBOL,
  jackpotPrize,
  POT_CONTRIBUTION,
  POT_PAYOUT_SHARE,
  SYMBOLS,
  SYMBOLS_BY_ID,
  type SymbolId,
} from '../game/casino';
import type { Profile } from '../game/cosmetics';
import type { Identity } from '../nick';
import CasinoIcon, { preloadCasinoIcons } from './CasinoIcon';
import Coins from './Coins';

interface Props {
  identity: Identity & { token: string };
  profile: Profile;
  onProfileChange: (profile: Profile) => void;
}

/** Tempo mínimo girando antes de parar o 1º rolo, e intervalo entre os rolos. */
const MIN_SPIN_MS = 700;
const STOP_GAP_MS = 380;

const pct = (n: number) => `${Math.round(n * 100)}%`;
const coinsText = (n: number) => n.toLocaleString('pt-BR');

/** Texto do resultado de um giro. */
function resultText(r: SpinResult): string {
  if (r.jackpot) return `JACKPOT! +${coinsText(r.prize)}`;
  if (r.outcome.kind === 'three') return `3× ${SYMBOLS_BY_ID.get(r.outcome.symbol)!.label}! +${coinsText(r.prize)}`;
  if (r.outcome.kind === 'pair') {
    const label = SYMBOLS_BY_ID.get(r.outcome.symbol)!.label;
    return r.outcome.multiplier === 1 ? `Par de ${label}: aposta de volta` : `Par de ${label}: +${coinsText(r.prize)}`;
  }
  return 'Não foi dessa vez';
}

/**
 * Cassino: caça-níquel de 3 rolos. O servidor sorteia e acerta as moedas; aqui os rolos giram até a resposta
 * chegar e param um a um no resultado. O saldo na tela só muda quando o último rolo para.
 */
export default function CasinoScreen({ identity, profile, onProfileChange }: Props) {
  const [casino, setCasino] = useState<CasinoState | null>(null);
  const [bet, setBet] = useState(BET_MIN);
  const [reels, setReels] = useState<SymbolId[]>(['seven', 'galactic', 'pikachu']);
  /** Quantos rolos já pararam (3 = parado). */
  const [stopped, setStopped] = useState(3);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    preloadCasinoIcons();
    fetchCasino()
      .then(setCasino)
      .catch(() => setError('Sem conexão com o servidor.'));
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const spinning = stopped < 3;
  const canSpin = !spinning && profile.coins >= bet;

  const onSpin = () => {
    if (!canSpin) return;
    const startedAt = Date.now();
    setStopped(0);
    setResult(null);
    setError(null);
    spinCasino(identity.token, bet)
      .then((r) => {
        const wait = Math.max(0, MIN_SPIN_MS - (Date.now() - startedAt));
        setReels(r.reels);
        [1, 2, 3].forEach((n) => {
          timers.current.push(
            setTimeout(() => {
              setStopped(n);
              if (n === 3) {
                setResult(r);
                onProfileChange({ ...profile, coins: r.coins });
                setCasino((c) => ({ pot: r.pot, lastWinner: c?.lastWinner ?? null }));
                if (r.jackpot) fetchCasino().then(setCasino).catch(() => {});
              }
            }, wait + (n - 1) * STOP_GAP_MS),
          );
        });
      })
      .catch((err) => {
        setStopped(3);
        setError(err instanceof TypeError ? 'Sem conexão com o servidor.' : err.message);
      });
  };

  const changeBet = (delta: number) => setBet((b) => Math.min(BET_MAX, Math.max(BET_MIN, b + delta)));
  /** Rolos que formam o prêmio (brilham quando param). */
  const winning = (i: number) => {
    if (!result) return false;
    const { outcome } = result;
    if (outcome.kind === 'jackpot') return true;
    return outcome.kind !== 'none' && reels[i] === outcome.symbol;
  };

  return (
    // A tela inteira é o gabinete da máquina.
    <section className="casino">
      {/* Letreiro com luzes, como no topo de uma máquina */}
      <div className="casino-marquee">
        <span className="casino-title">Power Slots</span>
        <button
          className="leaderboard-help-toggle"
          onClick={() => setHelpOpen((open) => !open)}
          aria-expanded={helpOpen}
          aria-label="Como funciona o cassino"
        >
          ?
        </button>
      </div>

      {helpOpen && (
        <div className="panel casino-help">
          <table className="casino-table">
            <thead>
              <tr>
                <th>Símbolo</th>
                <th>3 iguais</th>
                <th>2 iguais</th>
              </tr>
            </thead>
            <tbody>
              {SYMBOLS.map((s) => (
                <tr key={s.id}>
                  <td>
                    <CasinoIcon id={s.id} size={28} /> {s.label}
                  </td>
                  <td>{s.id === JACKPOT_SYMBOL ? 'Jackpot' : `${s.three}×`}</td>
                  <td>{s.pair ? `${s.pair}×` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Os prêmios multiplicam a aposta (de {BET_MIN} a {BET_MAX}); a chance é a mesma em qualquer aposta.{' '}
            {pct(POT_CONTRIBUTION)} de cada aposta vai para o <strong>pote acumulado</strong>.
          </p>
          <p>
            <strong>Jackpot (três 7):</strong> quem aposta {BET_MAX} leva {pct(POT_PAYOUT_SHARE)} do pote;
            apostas menores levam uma parte proporcional (aposta {BET_MIN} = {pct(BET_MIN / BET_MAX)} disso). O jackpot
            nunca paga menos que {SYMBOLS_BY_ID.get(JACKPOT_SYMBOL)!.three}× a aposta. O resto do pote continua acumulando.
          </p>
          <p className="muted">Em média, volta cerca de 95% do que é apostado. Moedas não valem dinheiro real.</p>
        </div>
      )}

      <div className="casino-machine">
        <div className={`casino-reels${result?.jackpot ? ' jackpot' : ''}`}>
          {reels.map((id, i) => (
            <div
              key={i}
              className={`casino-reel${i >= stopped ? ' spinning' : ''}${i < stopped && winning(i) ? ' win' : ''}`}
            >
              {i >= stopped ? (
                <div className="casino-strip" style={{ animationDelay: `${-i * 90}ms` }}>
                  {[...SYMBOLS, ...SYMBOLS].map((s, k) => (
                    <CasinoIcon key={k} id={s.id} />
                  ))}
                </div>
              ) : (
                <div className="casino-stop">
                  <CasinoIcon id={id} />
                </div>
              )}
            </div>
          ))}
        </div>

        <button className="btn btn-primary btn-lg casino-spin" onClick={onSpin} disabled={!canSpin}>
          Spin
        </button>

        <p className={`casino-result${result && result.prize > 0 ? ' win' : ''}`} aria-live="polite">
          {result ? resultText(result) : spinning ? 'Girando...' : 'Boa sorte!'}
        </p>
      </div>

      {/* Painel de baixo: pote de um lado, saldo + aposta + Spin do outro. */}
      <div className="casino-panel">
        <div className="casino-side casino-pot">
          <span className="casino-label">Pote acumulado</span>
          {/* Valor no meio do quadrado, com o payout pequeno logo embaixo. */}
          <div className="casino-pot-main">
            <Coins amount={casino?.pot ?? 0} />
            {casino && (
              <span className="casino-pot-payout">
                Payout jackpot: <strong>{coinsText(jackpotPrize(bet, casino.pot))}</strong>
              </span>
            )}
          </div>
          {casino?.lastWinner && (
            <span className="casino-hint casino-last">
              Último: <strong>{casino.lastWinner.name}</strong> +{coinsText(casino.lastWinner.prize)} em{' '}
              {new Date(casino.lastWinner.at).toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>

        <div className="casino-side casino-wallet">
          <span className="casino-label">Saldo</span>
          <span className="casino-balance">
            <Coins amount={profile.coins} />
          </span>
          <div className="casino-bet" aria-label="Aposta">
            <button className="shop-filter-option" onClick={() => changeBet(-BET_STEP)} disabled={spinning || bet <= BET_MIN}>
              −
            </button>
            <span className="casino-bet-value">
              <Coins amount={bet} />
            </span>
            <button className="shop-filter-option" onClick={() => changeBet(BET_STEP)} disabled={spinning || bet >= BET_MAX}>
              +
            </button>
            <button className="shop-filter-option" onClick={() => setBet(BET_MAX)} disabled={spinning || bet === BET_MAX}>
              Máx
            </button>
          </div>
          {profile.coins < bet && !spinning && <span className="casino-hint">Moedas insuficientes para essa aposta.</span>}
        </div>
      </div>
      {error && <p className="error casino-error">{error}</p>}
    </section>
  );
}
