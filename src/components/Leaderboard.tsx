import { useEffect, useState } from 'react';
import { fetchLeaderboard, type LeaderboardEntry, type Period } from '../api';
import { cosmeticById } from '../game/cosmetics';
import { cosmeticLabel, useI18n, type Key } from '../i18n';
import { MODES, type Mode } from '../game/modes';
import { sameNick } from '../nick';
import { formatDuration } from '../ui/format';
import PlayerTag from './PlayerTag';
import RankBadge from './RankBadge';

interface Props {
  mode: Mode;
  /** Muda para forçar recarregar (ex: depois de enviar uma pontuação). */
  refreshKey?: number;
  highlight?: string;
  /** Aba aberta ao montar (ex: "Desafio" no resultado do Desafio Diário). */
  initialPeriod?: Period;
}

/** Degraus do pódio na ordem visual (2º, 1º, 3º), nas cores dos tiers, como no pódio da party. */
const STEPS = [
  { place: 2, className: 'second tier-s' },
  { place: 1, className: 'first tier-ss' },
  { place: 3, className: 'third tier-a' },
];

/** O ranking mostra sempre pelo menos estas posições (pódio + lista), mesmo vazio. */
const MIN_POSITIONS = 10;

const PERIODS: { id: Period; label: Key }[] = [
  { id: 'today', label: 'leaderboard.today' },
  { id: 'total', label: 'leaderboard.total' },
  { id: 'daily', label: 'leaderboard.daily' },
];

/** Embaixo da pontuação: o tempo da partida (Hoje e Desafio, desempata) ou quantos dias somaram (Acumulado). */
function detail(s: LeaderboardEntry, t: (key: Key, params?: Record<string, number>) => string): string | null {
  if (s.durationMs !== undefined) return formatDuration(s.durationMs);
  if (s.days !== undefined) return s.days === 1 ? t('leaderboard.oneDay') : t('leaderboard.days', { n: s.days });
  return null;
}

/**
 * Ranking de um modo (cada categoria tem o seu), em abas: Hoje (melhor partida do dia; empate = menor
 * tempo), Acumulado (soma do melhor de cada dia) e Desafio (o Desafio Diário de hoje, igual em todas as
 * categorias). Os 3 primeiros num pódio, o resto em lista.
 */
export default function Leaderboard({ mode, refreshKey = 0, highlight, initialPeriod = 'today' }: Props) {
  const { t, lang } = useI18n();
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [helpOpen, setHelpOpen] = useState(false);
  const [scores, setScores] = useState<LeaderboardEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setScores(null);
    fetchLeaderboard(mode, period)
      .then((s) => {
        if (!cancelled) setScores(s);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, period, refreshKey]);

  if (failed) return null;

  const isYou = (s: LeaderboardEntry) => Boolean(highlight && sameNick(s.name, highlight));

  const loading = scores === null;
  const entries = scores ?? [];
  /** Posições da lista (do 4º em diante): sempre até o 10º, vazias quando ainda não tem jogador. */
  const rowCount = Math.max(MIN_POSITIONS, entries.length) - 3;

  const podiumStep = ({ place, className }: (typeof STEPS)[number]) => {
    const s = entries[place - 1];
    if (!s) {
      return (
        <div key={place} role="listitem" className={`podium-step ${className} placeholder`}>
          <span className={`skeleton-avatar${place === 1 ? ' large' : ''}`} />
          <span className="skeleton-bar" />
          <span className="podium-score">—</span>
          <div className="podium-block">
            <span className="podium-place">{t(`podium.place${place as 1 | 2 | 3}`)}</span>
          </div>
        </div>
      );
    }
    const titleItem = s.look.title ? cosmeticById(s.look.title) : undefined;
    const title = titleItem ? cosmeticLabel(titleItem, lang) : undefined;
    return (
      <div key={place} role="listitem" className={`podium-step ${className}${isYou(s) ? ' you' : ''}`}>
        <PlayerTag name={s.name} look={s.look} size={place === 1 ? 64 : 52} avatarOnly />
        <span className={`podium-name${s.look.nameColor ? ` cosmetic-${s.look.nameColor}` : ''}`}>{s.name}</span>
        {title && <span className="podium-title">{title}</span>}
        <span className="podium-score">{s.score}</span>
        {detail(s, t) && <span className="podium-detail">{detail(s, t)}</span>}
        <div className="podium-block">
          <span className="podium-place">{t(`podium.place${place as 1 | 2 | 3}`)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="panel leaderboard">
      <div className="leaderboard-header">
        <h3 className="section-title">
          {period === 'daily'
            ? t('leaderboard.dailyTitle')
            : t('leaderboard.title', { mode: MODES.find((m) => m.id === mode)?.label ?? '' })}
        </h3>
        <div className="leaderboard-periods" role="tablist">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={period === p.id}
              className={`shop-filter-option${period === p.id ? ' selected' : ''}`}
              onClick={() => setPeriod(p.id)}
            >
              {t(p.label)}
            </button>
          ))}
          <button
            className="leaderboard-help-toggle"
            onClick={() => setHelpOpen((open) => !open)}
            aria-expanded={helpOpen}
            aria-label={t('leaderboard.helpAria')}
          >
            ?
          </button>
        </div>
      </div>
      {helpOpen && (
        <div className="leaderboard-help">
          <p>
            <strong>{t('leaderboard.today')}:</strong> {t('leaderboard.helpToday')}
          </p>
          <p>
            <strong>{t('leaderboard.total')}:</strong> {t('leaderboard.helpTotal')}
          </p>
          <p>
            <strong>{t('leaderboard.daily')}:</strong> {t('leaderboard.helpDaily')}
          </p>
        </div>
      )}
      {scores?.length === 0 && (
        <p className="muted leaderboard-empty">
          {period === 'today'
            ? t('leaderboard.emptyToday')
            : period === 'daily'
              ? t('leaderboard.emptyDaily')
              : t('leaderboard.empty')}{' '}
          {t('leaderboard.beFirst')}
        </p>
      )}
      {/* Skeleton: pódio e posições aparecem sempre; pulsam enquanto carrega e ficam vazias se faltar jogador. */}
      <div className={loading ? 'leaderboard-loading' : undefined} aria-busy={loading}>
        <div className="podium leaderboard-podium" role="list" aria-label={t('podium.aria')}>
          {STEPS.map(podiumStep)}
        </div>
        <ol className="row-list leaderboard-rows" start={4}>
          {Array.from({ length: rowCount }, (_, i) => {
            const s = entries[i + 3];
            return s ? (
              <li key={i} className={`row row-leader${isYou(s) ? ' highlight' : ''}`}>
                <RankBadge position={i + 4} small />
                <span className="row-name">
                  <PlayerTag name={s.name} look={s.look} size={36} />
                </span>
                <span className="row-score">
                  {s.score}
                  {detail(s, t) && <small className="row-detail">{detail(s, t)}</small>}
                </span>
              </li>
            ) : (
              <li key={i} className="row row-leader row-placeholder">
                <RankBadge position={i + 4} small />
                <span className="row-name">
                  <span className="skeleton-avatar small" />
                  <span className="skeleton-bar" />
                </span>
                <span className="row-score">—</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
