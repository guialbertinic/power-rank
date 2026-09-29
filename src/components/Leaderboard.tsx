import { useEffect, useState } from 'react';
import { fetchLeaderboard, type LeaderboardEntry, type Period } from '../api';
import { cosmeticById } from '../game/cosmetics';
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
}

/** Degraus do pódio na ordem visual (2º, 1º, 3º), nas cores dos tiers, como no pódio da party. */
const STEPS = [
  { place: 2, className: 'second tier-s' },
  { place: 1, className: 'first tier-ss' },
  { place: 3, className: 'third tier-a' },
];

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'total', label: 'Acumulado' },
];

/** Embaixo da pontuação: o tempo da partida (Hoje, desempata) ou quantos dias somaram (Acumulado). */
function detail(s: LeaderboardEntry): string | null {
  if (s.durationMs !== undefined) return formatDuration(s.durationMs);
  if (s.days !== undefined) return `${s.days} ${s.days === 1 ? 'dia' : 'dias'}`;
  return null;
}

/**
 * Ranking de um modo (cada categoria tem o seu), em duas abas: Hoje (melhor partida do dia; empate = menor
 * tempo) e Acumulado (soma do melhor de cada dia). Os 3 primeiros num pódio, o resto em lista.
 */
export default function Leaderboard({ mode, refreshKey = 0, highlight }: Props) {
  const [period, setPeriod] = useState<Period>('today');
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

  const podiumStep = ({ place, className }: (typeof STEPS)[number]) => {
    const s = scores?.[place - 1];
    if (!s) return <div key={place} className={`podium-step ${className} empty`} />;
    const title = s.look.title ? cosmeticById(s.look.title)?.label : undefined;
    return (
      <div key={place} role="listitem" className={`podium-step ${className}${isYou(s) ? ' you' : ''}`}>
        <PlayerTag name={s.name} look={s.look} size={place === 1 ? 64 : 52} avatarOnly />
        <span className={`podium-name${s.look.nameColor ? ` cosmetic-${s.look.nameColor}` : ''}`}>{s.name}</span>
        {title && <span className="podium-title">{title}</span>}
        <span className="podium-score">{s.score}</span>
        {detail(s) && <span className="podium-detail">{detail(s)}</span>}
        <div className="podium-block">
          <span className="podium-place">{place}º</span>
        </div>
      </div>
    );
  };

  return (
    <div className="panel leaderboard">
      <div className="leaderboard-header">
        <h3 className="section-title">Ranking · {MODES.find((m) => m.id === mode)?.label}</h3>
        <div className="leaderboard-periods" role="tablist">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={period === p.id}
              className={`shop-filter-option${period === p.id ? ' selected' : ''}`}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {scores === null && <p className="muted">Carregando...</p>}
      {scores?.length === 0 && (
        <p className="muted">{period === 'today' ? 'Ninguém jogou hoje ainda.' : 'Ninguém jogou ainda.'} Seja o primeiro.</p>
      )}
      {scores && scores.length > 0 && (
        <>
          <div className="podium leaderboard-podium" role="list" aria-label="Pódio">
            {STEPS.map(podiumStep)}
          </div>
          {scores.length > 3 && (
            <ol className="row-list leaderboard-rows" start={4}>
              {scores.slice(3).map((s, i) => (
                <li key={i} className={`row row-leader${isYou(s) ? ' highlight' : ''}`}>
                  <RankBadge position={i + 4} small />
                  <span className="row-name">
                    <PlayerTag name={s.name} look={s.look} size={36} />
                  </span>
                  <span className="row-score">
                    {s.score}
                    {detail(s) && <small className="row-detail">{detail(s)}</small>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
