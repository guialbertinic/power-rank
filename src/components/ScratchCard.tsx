import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { buyScratch, type ScratchCard as Card } from '../api';
import type { Profile } from '../game/cosmetics';
import { BET_MAX, BET_MIN, CELLS, PRIZES, WEIGHT_TOTAL } from '../game/scratch';
import { serverText, useI18n, type Lang } from '../i18n';
import type { Identity } from '../nick';
import CasinoIcon from './CasinoIcon';
import Coins from './Coins';

interface Props {
  identity: Identity & { token: string };
  profile: Profile;
  onProfileChange: (profile: Profile) => void;
}

/** Raio do "dedo" que raspa, em px da tela. */
const BRUSH = 16;
/** Parte de uma casa que precisa estar raspada para ela abrir sozinha. */
const REVEAL_AT = 0.5;
/** Intervalo mínimo entre as conferências de quanto já foi raspado (getImageData é caro). */
const CHECK_MS = 120;
const TOP_MULTIPLIER = PRIZES[0].multiplier;
const NONE_REVEALED: boolean[] = Array(CELLS).fill(false);

const pct = (n: number, lang: Lang) =>
  n.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US', { style: 'percent', maximumFractionDigits: n < 0.01 ? 1 : 0 });

/** Retângulos das casas em px inteiros do canvas (já com a densidade da tela). */
function cellRects(canvas: HTMLCanvasElement, grid: HTMLElement): DOMRect[] {
  const base = canvas.getBoundingClientRect();
  const scale = canvas.width / base.width || 1;
  return Array.from(grid.children, (el) => {
    const r = el.getBoundingClientRect();
    const x = Math.round((r.left - base.left) * scale);
    const y = Math.round((r.top - base.top) * scale);
    return new DOMRect(x, y, Math.round(r.width * scale), Math.round(r.height * scale));
  });
}

/** Quadrado chanfrado (como o --clip-chamfer-sm do CSS). */
function chamferPath(ctx: CanvasRenderingContext2D, r: DOMRect, cut: number) {
  ctx.beginPath();
  ctx.moveTo(r.x + cut, r.y);
  ctx.lineTo(r.right, r.y);
  ctx.lineTo(r.right, r.bottom - cut);
  ctx.lineTo(r.right - cut, r.bottom);
  ctx.lineTo(r.x, r.bottom);
  ctx.lineTo(r.x, r.y + cut);
  ctx.closePath();
}

/**
 * Raspadinha (aba do Arcade). O servidor sorteia a cartela e acerta as moedas na compra; aqui o jogador só raspa
 * (canvas por cima das casas) para revelar. "Revelar tudo" abre de uma vez (e serve de alternativa ao gesto).
 * O saldo na tela só soma o prêmio quando a cartela inteira é revelada.
 */
export default function ScratchCard({ identity, profile, onProfileChange }: Props) {
  const { t, lang } = useI18n();
  const [bet, setBet] = useState(BET_MIN);
  const [card, setCard] = useState<(Card & { id: number }) | null>(null);
  const [revealed, setRevealed] = useState<boolean[]>(NONE_REVEALED);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;
  const lastPoint = useRef<[number, number] | null>(null);
  const lastCheck = useRef(0);
  const nextId = useRef(0);

  const done = card !== null && revealed.every(Boolean);
  const active = card !== null && !done;
  // Saldo na tela: o do servidor (aposta e prêmio já contados) menos o prêmio ainda escondido.
  const shownCoins = profile.coins - (active ? card.prize : 0);
  const canBuy = !buying && !active && shownCoins >= bet;

  // Desenha a cobertura prateada (de novo a cada cartela e quando o tamanho muda), deixando abertas as já reveladas.
  // Revelada a cartela, o canvas sai da tela: `done` nas dependências solta o observador dele.
  useEffect(() => {
    const canvas = canvasRef.current;
    const grid = gridRef.current;
    if (!canvas || !grid) return;
    const draw = () => {
      // O observador pode disparar com o canvas já fora da página (trocou de aba/tela): aí os tokens vêm vazios.
      if (!canvas.isConnected) return;
      const { width, height } = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const css = getComputedStyle(canvas);
      const foil = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      foil.addColorStop(0, css.getPropertyValue('--text-2'));
      foil.addColorStop(0.5, css.getPropertyValue('--border'));
      foil.addColorStop(1, css.getPropertyValue('--text-2'));
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      cellRects(canvas, grid).forEach((r, i) => {
        if (revealedRef.current[i]) return;
        chamferPath(ctx, r, 6 * dpr);
        ctx.fillStyle = foil;
        ctx.fill();
        ctx.fillStyle = css.getPropertyValue('--surface-2');
        ctx.font = `700 italic ${Math.round(r.height * 0.4)}px ${css.getPropertyValue('--font-display')}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', r.x + r.width / 2, r.y + r.height / 2);
      });
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [card?.id, done]);

  /** Abre as casas que já estão raspadas o bastante. */
  const checkRevealed = () => {
    const canvas = canvasRef.current;
    const grid = gridRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !grid || !ctx) return;
    const next = [...revealedRef.current];
    let changed = false;
    cellRects(canvas, grid).forEach((r, i) => {
      if (next[i] || r.width < 1 || r.height < 1) return;
      const { data } = ctx.getImageData(r.x, r.y, r.width, r.height);
      let clear = 0;
      let total = 0;
      // Uma amostra a cada 4 px (em cada direção) basta.
      const w = r.width;
      for (let y = 0; y < r.height; y += 4) {
        for (let x = 0; x < w; x += 4) {
          total++;
          if (data[(y * w + x) * 4 + 3] < 128) clear++;
        }
      }
      if (clear / total >= REVEAL_AT) {
        next[i] = true;
        changed = true;
        ctx.clearRect(r.x - 1, r.y - 1, r.width + 2, r.height + 2);
      }
    });
    if (changed) setRevealed(next);
  };

  const scratchTo = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;
    const base = canvas.getBoundingClientRect();
    const scale = canvas.width / base.width || 1;
    const point: [number, number] = [(e.clientX - base.left) * scale, (e.clientY - base.top) * scale];
    const from = lastPoint.current ?? point;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = BRUSH * 2 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    // Um toque sem arrastar ainda raspa um círculo.
    ctx.lineTo(point[0] + 0.01, point[1]);
    ctx.stroke();
    lastPoint.current = point;
    if (e.timeStamp - lastCheck.current > CHECK_MS) {
      lastCheck.current = e.timeStamp;
      checkRevealed();
    }
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!active) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    lastPoint.current = null;
    scratchTo(e);
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (active && lastPoint.current) scratchTo(e);
  };

  const onPointerUp = () => {
    if (!lastPoint.current) return;
    lastPoint.current = null;
    checkRevealed();
  };

  const onBuy = () => {
    if (!canBuy) return;
    setBuying(true);
    setError(null);
    buyScratch(identity.token, bet)
      .then((r) => {
        setCard({ ...r, id: nextId.current++ });
        setRevealed(NONE_REVEALED);
        onProfileChange({ ...profile, coins: r.coins });
      })
      .catch((err) => setError(err instanceof TypeError ? t('common.offline') : serverText(err.message, lang)))
      .finally(() => setBuying(false));
  };

  const changeBet = (delta: number) => setBet((b) => Math.min(BET_MAX, Math.max(BET_MIN, b + delta)));
  const won = done && card.symbol !== null;

  return (
    <section className="casino scratch">
      <div className="casino-marquee">
        <span className="casino-title">{t('scratch.title')}</span>
        <button
          className="leaderboard-help-toggle"
          onClick={() => setHelpOpen((open) => !open)}
          aria-expanded={helpOpen}
          aria-label={t('scratch.helpAria')}
        >
          ?
        </button>
      </div>

      {helpOpen && (
        <div className="panel casino-help">
          <p>{t('scratch.helpRules', { cells: CELLS })}</p>
          <table className="casino-table scratch-table">
            <thead>
              <tr>
                <th>{t('scratch.trio')}</th>
                <th>{t('scratch.prize')}</th>
                <th>{t('scratch.chance')}</th>
              </tr>
            </thead>
            <tbody>
              {PRIZES.map((p) => (
                <tr key={p.id}>
                  <td>
                    <CasinoIcon id={p.id} small />
                    ×3
                  </td>
                  <td>{p.multiplier}×</td>
                  <td>{pct(p.weight / WEIGHT_TOTAL, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>{t('scratch.helpRound', { min: BET_MIN, max: BET_MAX })}</p>
          <p className="muted">{t('scratch.helpReturn')}</p>
        </div>
      )}

      <div className="casino-machine">
        <div className={`scratch-window${won && card.symbol === 'ss' ? ' jackpot' : ''}`}>
          <div className="scratch-grid" ref={gridRef} role="img" aria-label={t('scratch.cardAria')}>
            {Array.from({ length: CELLS }, (_, i) => {
              const symbol = card?.cells[i];
              return (
                <div
                  // A chave muda a cada cartela: as casas novas começam sem a animação de revelar.
                  key={`${card?.id ?? 'none'}-${i}`}
                  className={`scratch-cell${revealed[i] && card ? ' open' : ''}${won && symbol === card.symbol ? ' win' : ''}`}
                >
                  {symbol && <CasinoIcon id={symbol} />}
                </div>
              );
            })}
          </div>
          {!done && (
            <canvas
              key={card?.id ?? 'none'}
              ref={canvasRef}
              className={`scratch-cover${active ? ' active' : ''}`}
              aria-hidden="true"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          )}
        </div>

        {active ? (
          <button className="btn btn-primary btn-lg casino-spin scratch-reveal" onClick={() => setRevealed(Array(CELLS).fill(true))}>
            {t('scratch.revealAll')}
          </button>
        ) : (
          <button
            className="btn btn-primary btn-lg casino-spin scratch-buy"
            onClick={onBuy}
            disabled={!canBuy}
            aria-busy={buying}
          >
            {t('scratch.buy')}
          </button>
        )}

        <p className={`casino-result${won ? ' win' : ''}`} aria-live="polite">
          {done
            ? won
              ? t('scratch.win', { symbol: card.symbol!.toUpperCase(), prize: card.prize })
              : t('scratch.lose')
            : active
              ? t('scratch.hint')
              : t('slots.goodLuck')}
        </p>
      </div>

      <div className="casino-panel">
        <div className="casino-side scratch-top">
          <span className="casino-label">{t('scratch.top')}</span>
          <span className="casino-balance">
            <Coins amount={bet * TOP_MULTIPLIER} />
          </span>
          <CasinoIcon id="ss" small />
        </div>

        <div className="casino-side casino-wallet">
          <span className="casino-label">{t('slots.balance')}</span>
          <span className="casino-balance">
            <Coins amount={shownCoins} />
          </span>
          <div className="casino-bet" aria-label={t('slots.bet')}>
            <button className="shop-filter-option" onClick={() => changeBet(-1)} disabled={active || bet <= BET_MIN}>
              −
            </button>
            <span className="casino-bet-value">
              <Coins amount={bet} />
            </span>
            <button className="shop-filter-option" onClick={() => changeBet(1)} disabled={active || bet >= BET_MAX}>
              +
            </button>
            <button className="shop-filter-option" onClick={() => setBet(BET_MAX)} disabled={active || bet === BET_MAX}>
              {t('slots.max')}
            </button>
          </div>
          {shownCoins < bet && !active && <span className="casino-hint">{t('slots.notEnough')}</span>}
        </div>
      </div>
      {error && <p className="error casino-error">{error}</p>}
    </section>
  );
}
