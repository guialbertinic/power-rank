import { useEffect, useState } from 'react';
import { fetchLeaderboard, type LeaderboardEntry, type Period } from '../api';
import { modeLabel, useI18n, type Key } from '../i18n';
import type { Mode } from '../game/modes';
import { sameNick } from '../nick';
import { formatDuration } from '../ui/format';
import PlayerTag, { PodiumName } from './PlayerTag';
import RankBadge from './RankBadge';
import ReportLink from './ReportForm';

interface Props {
  mode: Mode;
  /** Muda para forçar recarregar (ex: depois de enviar uma pontuação). */
  refreshKey?: number;
  highlight?: string;
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
  { id: 'daily', label: 'leaderboard.daily' },
  { id: 'total', label: 'leaderboard.total' },
];

/** Embaixo da pontuação: o tempo da partida (Desafio, desempata) ou quantos dias somaram (Acumulado). */
function detail(s: LeaderboardEntry, t: (key: Key, params?: Record<string, number>) => string): string | null {
  if (s.durationMs !== undefined) return formatDuration(s.durationMs);
  if (s.days !== undefined) return s.days === 1 ? t('leaderboard.oneDay') : t('leaderboard.days', { n: s.days });
  return null;
}

/**
 * Ranking de uma categoria, só do Desafio Diário, em abas: Desafio (o de hoje; empate = menor tempo) e
 * Acumulado (soma de todos os desafios). Partida solo não entra. Os 3 primeiros num pódio, o resto em lista.
 */
export default function Leaderboard({ mode, refreshKey = 0, highlight }: Props) {
  const { t } = useI18n();
  const [period, setPeriod] = useState<Period>('daily');
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
    return (
      <div key={place} role="listitem" className={`podium-step ${className}${isYou(s) ? ' you' : ''}`}>
        <PlayerTag name={s.name} look={s.look} size={place === 1 ? 64 : 52} avatarOnly />
        <PodiumName name={s.name} look={s.look} />
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
          {t('leaderboard.title', { mode: modeLabel(t, mode) })}
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
            <strong>{t('leaderboard.daily')}:</strong> {t('leaderboard.helpDaily')}
          </p>
          <p>
            <strong>{t('leaderboard.total')}:</strong> {t('leaderboard.helpTotal')}
          </p>
        </div>
      )}
      {scores?.length === 0 && <p className="muted leaderboard-empty">{t('leaderboard.empty')}</p>}
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
      {/* Denunciar um nick do ranking (sem o próprio jogador). */}
      <ReportLink kind="nick" targets={(scores ?? []).filter((s) => !isYou(s)).map((s) => ({ id: s.name, label: s.name }))} />
    </div>
  );
}
