import { useEffect, useState } from 'react';
import { fetchLeaderboard, type LeaderboardEntry } from '../api';
import { MODES, type Mode } from '../game/modes';
import { sameNick } from '../nick';
import RankBadge from './RankBadge';

interface Props {
  mode: Mode;
  /** Muda para forçar recarregar (ex: depois de enviar uma pontuação). */
  refreshKey?: number;
  highlight?: string;
}

/** Top do ranking de um modo (cada categoria tem o seu). */
export default function Leaderboard({ mode, refreshKey = 0, highlight }: Props) {
  const [scores, setScores] = useState<LeaderboardEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setScores(null);
    fetchLeaderboard(mode)
      .then((s) => {
        if (!cancelled) setScores(s);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, refreshKey]);

  if (failed) return null;

  return (
    <div className="panel leaderboard">
      <h3 className="section-title">Ranking · {MODES.find((m) => m.id === mode)?.label}</h3>
      {scores === null && <p className="muted">Carregando...</p>}
      {scores?.length === 0 && <p className="muted">Ninguém jogou ainda. Seja o primeiro.</p>}
      {scores && scores.length > 0 && (
        <ol className="row-list">
          {scores.map((s, i) => (
            <li key={i} className={`row row-leader${highlight && sameNick(s.name, highlight) ? ' highlight' : ''}`}>
              <RankBadge position={i + 1} small />
              <span className="row-name">{s.name}</span>
              <span className="row-score">{s.score}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
